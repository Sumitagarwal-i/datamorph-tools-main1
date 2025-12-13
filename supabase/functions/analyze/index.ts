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

serve(async (req: Request) => {
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

// async function callGroqAPI(
//   content: string,
//   fileType: string,
//   fileName: string,
//   requestId: string
// ): Promise<{ errors: any[] }> {
//   try {
//     if (!GROQ_API_KEY) {
//       logger.error('GROQ_API_KEY not configured')
//       return { errors: [] }
//     }

//     // Fetch validation rules from Supabase
//     const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
//     const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || ''
    
//     let rulesContext = ''
//     if (supabaseUrl && supabaseAnonKey) {
//       try {
//         const supabase = createClient(supabaseUrl, supabaseAnonKey)
//         const { data: rules, error: rulesError } = await supabase
//           .from('vw_active_rules')
//           .select('rule_name,rule_description,rule_example,common_mistake,fix_suggestion,severity')
//           .eq('file_type', fileType.toLowerCase())
//           .order('severity', { ascending: false })

//         if (!rulesError && rules && rules.length > 0) {
//           rulesContext = '\n\nVALIDATION RULES FOR THIS FILE TYPE:\n'
//           rulesContext += rules
//             .slice(0, 15) // Limit to top 15 rules to avoid prompt bloat
//             .map((rule: any) => 
//               `- [${rule.severity.toUpperCase()}] ${rule.rule_name}: ${rule.rule_description}`
//             )
//             .join('\n')

//           logger.info('[rules] Loaded validation rules', {
//             request_id: requestId,
//             file_type: fileType,
//             rule_count: rules.length,
//           })
//         }
//       } catch (err: any) {
//         logger.debug('[rules] Failed to load rules from Supabase', err?.message)
//         // Continue without rules if fetch fails
//       }
//     }

//     const prompt = buildPrompt(content, fileType, fileName, rulesContext)
    
//     logger.info('[groq] Calling API', {
//       request_id: requestId,
//       model: GROQ_MODEL,
//       prompt_length: prompt.length,
//     })

//     const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
//       method: 'POST',
//       headers: {
//         'Authorization': `Bearer ${GROQ_API_KEY}`,
//         'Content-Type': 'application/json',
//       },
//       body: JSON.stringify({
//         model: GROQ_MODEL,
//         messages: [
//           {
//             role: 'system',
//             content: `You are a DATA QUALITY VALIDATOR. Your job: analyze the user's data file and find ONLY real data quality issues.

// 🎯 WHAT TO REPORT:
// - Type mismatches: Text where numbers expected, or vice versa
// - Impossible values: Negative ages/prices, percentages over 100%, invalid dates
// - Logic errors: End dates before start dates, totals that don't match sums
// - Missing critical data: Required fields that are empty or null

// ❌ DO NOT REPORT:
// - Valid numeric values (any positive number is valid unless context says otherwise)
// - Valid string values (any unit name, any text is valid)
// - Different units across items (items naturally have different units)
// - Any data that looks reasonable and normal

// ⚠️ CRITICAL INSTRUCTIONS:
// 1. ONLY analyze the content provided in the user message
// 2. Do NOT report examples or test data from instructions
// 3. Read values EXACTLY - do not misread or misinterpret
// 4. If the user's data looks normal and valid, return empty array: []
// 5. Do NOT invent errors or consistency rules
// 6. When unsure, return [] instead of guessing

// 🚨 IF THERE ARE NO REAL ERRORS IN THE DATA, YOU MUST RETURN: []

// Return ONLY valid JSON array format.`
//           },
//           {
//             role: 'user',
//             content: prompt
//           }
//         ],
//         temperature: 0.1,
//         max_tokens: 2000, // Reduced to force LLM to be concise and stop at 10 errors
//       }),
//     })

//     if (!response.ok) {
//       const errorText = await response.text()
//       logger.error('[groq] API error', { status: response.status, error: errorText })
//       return { errors: [] }
//     }

//     const data = await response.json()
//     const llmResponse = data.choices[0]?.message?.content || ''
    
//     logger.info('[groq] Response received', {
//       request_id: requestId,
//       response_length: llmResponse.length,
//     })

//     // Parse JSON response from LLM
//     const errors = parseErrorsFromLLM(llmResponse)
    
//     return { errors }
//   } catch (err: any) {
//     logger.error('[groq] Error calling API', err)
//     return { errors: [] }
//   }
// }



async function callGroqAPI(
  content: string,
  fileType: string,
  fileName: string,
  requestId: string
): Promise<{ errors: any[] }> {
  try {
    const prompt = buildPrompt(content, fileType, fileName);

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        temperature: 0.0,
        max_tokens: 1500,
        messages: [
          { role: "system", content: `You are a strict semantic data validator.

CRITICAL: Your response MUST be ONLY a JSON array. Nothing else. No explanations, no text.

RULES:
1. Only analyze the file content provided by the user.
2. Do not use or reference instructions, examples, or rules as data.
3. Never guess. If unsure, return no errors.
4. Never report formatting, syntax, spacing, indentation, or unit differences.
5. Only report objective semantic problems:
   - Type mismatch (string where number expected)
   - Impossible values (negative ages, invalid dates, percent >100)
   - Missing required fields (obvious only)
   - Logical contradictions (end < start, total < sum of parts)
6. If content appears valid or cannot be confidently analyzed, return: []
7. Response MUST be valid JSON array. Never include explanations outside JSON.

IMPORTANT: Even if no errors, you MUST return []. Do NOT return text like "No errors found" or "Data is valid".
Your entire response should be ONLY: [] or [{...}] - nothing else.`
 },
          { role: "user", content: prompt }
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      logger.error("[groq] API failed", error);
      return { errors: [] };
    }

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content ?? "";

    logger.info('[groq] Response received', {
      request_id: requestId,
      response_length: raw.length,
      response_preview: raw.substring(0, 200),
      finish_reason: data.choices?.[0]?.finish_reason,
    })

    const errors = parseErrorsFromLLM(raw);
    
    logger.info('[groq] Parsed errors', {
      request_id: requestId,
      error_count: errors.length,
    })
    
    return { errors };

  } catch (err) {
    logger.error("[groq] failure", err);
    return { errors: [] };
  }
}






// function buildPrompt(content: string, fileType: string, fileName: string, rulesContext: string = ''): string {
//   let contentPreview: string
  
//   // For CSV files with large content, use strategic sampling to show patterns
//   if (fileType.toLowerCase() === 'csv' && content.length > 20000) {
//     const lines = content.split('\n')
//     const headerLine = lines[0] || ''
//     const sampleSize = 15 // Show 15 lines from different parts
    
//     // Create a strategic sample: header + samples from throughout the file
//     let sampledLines = [headerLine]
    
//     if (lines.length > sampleSize) {
//       // Calculate step to get evenly distributed samples
//       const step = Math.floor((lines.length - 1) / (sampleSize - 1))
//       for (let i = 1; i < sampleSize && i < lines.length; i++) {
//         const idx = Math.min(i * step, lines.length - 1)
//         sampledLines.push(lines[idx])
//       }
//     } else {
//       sampledLines = lines.slice(0, sampleSize)
//     }
    
//     contentPreview = `[HEADER + STRATEGIC SAMPLES FROM FILE - showing ${sampledLines.length} lines representing the full file structure]\n\n${sampledLines.join('\n')}\n\n[...more rows not shown...]`
    
//     logger.info('[sampling] Using strategic CSV sampling', {
//       original_size: content.length,
//       total_lines: lines.length,
//       sample_lines: sampledLines.length,
//     })
//   } else {
//     // For smaller files or non-CSV, use simple truncation
//     const maxPreviewLength = fileType.toLowerCase() === 'csv' ? 20000 : 8000
//     contentPreview = content.length > maxPreviewLength ? content.substring(0, maxPreviewLength) + '\n...[truncated]' : content
//   }
  
//   let specificInstructions = ''
  
//   if (fileType.toLowerCase() === 'csv') {
//     specificInstructions = `
// CSV SEMANTIC VALIDATION:
// Look for: Text in numeric columns, negative values where impossible, calculation mismatches.
// Do NOT report: Different units, various quantities (all normal).
// If all data looks valid, return [].`
//   } else if (fileType.toLowerCase() === 'json') {
//     specificInstructions = `
// JSON SEMANTIC VALIDATION:
// Look for: Text where numbers expected, negative values where impossible, percentages over 100%.
// Do NOT report: Valid numbers, valid strings, different units across items (all normal).
// If all data looks valid, return [].`
//   } else if (fileType.toLowerCase() === 'xml') {
//     specificInstructions = `
// XML SEMANTIC VALIDATION (syntax already validated locally):
// 1. Data Type Validation: Check if numeric fields contain text (e.g., <age>twenty</age> should be number)
// 2. Required Elements: Check if mandatory child elements are missing
// 3. Value Validation: Check for impossible values (e.g., <price>-10</price>)
// 4. Attribute Values: Check if attributes have valid values (e.g., status="unknown" when should be defined)
// 5. ID References: Check if IDREF attributes reference existing IDs
// 6. Cross-element Logic: Check relationships between elements (e.g., quantity and total match)
// 7. Namespace Usage: Check if namespaces are used consistently

// FOCUS ON DATA QUALITY AND SEMANTICS, NOT SYNTAX. The XML structure is already validated.`
//   } else if (fileType.toLowerCase() === 'yaml') {
//     specificInstructions = `
// YAML SEMANTIC VALIDATION (syntax already validated locally):
// 1. Data Type Validation: Check if values have correct types (e.g., age: "25" should be number, not string)
// 2. Required Fields: Check if objects are missing expected fields
// 3. Value Validation: Check for impossible values (e.g., age: -5, port: 70000 exceeds valid range)
// 4. Enum Validation: Check if fields have invalid values (e.g., environment: "unknown" when should be "dev"|"prod")
// 5. List Consistency: Check if list items have consistent structure
// 6. Reference Validation: Check if anchors and aliases are used correctly
// 7. Cross-field Logic: Check relationships between fields (e.g., max_value < min_value)

// FOCUS ON DATA QUALITY AND SEMANTICS, NOT SYNTAX. The YAML structure is already validated.`
//   }
  
//   return `You are a SEMANTIC DATA VALIDATOR. Analyze ONLY the data content below (not instructions or examples).

// ⚠️ CRITICAL RULES:
// 1. Read values EXACTLY as shown in the content section
// 2. Do NOT report examples or test data from instructions
// 3. ANY quantity with ANY unit is valid (do NOT report these)
// 4. Different units across items is normal (do NOT report this)
// 5. Numeric values like 0, 1, 2, 3, etc. are all valid

// ✅ REPORT ONLY:
// - Type mismatches: Text where numbers clearly expected
// - Impossible values: Negative ages/prices, percentages > 100%
// - Logic errors: End before start, totals not matching sums

// ❌ NEVER REPORT:
// - Valid quantity-unit pairs
// - Different units in lists
// - Normal numeric or string values

// File: ${fileName}
// Type: ${fileType}${rulesContext}

// Content:
// \`\`\`
// ${contentPreview}
// \`\`\`

// ${specificInstructions}

// 🎯 YOUR TASK:
// 1. Analyze ONLY the content below (ignore instruction examples)
// 2. Look for OBVIOUS problems: wrong types, impossible values  
// 3. If data looks normal and valid, return []
// 4. Maximum 10 real errors only

// 🚨 CRITICAL: IF NO REAL ERRORS EXIST, YOU MUST RETURN EMPTY ARRAY: []
// DO NOT INVENT OR REPORT UNNECESSARY ERRORS FROM VALID DATA.

// Output format (return JSON array):
// [
//   {
//     "line": <line_number>,
//     "column": null,
//     "message": "<brief error description>",
//     "type": "error",
//     "category": "data_quality",
//     "severity": "high",
//     "explanation": "<why this is an error>",
//     "suggestions": ["<how to fix>"]
//   }
// ]
// OR if no errors: []

// RESPONSE FORMAT RULES:
// - Return JSON array with 0-10 error objects (semantic errors only)
// - Use ONLY double quotes (never single quotes)
// - NO trailing commas anywhere
// - NO text before [ or after ]
// - If NO semantic errors found, MUST return: []
// - severity: critical|high|medium|low
// - type: error|warning  
// - category: data_quality|logic|validation|inconsistency|missing_data`
// }




function buildPrompt(content: string, fileType: string, fileName: string): string {
  const MAX_CHARS = 9000;
  const preview =
    content.length > MAX_CHARS
      ? content.slice(0, MAX_CHARS) + "\n...[truncated]"
      : content;

  return `
FILE NAME: ${fileName}
FILE TYPE: ${fileType}

Below is the DATA CONTENT for analysis. Only analyze this block.

CONTENT_START
${preview}
CONTENT_END

TASK:
Identify only clear semantic errors in this content.

Allowed error types:
- "type_mismatch"
- "impossible_value"
- "missing_field"
- "logic_error"
- "inconsistent_structure"

Return a JSON array of 0–10 items, each like:

{
  "line": <estimated_line_or_null>,
  "message": "<describe the error and mention the field/value causing it>",
  "category": "<one of the types above>"
}

NOTE: Line numbers are rough estimates since content may be truncated. Include field names and values in the message so they can be searched.

If no semantic errors are confidently found, return [].

IMPORTANT : Return ONLY a JSON array. No text before or after.
  `;
}













function parseErrorsFromLLM(llmResponse: string): any[] {
  try {
    // Log the full response for debugging
    logger.debug('[parser] Raw LLM response', {
      response_length: llmResponse.length,
      response_start: llmResponse.substring(0, 300),
      response_end: llmResponse.substring(Math.max(0, llmResponse.length - 300)),
    })
    
    // Clean up response - remove common text before/after JSON
    let cleanedResponse = llmResponse.trim()
    
    // Remove markdown code blocks if present
    cleanedResponse = cleanedResponse.replace(/```json\s*/gi, '').replace(/```\s*/g, '')
    
    // Remove common prefixes
    cleanedResponse = cleanedResponse.replace(/^(here's the analysis|here are the errors|errors found|validation results?):\s*/gi, '')
    
    // Check if response is just plain text indicating no errors
    const noErrorsPatterns = [
      /^no errors?( found| detected)?\.?$/i,
      /^the (data|content|file) (is |appears? )?valid\.?$/i,
      /^valid data\.?$/i,
      /^\[\]$/,
    ]
    
    if (noErrorsPatterns.some(pattern => pattern.test(cleanedResponse.trim()))) {
      logger.info('[parser] LLM returned text indicating no errors, converting to []')
      return []
    }
    
    // Try to extract JSON array from the response
    // First try non-greedy match
    let jsonMatch = cleanedResponse.match(/\[[\s\S]*?\]/);
    
    // If that fails, try greedy match (might catch more)
    if (!jsonMatch) {
      jsonMatch = cleanedResponse.match(/\[[\s\S]*\]/);
    }
    
    // If still no match, try to find if there are individual objects we can salvage
    if (!jsonMatch) {
      logger.info('[parser] No JSON array found, attempting to find individual error objects')
      
      // Try to find any JSON objects in the response
      const objectMatches = cleanedResponse.match(/\{[^{}]*"(line|message|category)"[^{}]*\}/g)
      if (objectMatches && objectMatches.length > 0) {
        logger.info('[parser] Found individual error objects, attempting to build array', {
          object_count: objectMatches.length
        })
        // Try to build an array from found objects
        jsonMatch = ['[' + objectMatches.join(',') + ']']
      }
    }
    
    if (!jsonMatch) {
      logger.error('[parser] No JSON array or objects found - FULL RESPONSE:', {
        response_length: llmResponse.length,
        full_raw_response: llmResponse, // Log ENTIRE response for debugging
      })
      return []
    }

    let jsonString = jsonMatch[0]
    
    logger.debug('[parser] Extracted JSON string', {
      json_length: jsonString.length,
      json_start: jsonString.substring(0, 200),
    })
    
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
        // Strategy 0: Fix corrupted property syntax like "line"]: to "line":
        (json: string) => json.replace(/"(\w+)"\]\s*:/g, '"$1":'),
        
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
        
        // Strategy 6: Aggressive - try to extract individual error objects and rebuild array
        (json: string) => {
          logger.info('[parser] Attempting aggressive object extraction')
          const objectRegex = /\{[^{}]*\}/g
          const matches = json.match(objectRegex)
          if (matches && matches.length > 0) {
            // Try to parse each object individually
            const validObjects = matches.filter(obj => {
              try {
                JSON.parse(obj)
                return true
              } catch {
                return false
              }
            })
            if (validObjects.length > 0) {
              return '[' + validObjects.join(',') + ']'
            }
          }
          return json
        },
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
      
      // All strategies failed, log the FULL response for debugging
      logger.error('[parser] All recovery strategies failed - FULL RESPONSE BELOW', {
        original_error: parseError?.message,
        json_length: jsonString.length,
        full_json_string: jsonString, // Log the entire JSON for debugging
      })
    }
    
    logger.error('[parser] Could not parse LLM response as valid JSON array - returning empty')
    return []
  } catch (err) {
    logger.error('[parser] Unexpected error in parseErrorsFromLLM', err)
    return []
  }
}
