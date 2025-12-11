import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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

// Simple logger
const logger = {
  info: (msg: string, data?: any) => console.log(`[INFO] ${msg}`, data || ''),
  error: (msg: string, err?: any) => console.error(`[ERROR] ${msg}`, err || ''),
  debug: (msg: string, data?: any) => console.log(`[DEBUG] ${msg}`, data || ''),
}

// Groq API configuration
const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY') || ''
const GROQ_MODEL = Deno.env.get('GROQ_MODEL') || 'llama-3.1-8b-instant'

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

    // Call LLM directly for analysis
    logger.info('[analyze-edge] Calling LLM for analysis', {
      request_id: requestId,
      content_preview: body.content.substring(0, 100),
    })

    const analysisResult = await callGroqAPI(body.content, finalFileType, fileName, requestId)
    
    const allErrors = analysisResult.errors || []

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

async function callGroqAPI(
  content: string,
  fileType: string,
  fileName: string,
  requestId: string
): Promise<{ errors: any[] }> {
  try {
    if (!GROQ_API_KEY) {
      logger.error('GROQ_API_KEY not configured')
      return { errors: [] }
    }

    // Fetch validation rules from Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || ''
    
    let rulesContext = ''
    if (supabaseUrl && supabaseAnonKey) {
      try {
        const supabase = createClient(supabaseUrl, supabaseAnonKey)
        const { data: rules, error: rulesError } = await supabase
          .from('vw_active_rules')
          .select('rule_name,rule_description,rule_example,common_mistake,fix_suggestion,severity')
          .eq('file_type', fileType.toLowerCase())
          .order('severity', { ascending: false })

        if (!rulesError && rules && rules.length > 0) {
          rulesContext = '\n\nVALIDATION RULES FOR THIS FILE TYPE:\n'
          rulesContext += rules
            .slice(0, 15) // Limit to top 15 rules to avoid prompt bloat
            .map((rule: any) => 
              `- [${rule.severity.toUpperCase()}] ${rule.rule_name}: ${rule.rule_description}`
            )
            .join('\n')

          logger.info('[rules] Loaded validation rules', {
            request_id: requestId,
            file_type: fileType,
            rule_count: rules.length,
          })
        }
      } catch (err: any) {
        logger.debug('[rules] Failed to load rules from Supabase', err?.message)
        // Continue without rules if fetch fails
      }
    }

    const prompt = buildPrompt(content, fileType, fileName, rulesContext)
    
    logger.info('[groq] Calling API', {
      request_id: requestId,
      model: GROQ_MODEL,
      prompt_length: prompt.length,
    })

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          {
            role: 'system',
            content: `You are a STRICT and THOROUGH data file validator. Your job is to find and report EVERY single issue in the file, no matter how small. 
            
Be exhaustive:
- Check every single line
- Check every field/value  
- Verify formatting and structure
- Look for type mismatches
- Find missing or extra values
- Report EVERYTHING you find

You MUST return valid JSON array format ONLY. Even if file is perfect, return empty array []. Never return anything else.`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1,
        max_tokens: 3000,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      logger.error('[groq] API error', { status: response.status, error: errorText })
      return { errors: [] }
    }

    const data = await response.json()
    const llmResponse = data.choices[0]?.message?.content || ''
    
    logger.info('[groq] Response received', {
      request_id: requestId,
      response_length: llmResponse.length,
    })

    // Parse JSON response from LLM
    const errors = parseErrorsFromLLM(llmResponse)
    
    return { errors }
  } catch (err: any) {
    logger.error('[groq] Error calling API', err)
    return { errors: [] }
  }
}

function buildPrompt(content: string, fileType: string, fileName: string, rulesContext: string = ''): string {
  // For CSV files, send more content (up to 20KB) to detect column mismatches across many rows
  // For other files, limit to 8KB to stay within token limits
  const maxPreviewLength = fileType.toLowerCase() === 'csv' ? 20000 : 8000
  const contentPreview = content.length > maxPreviewLength ? content.substring(0, maxPreviewLength) + '\n...[truncated]' : content
  
  let specificInstructions = ''
  
  if (fileType.toLowerCase() === 'csv') {
    specificInstructions = `
CRITICAL CHECKS FOR CSV (MUST REPORT ALL):
1. COUNT columns in header row - note this number
2. COUNT columns in EVERY data row - check if they match header count
3. REPORT each row that has DIFFERENT column count than header
4. REPORT rows with missing columns (fewer than header)
5. REPORT rows with extra columns (more than header)
6. Check for inconsistent data types in each column (numbers mixed with text)
7. Check for malformed quoted fields - quotes not properly escaped
8. Check for duplicate rows or duplicate headers
9. Check for empty rows in the middle of data
10. Look for trailing commas or missing commas between fields

YOU MUST CHECK EVERY SINGLE ROW AND REPORT INCONSISTENCIES. This is critical. If header has 5 columns, check that every row also has 5 columns.`
  } else if (fileType.toLowerCase() === 'json') {
    specificInstructions = `
CRITICAL CHECKS FOR JSON (MUST REPORT ALL):
1. Validate JSON syntax - ALL brackets and braces must match
2. Check ALL strings are properly quoted with double quotes
3. Check ALL object keys are properly quoted with double quotes
4. CHECK for trailing commas in objects/arrays - these are ERRORS
5. Check for missing commas between key-value pairs
6. Check for inconsistent data types in similar fields (type mismatches)
7. Look for duplicate keys in objects - flag as errors
8. Validate all values are properly formatted and escaped
9. Check for unescaped special characters like \\ and \"

YOU MUST be exhaustive. If you see a comma after a closing bracket/brace, report it as error.`
  } else if (fileType.toLowerCase() === 'xml') {
    specificInstructions = `
CRITICAL CHECKS FOR XML (MUST REPORT ALL):
1. Check ALL tags are properly closed - no unclosed tags
2. Check ALL attributes are properly quoted with quotes
3. Check for duplicate elements at the same level
4. Check for inconsistent nesting of elements
5. Check for invalid characters in text content - must be escaped
6. Check for proper XML declaration if present at start
7. Check for unmatched opening/closing tags - must match exactly
8. Check for proper character escaping (&lt; &gt; &amp; &quot;)

YOU MUST check every element. If an opening tag <item> has no matching </item>, report it.`
  }
  
  return `You are a strict data validator. Analyze this ${fileType.toUpperCase()} file and identify ALL errors, warnings, and structural issues. Be thorough and report every problem you find.

File: ${fileName}
Type: ${fileType}${rulesContext}

Content:
\`\`\`
${contentPreview}
\`\`\`

${specificInstructions}

Return your analysis as a JSON array of error objects. IMPORTANT: If you find NO issues, return an empty array: []

Each error must have:
- line: line number where the error occurs (number, 1-indexed)
- column: column number if known (number or null)
- message: brief error description (string, max 50 chars)
- type: "error" or "warning" (string)
- category: one of "syntax", "structure", "format", "validation", "inconsistency" (string)
- severity: "critical", "high", "medium", or "low" (string)
- explanation: detailed explanation of the issue (string)
- suggestions: array of suggested fixes (string[])

Return ONLY the JSON array, no other text.`
}

function parseErrorsFromLLM(llmResponse: string): any[] {
  try {
    // Try to extract JSON from the response
    const jsonMatch = llmResponse.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      if (Array.isArray(parsed)) {
        return parsed.map((err, idx) => ({
          id: `error-${idx}`,
          line: err.line || 1,
          column: err.column || null,
          message: err.message || 'Unknown error',
          type: err.type || 'error',
          category: err.category || 'general',
          severity: err.severity || 'medium',
          explanation: err.explanation || '',
          confidence: 0.85,
          suggestions: Array.isArray(err.suggestions) ? err.suggestions : [],
        }))
      }
    }
    
    logger.error('[parser] Could not parse LLM response as JSON')
    return []
  } catch (err) {
    logger.error('[parser] Error parsing LLM response', err)
    return []
  }
}
