import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface AnalyzeRequest {
  content: string
  file_type?: 'auto' | 'json' | 'csv' | 'xml' | 'yaml'
  file_name?: string
  max_errors?: number
}

interface ValidationError {
  id: string
  line: number
  column: number | null
  message: string
  type: 'error' | 'warning'
  category: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  explanation: string
  confidence: number
  suggestions: string[]
}

const logger = {
  info: (msg: string, data?: any) => console.log(`[INFO] ${msg}`, data || ''),
  error: (msg: string, err?: any) => console.error(`[ERROR] ${msg}`, err || ''),
  debug: (msg: string, data?: any) => console.log(`[DEBUG] ${msg}`, data || ''),
}

const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY') || ''
const GROQ_MODEL = Deno.env.get('GROQ_MODEL') || 'llama-3.1-8b-instant'

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const requestId = crypto.randomUUID()
    const startTime = Date.now()

    logger.info('[analyze-edge] Request received', { request_id: requestId })

    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const body: AnalyzeRequest = await req.json()

    if (!body.content || typeof body.content !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid content field' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const fileType = detectFileType(body.content, body.file_type)
    const fileName = body.file_name || 'unknown'
    const contentLength = body.content.length

    logger.info('[analyze-edge] Request validated', {
      request_id: requestId,
      file_type: fileType,
      content_length: contentLength,
    })

    // Multi-stage validation
    const errors: ValidationError[] = []
    
    // Stage 1: Deterministic structural validation
    const structuralErrors = await validateStructure(body.content, fileType, requestId)
    errors.push(...structuralErrors)

    // Stage 2: Rule-based semantic validation
    const semanticErrors = await validateSemantics(body.content, fileType, requestId)
    errors.push(...semanticErrors)

    // Stage 3: LLM validation (only for complex patterns, with strict constraints)
    if (errors.length < 50) { // Only use LLM if we haven't found too many errors already
      const llmErrors = await llmValidation(body.content, fileType, fileName, requestId, body.max_errors || 10)
      
      // Deduplicate LLM errors against already found errors
      const dedupedLlmErrors = deduplicateErrors(llmErrors, errors)
      errors.push(...dedupedLlmErrors)
    }

    // Sort by severity and line number
    const sortedErrors = errors
      .sort((a, b) => {
        const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 }
        if (severityOrder[a.severity] !== severityOrder[b.severity]) {
          return severityOrder[a.severity] - severityOrder[b.severity]
        }
        return a.line - b.line
      })
      .slice(0, body.max_errors || 50) // Hard limit on errors returned

    logger.info('[analyze-edge] Analysis complete', {
      request_id: requestId,
      total_errors: sortedErrors.length,
      latency_ms: Date.now() - startTime,
    })

    return new Response(
      JSON.stringify({
        request_id: requestId,
        file_name: fileName,
        file_type: fileType,
        content_length: contentLength,
        errors: sortedErrors,
        summary: {
          total_errors: sortedErrors.filter((e) => e.type === 'error').length,
          total_warnings: sortedErrors.filter((e) => e.type === 'warning').length,
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

function detectFileType(content: string, hint?: string): 'json' | 'csv' | 'xml' | 'yaml' {
  if (hint && hint !== 'auto') {
    return hint as any
  }

  const trimmed = content.trim()
  
  // JSON detection
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return 'json'
  }
  
  // XML detection
  if (trimmed.startsWith('<') || trimmed.includes('<?xml')) {
    return 'xml'
  }
  
  // CSV detection (has commas and multiple lines)
  const lines = trimmed.split('\n')
  if (lines.length > 1 && lines[0].includes(',')) {
    return 'csv'
  }
  
  // YAML detection (key: value pattern)
  if (/^\w+:\s*.+$/m.test(trimmed)) {
    return 'yaml'
  }
  
  return 'json' // default
}

// ============================================================================
// STAGE 1: Deterministic Structural Validation
// ============================================================================
async function validateStructure(
  content: string,
  fileType: string,
  requestId: string
): Promise<ValidationError[]> {
  const errors: ValidationError[] = []
  
  try {
    switch (fileType) {
      case 'json':
        errors.push(...validateJsonStructure(content))
        break
      case 'csv':
        errors.push(...validateCsvStructure(content))
        break
      case 'xml':
        errors.push(...validateXmlStructure(content))
        break
      case 'yaml':
        errors.push(...validateYamlStructure(content))
        break
    }
  } catch (err: any) {
    logger.error('[structure] Validation failed', err)
  }
  
  logger.info('[structure] Structural validation complete', {
    request_id: requestId,
    error_count: errors.length
  })
  
  return errors
}

function validateJsonStructure(content: string): ValidationError[] {
  const errors: ValidationError[] = []
  
  try {
    JSON.parse(content)
  } catch (err: any) {
    const match = err.message.match(/position (\d+)/)
    const position = match ? parseInt(match[1]) : 0
    const line = content.substring(0, position).split('\n').length
    
    errors.push({
      id: `struct-json-1`,
      line,
      column: null,
      message: 'Invalid JSON syntax',
      type: 'error',
      category: 'syntax',
      severity: 'critical',
      explanation: err.message,
      confidence: 1.0,
      suggestions: ['Check for missing quotes, commas, or brackets']
    })
  }
  
  return errors
}

function validateCsvStructure(content: string): ValidationError[] {
  const errors: ValidationError[] = []
  const lines = content.split('\n').filter(l => l.trim())
  
  if (lines.length === 0) {
    errors.push({
      id: 'struct-csv-empty',
      line: 1,
      column: null,
      message: 'Empty CSV file',
      type: 'error',
      category: 'structure',
      severity: 'high',
      explanation: 'CSV file contains no data',
      confidence: 1.0,
      suggestions: ['Add header row and data rows']
    })
    return errors
  }
  
  // Check for consistent column count
  const headerCols = lines[0].split(',').length
  
  lines.forEach((line, idx) => {
    const cols = line.split(',').length
    if (cols !== headerCols && idx > 0) { // Allow header to differ slightly
      errors.push({
        id: `struct-csv-cols-${idx}`,
        line: idx + 1,
        column: null,
        message: `Inconsistent column count: expected ${headerCols}, found ${cols}`,
        type: 'error',
        category: 'structure',
        severity: 'high',
        explanation: `Row has different number of columns than header`,
        confidence: 1.0,
        suggestions: ['Ensure all rows have the same number of columns']
      })
    }
  })
  
  return errors
}

function validateXmlStructure(content: string): ValidationError[] {
  const errors: ValidationError[] = []
  
  // Basic XML structure checks
  const openTags = content.match(/<\w+[^>]*>/g) || []
  const closeTags = content.match(/<\/\w+>/g) || []
  
  if (openTags.length !== closeTags.length) {
    errors.push({
      id: 'struct-xml-tags',
      line: 1,
      column: null,
      message: 'Mismatched XML tags',
      type: 'error',
      category: 'syntax',
      severity: 'critical',
      explanation: `Found ${openTags.length} opening tags but ${closeTags.length} closing tags`,
      confidence: 1.0,
      suggestions: ['Ensure every opening tag has a matching closing tag']
    })
  }
  
  return errors
}

function validateYamlStructure(content: string): ValidationError[] {
  const errors: ValidationError[] = []
  const lines = content.split('\n')
  
  // Check for basic YAML structure
  lines.forEach((line, idx) => {
    if (line.trim() && !line.includes(':') && !line.trim().startsWith('-') && !line.trim().startsWith('#')) {
      errors.push({
        id: `struct-yaml-${idx}`,
        line: idx + 1,
        column: null,
        message: 'Invalid YAML structure',
        type: 'error',
        category: 'syntax',
        severity: 'high',
        explanation: 'Line does not match YAML key:value or list format',
        confidence: 0.9,
        suggestions: ['Ensure proper YAML formatting with key: value pairs']
      })
    }
  })
  
  return errors
}

// ============================================================================
// STAGE 2: Rule-based Semantic Validation
// ============================================================================
async function validateSemantics(
  content: string,
  fileType: string,
  requestId: string
): Promise<ValidationError[]> {
  const errors: ValidationError[] = []
  
  try {
    // Parse content based on type
    let data: any
    
    if (fileType === 'json') {
      try {
        data = JSON.parse(content)
        errors.push(...applySemanticRules(data, fileType))
      } catch {
        // Already caught in structural validation
      }
    } else if (fileType === 'csv') {
      data = parseCsvToObjects(content)
      errors.push(...applySemanticRules(data, fileType))
    }
  } catch (err: any) {
    logger.error('[semantic] Validation failed', err)
  }
  
  logger.info('[semantic] Semantic validation complete', {
    request_id: requestId,
    error_count: errors.length
  })
  
  return errors
}

function parseCsvToObjects(content: string): any[] {
  const lines = content.split('\n').filter(l => l.trim())
  if (lines.length < 2) return []
  
  const headers = lines[0].split(',').map(h => h.trim())
  const data: any[] = []
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim())
    const obj: any = { _line: i + 1 }
    headers.forEach((header, idx) => {
      obj[header] = values[idx] || ''
    })
    data.push(obj)
  }
  
  return data
}

function applySemanticRules(data: any, fileType: string): ValidationError[] {
  const errors: ValidationError[] = []
  
  // Convert to array for uniform processing
  const items = Array.isArray(data) ? data : [data]
  
  items.forEach((item, idx) => {
    const line = item._line || idx + 2 // +2 for header in CSV
    
    // Rule 1: Detect negative values in fields that semantically should be positive
    Object.keys(item).forEach(key => {
      const lowerKey = key.toLowerCase()
      const value = item[key]
      
      // Only flag if field name strongly suggests it should be positive
      const isCountLike = /^(age|price|cost|amount|quantity|count|total|sum|number|num|qty|rate|percent)$/i.test(lowerKey) ||
                         lowerKey.includes('age') || lowerKey.includes('price') || lowerKey.includes('quantity') ||
                         lowerKey.includes('amount') || lowerKey.includes('cost')
      
      if (isCountLike && typeof value === 'number' && value < 0) {
        errors.push({
          id: `sem-negative-${line}-${key}`,
          line,
          column: null,
          message: `${key} cannot be negative: ${value}`,
          type: 'error',
          category: 'impossible_value',
          severity: 'high',
          explanation: `Field "${key}" has negative value ${value}, which is logically impossible`,
          confidence: 1.0,
          suggestions: [`Change ${key} to a positive value`]
        })
      }
      
      // Rule 2: Percentage/rate over 100 (only if field name indicates percentage)
      const isPercentage = /^(percent|percentage|rate|ratio)$/i.test(lowerKey) ||
                          lowerKey.endsWith('_percent') || lowerKey.endsWith('_rate') ||
                          lowerKey.endsWith('percent') || lowerKey.endsWith('rate')
      
      if (isPercentage && typeof value === 'number' && (value > 100 || value < 0)) {
        errors.push({
          id: `sem-percent-${line}-${key}`,
          line,
          column: null,
          message: `${key} out of valid range: ${value}`,
          type: 'error',
          category: 'impossible_value',
          severity: 'high',
          explanation: `Percentage field "${key}" has value ${value} which is outside 0-100 range`,
          confidence: 0.95,
          suggestions: [`Change ${key} to a value between 0 and 100`]
        })
      }
    })
    
    // Rule 3: Date logic - end before start (check various field name patterns)
    const dateFields = Object.keys(item).filter(k => 
      /date|time|timestamp/i.test(k)
    )
    
    for (let i = 0; i < dateFields.length; i++) {
      for (let j = i + 1; j < dateFields.length; j++) {
        const field1 = dateFields[i]
        const field2 = dateFields[j]
        const val1 = item[field1]
        const val2 = item[field2]
        
        // Detect start/end pattern
        const isStartEnd = (/start|begin|from/i.test(field1) && /end|finish|to|until/i.test(field2)) ||
                          (/start|begin|from/i.test(field2) && /end|finish|to|until/i.test(field1))
        
        if (isStartEnd && val1 && val2) {
          const date1 = new Date(val1)
          const date2 = new Date(val2)
          
          if (!isNaN(date1.getTime()) && !isNaN(date2.getTime())) {
            const [startField, endField, startDate, endDate] = 
              /start|begin|from/i.test(field1) ? [field1, field2, date1, date2] : [field2, field1, date2, date1]
            
            if (endDate < startDate) {
              errors.push({
                id: `sem-date-${line}`,
                line,
                column: null,
                message: `${endField} is before ${startField}`,
                type: 'error',
                category: 'logic_error',
                severity: 'high',
                explanation: `End date ${item[endField]} occurs before start date ${item[startField]}`,
                confidence: 1.0,
                suggestions: ['Swap the start and end dates, or correct one of them']
              })
              break
            }
          }
        }
      }
    }
  })
  
  return errors
}

// ============================================================================
// STAGE 3: LLM Validation (Constrained)
// ============================================================================
async function llmValidation(
  content: string,
  fileType: string,
  fileName: string,
  requestId: string,
  maxErrors: number
): Promise<ValidationError[]> {
  try {
    if (!GROQ_API_KEY) {
      logger.error('[llm] GROQ_API_KEY not configured')
      return []
    }

    // Limit content size for LLM
    const MAX_CONTENT = 8000
    const contentPreview = content.length > MAX_CONTENT 
      ? content.slice(0, MAX_CONTENT) + '\n...[truncated]'
      : content

    const prompt = buildConstrainedPrompt(contentPreview, fileType, fileName, maxErrors)

    logger.info('[llm] Calling API', { request_id: requestId, model: GROQ_MODEL })

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        temperature: 0.0, // Most deterministic
        max_tokens: 1000,
        messages: [
          {
            role: 'system',
            content: buildSystemPrompt()
          },
          {
            role: 'user',
            content: prompt
          }
        ],
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      logger.error('[llm] API failed', error)
      return []
    }

    const data = await response.json()
    const raw = data.choices?.[0]?.message?.content ?? ''

    logger.info('[llm] Response received', {
      request_id: requestId,
      response_length: raw.length,
    })

    const errors = parseErrorsFromLLM(raw)
    
    logger.info('[llm] Parsed errors', {
      request_id: requestId,
      error_count: errors.length,
    })

    return errors

  } catch (err) {
    logger.error('[llm] Validation failed', err)
    return []
  }
}

function buildSystemPrompt(): string {
  return `You are a data validator. Find ONLY objectively impossible errors.

OUTPUT: JSON array only. If valid, return []

REPORT ONLY THESE:
• impossible_value: Values that are logically impossible in ANY context
  - Negative values in fields that represent counts/amounts/ages/prices
  - Percentages/rates above 100 or below 0
  - Invalid dates (month=15, day=35, year=2050 for birthdate)
• type_mismatch: Same field has inconsistent types across multiple rows
  - Field is numbers in most rows but text in some rows
• logic_error: Clear logical contradictions
  - End date before start date
  - Total/sum doesn't match itemized values
• missing_critical: Obviously required fields are empty
  - ID fields that are null/empty
  - Keys in key-value structures that are blank

NEVER REPORT:
• Different data types in different fields (completely normal)
• Different units in different rows (normal)
• Any number that could be valid (0, 1, 1000, etc.)
• Text in fields that could be text
• Formatting/style differences
• Anything you're uncertain about

Format: [{"line":5,"message":"quantity is -10","category":"impossible_value","severity":"high"}]

CRITICAL: Only report if 100% certain it's wrong. When in doubt, return []`
}

function buildConstrainedPrompt(content: string, fileType: string, fileName: string, maxErrors: number): string {
  return `${content}

Validate the above ${fileType} data. Find ONLY critical errors (impossible values, clear type mismatches, logic errors).
Return JSON array or [] if valid. Max ${maxErrors} errors.`
}

function parseErrorsFromLLM(llmResponse: string): ValidationError[] {
  try {
    let cleaned = llmResponse.trim()
    
    // Remove markdown code blocks and common prefixes
    cleaned = cleaned.replace(/```json\s*/gi, '').replace(/```\s*/g, '')
    cleaned = cleaned.replace(/^(Here's|Here is|Output:|Result:).*?\n/i, '')
    
    // Check for "no errors" text responses
    if (/^(no errors?|valid|good|looks? good|everything is (fine|ok|valid)|data is valid)$/i.test(cleaned)) {
      return []
    }
    
    // Strategy 1: Try direct JSON parse (if response is clean JSON)
    try {
      const directParse = JSON.parse(cleaned)
      if (Array.isArray(directParse)) {
        return formatErrors(directParse)
      }
    } catch {
      // Continue to strategy 2
    }
    
    // Strategy 2: Extract JSON array with non-greedy match
    let match = cleaned.match(/\[[\s\S]*?\]/)
    if (match) {
      try {
        const parsed = JSON.parse(match[0])
        if (Array.isArray(parsed)) {
          return formatErrors(parsed)
        }
      } catch {
        // Try greedy match
      }
    }
    
    // Strategy 3: Greedy match (get the largest array)
    match = cleaned.match(/\[[\s\S]*\]/)
    if (match) {
      try {
        const parsed = JSON.parse(match[0])
        if (Array.isArray(parsed)) {
          return formatErrors(parsed)
        }
      } catch {
        // Try to extract individual objects
      }
    }
    
    // Strategy 4: Extract individual error objects and build array
    const objectMatches = cleaned.match(/\{[^{}]*"(line|message|category)"[^{}]*\}/g)
    if (objectMatches && objectMatches.length > 0) {
      try {
        const arrayStr = '[' + objectMatches.join(',') + ']'
        const parsed = JSON.parse(arrayStr)
        if (Array.isArray(parsed)) {
          return formatErrors(parsed)
        }
      } catch {
        // Give up
      }
    }
    
    logger.debug('[llm-parser] No valid JSON array found in response')
    return []
    
  } catch (err: any) {
    logger.error('[llm-parser] Failed to parse', err.message)
    return []
  }
}

function formatErrors(errors: any[]): ValidationError[] {
  return errors
    .filter(err => {
      // Filter out invalid/empty error objects
      if (!err || typeof err !== 'object') return false
      if (!err.message && !err.description) return false
      
      // Filter out false positive indicators
      const msg = (err.message || err.description || '').toLowerCase()
      
      // Reject if message suggests uncertainty
      if (msg.includes('might') || msg.includes('could') || msg.includes('possibly')) return false
      if (msg.includes('consider') || msg.includes('suggestion') || msg.includes('recommend')) return false
      
      // Reject common false positives
      if (msg.includes('different types') && msg.includes('row')) return false
      if (msg.includes('inconsistent') && msg.includes('type')) return false
      if (msg.includes('formatting') || msg.includes('style')) return false
      
      return true
    })
    .map((err, idx) => ({
      id: `llm-${idx}`,
      line: err.line || 1,
      column: err.column || null,
      message: err.message || err.description || 'Data quality issue',
      type: 'error' as const,
      category: err.category || 'general',
      severity: (err.severity || 'medium') as 'critical' | 'high' | 'medium' | 'low',
      explanation: err.explanation || err.message || '',
      confidence: 0.75, // LLM errors have lower confidence
      suggestions: Array.isArray(err.suggestions) ? err.suggestions : []
    }))
}

// ============================================================================
// Deduplication
// ============================================================================
function deduplicateErrors(newErrors: ValidationError[], existingErrors: ValidationError[]): ValidationError[] {
  return newErrors.filter(newErr => {
    // Check if similar error already exists
    return !existingErrors.some(existingErr => 
      existingErr.line === newErr.line &&
      existingErr.category === newErr.category &&
      similarity(existingErr.message, newErr.message) > 0.7
    )
  })
}

function similarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2
  const shorter = str1.length > str2.length ? str2 : str1
  
  if (longer.length === 0) return 1.0
  
  return (longer.length - editDistance(longer, shorter)) / longer.length
}

function editDistance(str1: string, str2: string): number {
  const matrix: number[][] = []
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i]
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        )
      }
    }
  }
  
  return matrix[str2.length][str1.length]
}