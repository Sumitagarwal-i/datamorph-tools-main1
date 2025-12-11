import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Import shared utilities (adjust paths as needed after deployment)
import { buildChunkList } from '../_shared/chunkProcessor.ts'
import { callLLM } from '../_shared/llmProvider.ts'
import { logger } from '../_shared/logger.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface AnalyzeRequest {
  content: string
  file_type?: 'auto' | 'json' | 'csv' | 'xml' | 'yaml'
  file_name?: string
  max_errors?: number
  stream?: boolean
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const requestId = crypto.randomUUID()
    const startTime = Date.now()

    logger.info('[analyze-edge] Request received', {
      request_id: requestId,
      method: req.method,
      content_length: req.headers.get('content-length'),
    })

    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse request body
    const body: AnalyzeRequest = await req.json()

    if (!body.content || typeof body.content !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid content field' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const fileType = body.file_type || 'auto'
    const fileName = body.file_name || 'unknown'
    const contentLength = body.content.length

    logger.info('[analyze-edge] Request validated', {
      request_id: requestId,
      file_type: fileType,
      file_name: fileName,
      content_length: contentLength,
    })

    // Detect file type if auto
    let finalFileType: 'json' | 'csv' | 'xml' | 'yaml' = 'json'
    if (fileType === 'auto') {
      // Simple detection logic
      const trimmed = body.content.trim()
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        finalFileType = 'json'
      } else if (trimmed.startsWith('<')) {
        finalFileType = 'xml'
      } else if (trimmed.includes(',') && trimmed.split('\n').length > 1) {
        finalFileType = 'csv'
      } else {
        finalFileType = 'yaml'
      }
    } else {
      finalFileType = fileType as any
    }

    // Run local prechecks
    const parserHints: any[] = []
    
    // Build chunks for large files
    const chunks = buildChunkList(body.content, parserHints)

    logger.info('[analyze-edge] Chunks built', {
      request_id: requestId,
      chunks_count: chunks.length,
    })

    // Analyze each chunk in parallel
    const chunkPromises = chunks.map((chunk) =>
      analyzeChunk(chunk, finalFileType, parserHints, [], requestId, fileName)
    )

    const chunkAnalyses = await Promise.all(chunkPromises)

    // Aggregate errors from all chunks
    const allErrors = chunkAnalyses.flatMap((analysis) => analysis.errors)

    logger.info('[analyze-edge] Analysis complete', {
      request_id: requestId,
      total_errors: allErrors.length,
      latency_ms: Date.now() - startTime,
    })

    // Return response
    return new Response(
      JSON.stringify({
        request_id: requestId,
        file_name: fileName,
        file_type: finalFileType,
        content_length: contentLength,
        errors: allErrors,
        summary: {
          total_errors: allErrors.filter((e) => e.type === 'error').length,
          total_warnings: allErrors.filter((e) => e.type === 'warning').length,
          analysis_time_ms: Date.now() - startTime,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error: any) {
    logger.error('[analyze-edge] Error', error)

    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error?.message || 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})

async function analyzeChunk(
  chunk: any,
  fileType: 'json' | 'csv' | 'xml' | 'yaml',
  parserHints: any[],
  ragSnippets: any[],
  requestId: string,
  fileName: string
): Promise<{ chunkId: string; errors: any[] }> {
  try {
    const chunkResponse = await callLLM({
      fileType,
      content: chunk.content,
      originalContent: chunk.content,
      fileName,
      parserHints,
      ragSnippets,
      truncationMap: {
        was_truncated: false,
        original_length: chunk.content.length,
        truncated_length: chunk.content.length,
        head_chars: chunk.content.length,
        tail_chars: 0,
        error_windows: [],
        omitted_ranges: [],
      },
      truncationNote: `Analyzing chunk: ${chunk.type} (lines ${chunk.startLine}-${chunk.endLine})`,
      maxErrors: 20,
      stream: false,
      requestId: `${requestId}-${chunk.id}`,
    })

    if (!chunkResponse.success || !chunkResponse.data) {
      return { chunkId: chunk.id, errors: [] }
    }

    const adjustedErrors = chunkResponse.data.errors.map((err: any) => ({
      id: err.id || `${chunk.id}-${Math.random()}`,
      line: err.line ? err.line + chunk.startLine - 1 : chunk.startLine,
      column: err.column,
      message: err.message,
      type: err.type,
      category: err.category,
      severity: err.severity || 'medium',
      explanation: err.explanation,
      confidence: err.confidence || 0.7,
      suggestions: err.suggestions,
    }))

    return { chunkId: chunk.id, errors: adjustedErrors }
  } catch (err) {
    logger.error(`Chunk analysis failed for ${chunk.id}`, err)
    return { chunkId: chunk.id, errors: [] }
  }
}
