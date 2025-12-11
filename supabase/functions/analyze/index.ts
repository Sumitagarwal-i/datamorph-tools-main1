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
            content: `You are a DATA QUALITY VALIDATOR. Find ONLY real data quality issues, not syntax errors.

✅ REAL SEMANTIC ERRORS (report these):
- Type mismatch: "age": "twenty" (should be number)
- Impossible value: "age": -5 (negative age)
- Logic error: "end_date": "2020-01-01", "start_date": "2021-01-01" (end before start)
- Missing critical field: user object without "email" or "id"
- Reference error: "user_id": 999 when max user_id is 100

❌ NOT ERRORS (do NOT report these):
- Valid values: "quantity": 1, "quantity": 2, "quantity": 0 are ALL valid unless context requires otherwise
- Valid units: "lbs", "gallon", "dozen", "loaves" are ALL valid units
- Unit-quantity pairs: "1 gallon", "2 loaves", "1 dozen" are ALL perfectly valid
- Different units in array: items can have different units ("lbs", "gallon", "dozen" in same list is FINE)

🎯 CRITICAL RULES:
1. Read values EXACTLY as shown - do NOT misread numbers
2. Do NOT invent rules about "unit consistency" or "quantity patterns"
3. Units and quantities are independent - any unit works with any quantity
4. If you cannot find a REAL data quality issue, return []
5. When in doubt, return [] instead of guessing

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
CSV SEMANTIC VALIDATION - Find REAL data quality issues only:

✅ REPORT: age column has "twenty" (should be number like 20)
✅ REPORT: price column has -50 (negative price)
✅ REPORT: total_price is 100 but quantity(2) × unit_price(30) = 60 (mismatch)
❌ DO NOT REPORT: Different units in different rows (this is NORMAL)
❌ DO NOT REPORT: Various quantity values (0, 1, 2, etc. are all valid)

Only report if you see ACTUAL impossible/wrong values.`
  } else if (fileType.toLowerCase() === 'json') {
    specificInstructions = `
JSON SEMANTIC VALIDATION - Find REAL data quality issues only:

✅ REPORT: "age": "twenty" (should be number like 20)
✅ REPORT: "age": -5 (negative age is impossible)
✅ REPORT: "discount_percent": 150 (exceeds 100%)
❌ DO NOT REPORT: "quantity": 0, 1, or 2 (all valid numbers)
❌ DO NOT REPORT: "unit": "lbs", "gallon", "dozen", "loaves" (all valid strings)
❌ DO NOT REPORT: Items with different units (this is NORMAL)

READ VALUES EXACTLY - do not misread numbers.
Only report ACTUAL impossible/wrong values you can see.`
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
  
  return `You are a SEMANTIC DATA VALIDATOR. Your ONLY job: find OBVIOUS data quality problems.

⚠️ CRITICAL RULES - READ CAREFULLY:
1. Read all values EXACTLY as shown - do NOT misread numbers
2. "quantity": 1 and "unit": "gallon" is PERFECTLY VALID (do NOT report this)
3. "quantity": 2 and "unit": "loaves" is PERFECTLY VALID (do NOT report this)  
4. "quantity": 1 and "unit": "dozen" is PERFECTLY VALID (do NOT report this)
5. ANY unit works with ANY quantity - this is NORMAL data
6. Different items can have different units - this is NORMAL
7. Quantity values of 0, 1, 2, 3, etc. are ALL valid

✅ ONLY REPORT THESE:
- Type mismatch: "age": "twenty" (should be number)
- Impossible value: "age": -5 (negative)
- Logic error: end_date before start_date
- Calculation error: total doesn't match sum

❌ NEVER REPORT THESE:
- "Unit not consistent with quantity" (this is NOT an error)
- Different units in same array (this is NORMAL)
- Any valid quantity-unit pair

File: ${fileName}
Type: ${fileType}${rulesContext}

Content:
\`\`\`
${contentPreview}
\`\`\`

${specificInstructions}

🎯 YOUR TASK:
1. Read values EXACTLY - do NOT misread numbers
2. Look ONLY for OBVIOUS problems: wrong types, impossible values
3. If all data is reasonable, return []
4. Maximum 10 errors only

IF YOU ARE UNSURE, RETURN [] INSTEAD OF GUESSING.

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
