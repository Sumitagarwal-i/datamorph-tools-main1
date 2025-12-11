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

    // DISABLED: Supabase rules loading - causes LLM confusion with examples
    // Using ultra-minimal prompts instead for accuracy
    const rulesContext = ''

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
            content: `You are a data validator. Find ONLY OBVIOUS problems:

✅ REPORT ONLY:
- Text in numeric fields (age: "twenty")
- Negative values (age: -5, price: -100)
- Impossible percentages (discount: 150%)
- Date logic errors (end before start)

❌ NEVER REPORT:
- Shopping lists with items/quantities/units (ALL VALID)
- Any positive numbers (1, 2, 3, etc. are ALL VALID)
- Any text strings ("lbs", "gallon" are ALL VALID)  
- Data that looks normal

🚨 IF DATA LOOKS NORMAL, RETURN: []

Return JSON array only.`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0, // Maximum determinism
        max_tokens: 1000, // Minimal - force brevity
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
  let contentPreview: string
  
  // For CSV files with large content, use strategic sampling to show patterns
  if (fileType.toLowerCase() === 'csv' && content.length > 20000) {
    const lines = content.split('\n')
    const headerLine = lines[0] || ''
    const sampleSize = 15 // Show 15 lines from different parts
    
    // Create a strategic sample: header + samples from throughout the file
    let sampledLines = [headerLine]
    
    if (lines.length > sampleSize) {
      // Calculate step to get evenly distributed samples
      const step = Math.floor((lines.length - 1) / (sampleSize - 1))
      for (let i = 1; i < sampleSize && i < lines.length; i++) {
        const idx = Math.min(i * step, lines.length - 1)
        sampledLines.push(lines[idx])
      }
    } else {
      sampledLines = lines.slice(0, sampleSize)
    }
    
    contentPreview = `[HEADER + STRATEGIC SAMPLES FROM FILE - showing ${sampledLines.length} lines representing the full file structure]\n\n${sampledLines.join('\n')}\n\n[...more rows not shown...]`
    
    logger.info('[sampling] Using strategic CSV sampling', {
      original_size: content.length,
      total_lines: lines.length,
      sample_lines: sampledLines.length,
    })
  } else {
    // For smaller files or non-CSV, use simple truncation
    const maxPreviewLength = fileType.toLowerCase() === 'csv' ? 20000 : 8000
    contentPreview = content.length > maxPreviewLength ? content.substring(0, maxPreviewLength) + '\n...[truncated]' : content
  }
  
  const specificInstructions = 'If this is a shopping list, inventory, or similar normal data structure, return [].'
  
  return `Analyze this ${fileType.toUpperCase()} data. Find ONLY obvious errors.

File: ${fileName}

Data:
\`\`\`
${contentPreview}
\`\`\`

${specificInstructions}

RULES:
- Shopping lists are ALWAYS VALID (items with quantities/units)
- Positive numbers (1,2,3...) are ALWAYS VALID
- Text strings ("lbs","gallon") are ALWAYS VALID
- Only report: negative ages/prices, text in number fields, impossible percentages
- If data looks normal: return []

Return JSON array or [] if no errors:
[{"line":1,"message":"error","type":"error","category":"data_quality","severity":"high","explanation":"why","suggestions":["fix"]}]`
}

function parseErrorsFromLLM(llmResponse: string): any[] {
  try {
    // Try to extract JSON array from the response
    const jsonMatch = llmResponse.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      logger.warn('[parser] No JSON array found in response', {
        response_length: llmResponse.length,
        response_preview: llmResponse.substring(0, 200),
      })
      return []
    }

    let jsonString = jsonMatch[0]
    
    // Try direct parse first
    try {
      const parsed = JSON.parse(jsonString)
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
    } catch (parseError: any) {
      // If direct parse fails, try multiple recovery strategies
      const errorPos = parseError?.message?.match(/position (\d+)/)?.[1]
      
      logger.debug('[parser] Direct JSON parse failed, attempting recovery', {
        error: parseError?.message,
        position: errorPos,
        json_length: jsonString.length,
        json_preview_at_error: errorPos ? jsonString.substring(Math.max(0, parseInt(errorPos) - 50), Math.min(jsonString.length, parseInt(errorPos) + 50)) : 'N/A',
      })

      // Try multiple recovery strategies
      const recoveryStrategies = [
        // Strategy 1: Fix truncated response - find last COMPLETE object
        (json: string) => {
          if (!json.trim().endsWith(']')) {
            logger.info('[parser] Truncated response detected - finding last complete object')
            // Look for last '},' or '}\n' pattern (complete object followed by comma or newline)
            const lastCompletePattern = json.lastIndexOf('},')
            if (lastCompletePattern > 0) {
              return json.substring(0, lastCompletePattern + 1) + '\n]'
            }
            // Try finding just last complete '}'
            const lastBrace = json.lastIndexOf('}')
            if (lastBrace > 0) {
              return json.substring(0, lastBrace + 1) + '\n]'
            }
          }
          return json
        },
        
        // Strategy 2: Remove trailing commas
        (json: string) => json.replace(/,(\s*[\]}])/g, '$1'),
        
        // Strategy 3: Fix single quotes to double quotes globally
        (json: string) => json.replace(/'/g, '"'),
        
        // Strategy 4: Fix missing closing brackets for truncated suggestions array
        (json: string) => {
          // If ends with incomplete suggestions like: ["fix" or ["fix",'
          if (/\["[^"]*"[,']?$/.test(json.trim())) {
            return json.trim().replace(/[,']$/, '') + ']\n}\n]'
          }
          return json
        },
        
        // Strategy 5: Fix missing quotes around property names
        (json: string) => json.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)(\s*:)/g, '$1"$2"$3'),
      ]

      for (let i = 0; i < recoveryStrategies.length; i++) {
        try {
          let fixedJson = jsonString
          for (let j = 0; j <= i; j++) {
            fixedJson = recoveryStrategies[j](fixedJson)
          }
          
          const parsed = JSON.parse(fixedJson)
          if (Array.isArray(parsed)) {
            logger.info('[parser] Successfully recovered from malformed JSON', {
              strategy_used: `combination_of_${i + 1}_strategies`,
              original_length: jsonString.length,
              fixed_length: fixedJson.length,
            })
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
        } catch (strategyError) {
          // Try next strategy
          continue
        }
      }
      
      // All strategies failed, log detailed error
      logger.error('[parser] All recovery strategies failed', {
        original_error: parseError?.message,
        json_length: jsonString.length,
        json_start: jsonString.substring(0, 200),
        json_end: jsonString.substring(Math.max(0, jsonString.length - 200)),
      })
    }
    
    logger.error('[parser] Could not parse LLM response as valid JSON array')
    return []
  } catch (err) {
    logger.error('[parser] Unexpected error in parseErrorsFromLLM', err)
    return []
  }
}
