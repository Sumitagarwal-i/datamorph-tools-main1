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
            content: `You are a DATA QUALITY and SEMANTIC VALIDATOR. Your role is to find LOGICAL and SEMANTIC errors, NOT SYNTAX errors.

YOUR RESPONSIBILITIES:
- Validate data types (e.g., age should be number, not "twenty")
- Check for impossible values (e.g., age: -5, dates in future for historical data)
- Validate cross-field logic (e.g., end_date before start_date)
- Check for missing required fields based on context
- Identify data inconsistencies and quality issues
- Validate business rules and constraints

NOT YOUR RESPONSIBILITY:
- DO NOT check syntax (brackets, commas, quotes) - that's handled separately
- DO NOT validate file structure or formatting
- DO NOT check for parsing errors

IMPORTANT:
- Only report REAL semantic/logical errors you can verify
- Do NOT invent or hallucinate errors
- If data quality is good, return empty array []
- Be precise and factual

Return ONLY valid JSON array format.`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1,
        max_tokens: 2000, // Reduced to force LLM to be concise and stop at 10 errors
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
  
  let specificInstructions = ''
  
  if (fileType.toLowerCase() === 'csv') {
    specificInstructions = `
CSV SEMANTIC VALIDATION (syntax already validated locally):
1. Data Type Validation: Check if numeric columns contain text (e.g., age: "twenty" should be number)
2. Value Range: Check for impossible values (e.g., negative prices, ages over 150)
3. Consistency: Check if same field has inconsistent formats (e.g., dates: "2023-01-01" vs "01/01/2023")
4. Required Fields: Check if critical fields are empty (e.g., missing email in user data)
5. Cross-field Logic: Check relationships between fields (e.g., total_price should match quantity × unit_price)

FOCUS ON DATA QUALITY, NOT SYNTAX. The file structure is already validated.`
  } else if (fileType.toLowerCase() === 'json') {
    specificInstructions = `
JSON SEMANTIC VALIDATION (syntax already validated locally):
1. Data Type Validation: Check if fields have correct types (e.g., "age": "25" should be number, not string)
2. Required Fields: Check if objects are missing expected fields (e.g., user without "email")
3. Value Validation: Check for impossible values (e.g., "age": -5, "quantity": 0 when shouldn't be zero)
4. Enum Validation: Check if status/category fields have invalid values (e.g., status: "unknown" when should be "active"|"inactive")
5. ID References: Check if referenced IDs exist (e.g., "user_id": 999 when users only go to 100)
6. Cross-field Logic: Check field relationships (e.g., "discount_percent" is 150 which exceeds 100%)
7. Date Logic: Check date relationships (e.g., "end_date" is before "start_date")

FOCUS ON DATA QUALITY AND LOGIC, NOT SYNTAX. The JSON structure is already validated.`
  } else if (fileType.toLowerCase() === 'xml') {
    specificInstructions = `
XML SEMANTIC VALIDATION (syntax already validated locally):
1. Data Type Validation: Check if numeric fields contain text (e.g., <age>twenty</age> should be number)
2. Required Elements: Check if mandatory child elements are missing
3. Value Validation: Check for impossible values (e.g., <price>-10</price>)
4. Attribute Values: Check if attributes have valid values (e.g., status="unknown" when should be defined)
5. ID References: Check if IDREF attributes reference existing IDs
6. Cross-element Logic: Check relationships between elements (e.g., quantity and total match)
7. Namespace Usage: Check if namespaces are used consistently

FOCUS ON DATA QUALITY AND SEMANTICS, NOT SYNTAX. The XML structure is already validated.`
  } else if (fileType.toLowerCase() === 'yaml') {
    specificInstructions = `
YAML SEMANTIC VALIDATION (syntax already validated locally):
1. Data Type Validation: Check if values have correct types (e.g., age: "25" should be number, not string)
2. Required Fields: Check if objects are missing expected fields
3. Value Validation: Check for impossible values (e.g., age: -5, port: 70000 exceeds valid range)
4. Enum Validation: Check if fields have invalid values (e.g., environment: "unknown" when should be "dev"|"prod")
5. List Consistency: Check if list items have consistent structure
6. Reference Validation: Check if anchors and aliases are used correctly
7. Cross-field Logic: Check relationships between fields (e.g., max_value < min_value)

FOCUS ON DATA QUALITY AND SEMANTICS, NOT SYNTAX. The YAML structure is already validated.`
  }
  
  return `You are a SEMANTIC DATA VALIDATOR. The file syntax has already been validated locally - your job is to find DATA QUALITY and LOGIC errors only.

🎯 YOUR FOCUS: Find semantic issues like wrong data types, impossible values, missing required data, logical inconsistencies.
❌ NOT YOUR JOB: DO NOT check syntax, brackets, commas, quotes, or formatting - that's already done.

File: ${fileName}
Type: ${fileType}${rulesContext}

Content:
\`\`\`
${contentPreview}
\`\`\`

${specificInstructions}

VALIDATION APPROACH:
1. Assume the file structure is syntactically correct
2. Look for DATA QUALITY issues: wrong types, impossible values, missing data
3. Check LOGICAL RELATIONSHIPS between fields
4. Validate BUSINESS RULES and constraints
5. If data quality is good, return empty array []
6. Maximum 10 most critical semantic errors only

Remember: You're checking DATA QUALITY, not syntax. Be intelligent and accurate.

Example output format (ONLY return this JSON array structure):
[
  {
    "line": 5,
    "column": null,
    "message": "Age value '-5' is invalid",
    "type": "error",
    "category": "data_quality",
    "severity": "high",
    "explanation": "Age cannot be negative. Value should be positive integer.",
    "suggestions": ["Change age to positive value", "Verify data source"]
  }
]

RESPONSE FORMAT RULES:
- Return JSON array with 0-10 error objects (semantic errors only)
- Use ONLY double quotes (never single quotes)
- NO trailing commas anywhere
- NO text before [ or after ]
- If NO semantic errors found, return: []
- severity: critical|high|medium|low
- type: error|warning  
- category: data_quality|logic|validation|inconsistency|missing_data`
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
