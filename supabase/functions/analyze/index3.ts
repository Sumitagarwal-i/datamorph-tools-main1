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
  rule_id: string
}

interface DataProfile {
  recordCount: number
  fields: FieldProfile[]
  hasNumericFields: boolean
  hasDateFields: boolean
  hasIdFields: boolean
}

interface SemanticCandidate {
  line: number
  field?: string
  value: string
  suspicion: string
}

interface FieldProfile {
  name: string
  dataType: 'number' | 'string' | 'boolean' | 'date' | 'mixed' | 'null'
  nullCount: number
  nullRate: number
  uniqueCount: number
  uniqueRate: number
  samples: any[]
  numericStats?: {
    min: number
    max: number
    mean: number
    hasNegatives: boolean
  }
  stringStats?: {
    minLength: number
    maxLength: number
    avgLength: number
    commonPatterns: string[]
  }
}

const logger = {
  info: (msg: string, data?: any) => console.log(`[INFO] ${msg}`, data || ''),
  error: (msg: string, err?: any) => console.error(`[ERROR] ${msg}`, err || ''),
  debug: (msg: string, data?: any) => console.log(`[DEBUG] ${msg}`, data || ''),
}

const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY') || ''
const GROQ_MODEL = Deno.env.get('GROQ_MODEL') || 'llama-3.1-8b-instant'

// ============================================================================
// MAIN HANDLER
// ============================================================================

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const requestId = crypto.randomUUID()
    const startTime = Date.now()

    logger.info('[analyze] Request received', { request_id: requestId })

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

    logger.info('[analyze] Starting validation', {
      request_id: requestId,
      file_type: fileType,
      content_length: body.content.length,
    })

    const errors: ValidationError[] = []
    
    // STAGE 1: Syntax/Structure validation (always deterministic)
    const structuralErrors = validateStructure(body.content, fileType)
    errors.push(...structuralErrors)

    // If structure is broken, stop here
    if (structuralErrors.length > 0) {
      logger.info('[analyze] Structure invalid, stopping', {
        request_id: requestId,
        error_count: structuralErrors.length
      })
      
      return buildResponse(requestId, fileName, fileType, body.content.length, errors, startTime)
    }

    // STAGE 2: Profile the data (understand what we're dealing with)
    const dataProfile = profileData(body.content, fileType)
    
    logger.info('[analyze] Data profiled', {
      request_id: requestId,
      record_count: dataProfile.recordCount,
      field_count: dataProfile.fields.length,
    })

    // STAGE 3: Apply universal rules (work for ANY data)
    const ruleErrors = applyUniversalRules(body.content, fileType, dataProfile)
    errors.push(...ruleErrors)

    // STAGE 4: LLM validation (for complex semantic patterns)
    const shouldUseLLM = errors.length < 30 && body.content.length < 15000
    
    if (shouldUseLLM && GROQ_API_KEY) {
      const llmErrors = await llmValidation(body.content, fileType, dataProfile, errors, requestId)
      
      // Deduplicate and filter
      const dedupedErrors = deduplicateErrors(llmErrors, errors)
      const filteredErrors = filterUniversalFalsePositives(dedupedErrors)
      
      errors.push(...filteredErrors)
    }

    // Sort and limit
    const sortedErrors = errors
      .sort((a, b) => {
        const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 }
        if (severityOrder[a.severity] !== severityOrder[b.severity]) {
          return severityOrder[a.severity] - severityOrder[b.severity]
        }
        return a.line - b.line
      })
      .slice(0, body.max_errors || 100)

    logger.info('[analyze] Complete', {
      request_id: requestId,
      total_errors: sortedErrors.length,
      by_confidence: {
        high: sortedErrors.filter(e => e.confidence >= 0.9).length,
        medium: sortedErrors.filter(e => e.confidence >= 0.7 && e.confidence < 0.9).length,
        low: sortedErrors.filter(e => e.confidence < 0.7).length,
      },
      latency_ms: Date.now() - startTime,
    })

    return buildResponse(requestId, fileName, fileType, body.content.length, sortedErrors, startTime)

  } catch (error: any) {
    logger.error('[analyze] Fatal error', error)
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

function buildResponse(
  requestId: string,
  fileName: string,
  fileType: string,
  contentLength: number,
  errors: ValidationError[],
  startTime: number
): Response {
  return new Response(
    JSON.stringify({
      request_id: requestId,
      file_name: fileName,
      file_type: fileType,
      content_length: contentLength,
      errors,
      summary: {
        total_errors: errors.filter((e) => e.type === 'error').length,
        total_warnings: errors.filter((e) => e.type === 'warning').length,
        by_confidence: {
          certain: errors.filter(e => e.confidence >= 0.95).length,
          likely: errors.filter(e => e.confidence >= 0.8 && e.confidence < 0.95).length,
          possible: errors.filter(e => e.confidence < 0.8).length,
        },
        analysis_time_ms: Date.now() - startTime,
      },
    }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  )
}

// ============================================================================
// FILE TYPE DETECTION
// ============================================================================

function detectFileType(content: string, hint?: string): 'json' | 'csv' | 'xml' | 'yaml' {
  if (hint && hint !== 'auto') return hint as any

  const trimmed = content.trim()
  
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return 'json'
  if (trimmed.startsWith('<') || trimmed.includes('<?xml')) return 'xml'
  
  const lines = trimmed.split('\n')
  if (lines.length > 1 && lines[0].includes(',')) return 'csv'
  if (/^\w+:\s*.+$/m.test(trimmed)) return 'yaml'
  
  return 'json'
}

// ============================================================================
// STAGE 1: STRUCTURAL VALIDATION (Format-Specific)
// ============================================================================

function validateStructure(content: string, fileType: string): ValidationError[] {
  switch (fileType) {
    case 'json': return validateJsonStructure(content)
    case 'csv': return validateCsvStructure(content)
    case 'xml': return validateXmlStructure(content)
    case 'yaml': return validateYamlStructure(content)
    default: return []
  }
}

function validateJsonStructure(content: string): ValidationError[] {
  try {
    JSON.parse(content)
    return []
  } catch (err: any) {
    const match = err.message.match(/position (\d+)/)
    const position = match ? parseInt(match[1]) : 0
    const line = content.substring(0, position).split('\n').length
    
    return [{
      id: 'struct-json-1',
      line,
      column: null,
      message: 'Invalid JSON syntax',
      type: 'error',
      category: 'syntax',
      severity: 'critical',
      explanation: err.message,
      confidence: 1.0,
      suggestions: ['Check for missing quotes, commas, or brackets'],
      rule_id: 'json-syntax'
    }]
  }
}

function validateCsvStructure(content: string): ValidationError[] {
  const errors: ValidationError[] = []
  const lines = content.split('\n').filter(l => l.trim())
  
  if (lines.length === 0) {
    return [{
      id: 'struct-csv-empty',
      line: 1,
      column: null,
      message: 'Empty CSV file',
      type: 'error',
      category: 'structure',
      severity: 'critical',
      explanation: 'File contains no data',
      confidence: 1.0,
      suggestions: ['Add header row and data rows'],
      rule_id: 'csv-empty'
    }]
  }
  
  const headerCols = countCsvColumns(lines[0])
  
  lines.forEach((line, idx) => {
    if (idx === 0) return
    const cols = countCsvColumns(line)
    
    if (Math.abs(cols - headerCols) > 1) { // Allow 1 column difference for trailing commas
      errors.push({
        id: `struct-csv-cols-${idx}`,
        line: idx + 1,
        column: null,
        message: `Column count mismatch: expected ${headerCols}, found ${cols}`,
        type: 'error',
        category: 'structure',
        severity: 'high',
        explanation: 'Row has different number of columns than header',
        confidence: 1.0,
        suggestions: ['Ensure all rows have the same number of columns'],
        rule_id: 'csv-column-count'
      })
    }
  })
  
  return errors
}

function countCsvColumns(line: string): number {
  let count = 1
  let inQuotes = false
  
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') inQuotes = !inQuotes
    if (line[i] === ',' && !inQuotes) count++
  }
  
  return count
}

function validateXmlStructure(content: string): ValidationError[] {
  const openTags = (content.match(/<(\w+)[^>]*>/g) || []).filter(t => !t.startsWith('<?') && !t.includes('/>'))
  const closeTags = content.match(/<\/(\w+)>/g) || []
  
  if (openTags.length !== closeTags.length) {
    return [{
      id: 'struct-xml-tags',
      line: 1,
      column: null,
      message: 'Mismatched XML tags',
      type: 'error',
      category: 'syntax',
      severity: 'critical',
      explanation: `Found ${openTags.length} opening tags but ${closeTags.length} closing tags`,
      confidence: 1.0,
      suggestions: ['Ensure every opening tag has a matching closing tag'],
      rule_id: 'xml-tags'
    }]
  }
  
  return []
}

function validateYamlStructure(content: string): ValidationError[] {
  const errors: ValidationError[] = []
  const lines = content.split('\n')
  
  lines.forEach((line, idx) => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) return
    
    if (!trimmed.includes(':') && !trimmed.startsWith('-')) {
      errors.push({
        id: `struct-yaml-${idx}`,
        line: idx + 1,
        column: null,
        message: 'Invalid YAML syntax',
        type: 'error',
        category: 'syntax',
        severity: 'high',
        explanation: 'Line does not match YAML key:value or list format',
        confidence: 0.9,
        suggestions: ['Use key: value format or list items with -'],
        rule_id: 'yaml-syntax'
      })
    }
  })
  
  return errors
}

// ============================================================================
// STAGE 2: DATA PROFILING (Universal - works for any data)
// ============================================================================

function profileData(content: string, fileType: string): DataProfile {
  let records: any[] = []
  
  // Parse based on file type
  try {
    if (fileType === 'json') {
      const parsed = JSON.parse(content)
      records = Array.isArray(parsed) ? parsed : [parsed]
    } else if (fileType === 'csv') {
      records = parseCsv(content)
    } else if (fileType === 'yaml') {
      records = parseYamlSimple(content)
    }
  } catch (err) {
    return { recordCount: 0, fields: [], hasNumericFields: false, hasDateFields: false, hasIdFields: false }
  }
  
  if (records.length === 0) {
    return { recordCount: 0, fields: [], hasNumericFields: false, hasDateFields: false, hasIdFields: false }
  }
  
  // Collect all field names
  const fieldMap = new Map<string, any[]>()
  records.forEach(record => {
    if (typeof record === 'object' && record !== null) {
      Object.entries(record).forEach(([key, value]) => {
        if (key === '_line') return
        if (!fieldMap.has(key)) fieldMap.set(key, [])
        fieldMap.get(key)!.push(value)
      })
    }
  })
  
  // Profile each field
  const fields: FieldProfile[] = []
  let hasNumericFields = false
  let hasDateFields = false
  let hasIdFields = false
  
  fieldMap.forEach((values, fieldName) => {
    const profile = profileField(fieldName, values, records.length)
    fields.push(profile)
    
    if (profile.dataType === 'number') hasNumericFields = true
    if (profile.dataType === 'date') hasDateFields = true
    if (fieldName.toLowerCase() === 'id' || fieldName.toLowerCase().endsWith('_id')) hasIdFields = true
  })
  
  return {
    recordCount: records.length,
    fields,
    hasNumericFields,
    hasDateFields,
    hasIdFields
  }
}

function profileField(name: string, values: any[], totalRecords: number): FieldProfile {
  const typeCounts = { number: 0, string: 0, boolean: 0, date: 0, null: 0, object: 0 }
  const nonNullValues: any[] = []
  const uniqueValues = new Set<any>()
  
  values.forEach(val => {
    if (val === null || val === undefined || val === '') {
      typeCounts.null++
    } else {
      nonNullValues.push(val)
      uniqueValues.add(JSON.stringify(val))
      
      const type = typeof val
      if (type === 'number') {
        typeCounts.number++
      } else if (type === 'boolean') {
        typeCounts.boolean++
      } else if (type === 'string') {
        // Check if it's a date
        if (isDateString(val)) {
          typeCounts.date++
        } else {
          typeCounts.string++
        }
      } else if (type === 'object') {
        typeCounts.object++
      }
    }
  })
  
  // Determine dominant data type
  let dataType: 'number' | 'string' | 'boolean' | 'date' | 'mixed' | 'null' = 'null'
  const totalNonNull = nonNullValues.length
  
  if (totalNonNull === 0) {
    dataType = 'null'
  } else if (typeCounts.number / totalNonNull > 0.8) {
    dataType = 'number'
  } else if (typeCounts.date / totalNonNull > 0.8) {
    dataType = 'date'
  } else if (typeCounts.boolean / totalNonNull > 0.8) {
    dataType = 'boolean'
  } else if (typeCounts.string / totalNonNull > 0.8) {
    dataType = 'string'
  } else {
    dataType = 'mixed'
  }
  
  const profile: FieldProfile = {
    name,
    dataType,
    nullCount: typeCounts.null,
    nullRate: typeCounts.null / totalRecords,
    uniqueCount: uniqueValues.size,
    uniqueRate: uniqueValues.size / nonNullValues.length || 0,
    samples: nonNullValues.slice(0, 10)
  }
  
  // Add numeric stats if numeric field
  if (dataType === 'number') {
    const numbers = nonNullValues.filter(v => typeof v === 'number')
    if (numbers.length > 0) {
      profile.numericStats = {
        min: Math.min(...numbers),
        max: Math.max(...numbers),
        mean: numbers.reduce((a, b) => a + b, 0) / numbers.length,
        hasNegatives: numbers.some(n => n < 0)
      }
    }
  }
  
  // Add string stats if string field
  if (dataType === 'string') {
    const strings = nonNullValues.filter(v => typeof v === 'string')
    if (strings.length > 0) {
      profile.stringStats = {
        minLength: Math.min(...strings.map(s => s.length)),
        maxLength: Math.max(...strings.map(s => s.length)),
        avgLength: strings.reduce((sum, s) => sum + s.length, 0) / strings.length,
        commonPatterns: detectPatterns(strings)
      }
    }
  }
  
  return profile
}

function isDateString(str: string): boolean {
  if (typeof str !== 'string') return false
  const date = new Date(str)
  return !isNaN(date.getTime()) && str.length >= 8 // Basic date validation
}

function detectPatterns(strings: string[]): string[] {
  const patterns: string[] = []
  const sample = strings.slice(0, 50)
  
  // Email pattern
  if (sample.some(s => /@.+\..+/.test(s))) patterns.push('email')
  
  // URL pattern
  if (sample.some(s => /^https?:\/\//.test(s))) patterns.push('url')
  
  // Phone pattern  
  if (sample.some(s => /[\d\s\-\(\)]{10,}/.test(s))) patterns.push('phone')
  
  // UUID pattern
  if (sample.some(s => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s))) patterns.push('uuid')
  
  return patterns
}

// ============================================================================
// STAGE 3: UNIVERSAL RULES (Work for ANY data type)
// ============================================================================

function applyUniversalRules(content: string, fileType: string, profile: DataProfile): ValidationError[] {
  const errors: ValidationError[] = []
  
  const records = parseRecords(content, fileType)
  if (records.length === 0) return errors
  
  records.forEach((record, idx) => {
    const line = record._line || idx + 2
    
    profile.fields.forEach(fieldProfile => {
      const fieldName = fieldProfile.name
      const value = record[fieldName]
      
      // RULE 1: Type consistency within same field
      if (fieldProfile.dataType !== 'mixed' && fieldProfile.dataType !== 'null') {
        const actualType = getActualType(value)
        
        if (actualType !== 'null' && actualType !== fieldProfile.dataType) {
          // Type mismatch
          errors.push({
            id: `rule-type-${line}-${fieldName}`,
            line,
            column: null,
            message: `Type mismatch in "${fieldName}": expected ${fieldProfile.dataType}, got ${actualType}`,
            type: 'error',
            category: 'type_mismatch',
            severity: 'high',
            explanation: `This field is ${fieldProfile.dataType} in most records, but ${actualType} here`,
            confidence: 0.95,
            suggestions: [`Convert value to ${fieldProfile.dataType} type`],
            rule_id: 'type-consistency'
          })
        }
      }
      
      // RULE 2: Negative numbers in typically-positive numeric fields
      if (fieldProfile.dataType === 'number' && typeof value === 'number' && value < 0) {
        const lowerName = fieldName.toLowerCase()
        
        // Only flag if field name suggests it should be positive
        if (fieldProfile.numericStats && !fieldProfile.numericStats.hasNegatives) {
          // This field has NO other negative values
          errors.push({
            id: `rule-negative-${line}-${fieldName}`,
            line,
            column: null,
            message: `Unexpected negative value in "${fieldName}": ${value}`,
            type: 'warning',
            category: 'suspicious_value',
            severity: 'medium',
            explanation: `This field contains no other negative values in the dataset`,
            confidence: 0.85,
            suggestions: [`Verify if ${value} is correct`],
            rule_id: 'negative-outlier'
          })
        }
      }
      
      // RULE 3: Pattern violations in string fields
      if (fieldProfile.dataType === 'string' && value && typeof value === 'string' && fieldProfile.stringStats) {
        const patterns = fieldProfile.stringStats.commonPatterns
        
        // Email field without @ symbol
        if (patterns.includes('email') && !value.includes('@')) {
          errors.push({
            id: `rule-pattern-${line}-${fieldName}`,
            line,
            column: null,
            message: `Invalid email format in "${fieldName}": "${value}"`,
            type: 'error',
            category: 'format',
            severity: 'medium',
            explanation: `This field contains emails but this value is not valid`,
            confidence: 0.9,
            suggestions: [`Use valid email format: user@domain.com`],
            rule_id: 'email-format'
          })
        }
        
        // URL field without http
        if (patterns.includes('url') && !/^https?:\/\//.test(value)) {
          errors.push({
            id: `rule-url-${line}-${fieldName}`,
            line,
            column: null,
            message: `Invalid URL format in "${fieldName}": "${value}"`,
            type: 'warning',
            category: 'format',
            severity: 'low',
            explanation: `This field contains URLs but this value doesn't start with http:// or https://`,
            confidence: 0.8,
            suggestions: [`Add http:// or https:// prefix`],
            rule_id: 'url-format'
          })
        }
      }
      
      // RULE 4: Invalid dates in date fields
      if (fieldProfile.dataType === 'date' && value && typeof value === 'string') {
        const date = new Date(value)
        if (isNaN(date.getTime())) {
          errors.push({
            id: `rule-date-${line}-${fieldName}`,
            line,
            column: null,
            message: `Invalid date format in "${fieldName}": "${value}"`,
            type: 'error',
            category: 'format',
            severity: 'medium',
            explanation: `This field contains dates but this value cannot be parsed`,
            confidence: 0.95,
            suggestions: [`Use ISO format: YYYY-MM-DD`],
            rule_id: 'date-format'
          })
        }
      }
      
      // RULE 5: Suspiciously high null rate for non-optional fields
      if (fieldProfile.uniqueRate > 0.5 && fieldProfile.nullRate < 0.1) {
        // This field appears important (high uniqueness, low nulls normally)
        if (value === null || value === undefined || value === '') {
          errors.push({
            id: `rule-missing-${line}-${fieldName}`,
            line,
            column: null,
            message: `Missing value in "${fieldName}"`,
            type: 'warning',
            category: 'completeness',
            severity: 'low',
            explanation: `This field is rarely empty in other records`,
            confidence: 0.7,
            suggestions: [`Provide a value for ${fieldName}`],
            rule_id: 'missing-important-field'
          })
        }
      }
    })
    
    // RULE 6: Duplicate ID detection (universal - works for any ID field)
    if (profile.hasIdFields) {
      const idFields = profile.fields.filter(f => 
        f.name.toLowerCase() === 'id' || f.name.toLowerCase().endsWith('_id')
      )
      
      idFields.forEach(idField => {
        const idValue = record[idField.name]
        if (idValue && idField.uniqueRate < 1.0) {
          // IDs should be unique but aren't
          const duplicateCount = records.filter(r => r[idField.name] === idValue).length
          if (duplicateCount > 1) {
            errors.push({
              id: `rule-dup-id-${line}-${idField.name}`,
              line,
              column: null,
              message: `Duplicate ${idField.name}: "${idValue}"`,
              type: 'error',
              category: 'uniqueness',
              severity: 'critical',
              explanation: `ID values must be unique, but this appears ${duplicateCount} times`,
              confidence: 1.0,
              suggestions: [`Ensure each ${idField.name} is unique`],
              rule_id: 'duplicate-id'
            })
          }
        }
      })
    }
  })
  
  return errors
}

function getActualType(value: any): string {
  if (value === null || value === undefined || value === '') return 'null'
  if (typeof value === 'number') return 'number'
  if (typeof value === 'boolean') return 'boolean'
  if (typeof value === 'string') {
    if (isDateString(value)) return 'date'
    return 'string'
  }
  return 'mixed'
}

// ============================================================================
// STAGE 4: LLM VALIDATION (Domain-Specific Semantics)
// ============================================================================

async function llmValidation(
  content: string,
  fileType: string,
  profile: DataProfile,
  existingErrors: ValidationError[],
  requestId: string
): Promise<ValidationError[]> {
  try {
    const records = parseRecords(content, fileType)
    if (records.length === 0) return []

    const candidates = generateSemanticCandidates(records, profile)
      .slice(0, 8) // keep prompt count small for reliability

    if (candidates.length === 0) return []

    const llmErrors: ValidationError[] = []

    for (const candidate of candidates) {
      const sampleContext = buildSampleContext(records, candidate.line, 2)
      const prompt = buildSemanticVerificationPrompt(sampleContext, candidate)

      const verdict = await verifyCandidateWithLLM(prompt)

      if (!verdict || verdict.is_error !== true) continue

      const confidence = Math.max(0, Math.min(1, typeof verdict.confidence === 'number' ? verdict.confidence : 0.6))

      llmErrors.push({
        id: `llm-${candidate.line}-${candidate.field || 'field'}`,
        line: candidate.line,
        column: null,
        message: verdict.reason || candidate.suspicion,
        type: 'warning',
        category: 'semantic',
        severity: confidence >= 0.9 ? 'high' : confidence >= 0.75 ? 'medium' : 'low',
        explanation: candidate.suspicion,
        confidence,
        suggestions: [],
        rule_id: 'llm-verify'
      })
    }

    logger.info('[llm] Verification complete', { request_id: requestId, candidates: candidates.length, confirmed: llmErrors.length })

    return llmErrors

  } catch (err) {
    logger.error('[llm] Failed', err)
    return []
  }
}

function buildSemanticVerificationPrompt(
  sampleContext: string,
  candidate: {
    line: number
    field?: string
    value: string
    suspicion: string
  }
): string {
  return `
You are verifying ONE possible data issue.

IMPORTANT:
- You are NOT searching for errors.
- You are ONLY verifying the candidate below.
- If the value is reasonable, normal, or ambiguous, return is_error=false.
- If unsure, return is_error=false.

Candidate:
Line: ${candidate.line}
Field: ${candidate.field ?? "N/A"}
Value: "${candidate.value}"
Why it was flagged: ${candidate.suspicion}

Context (surrounding rows):
${sampleContext}

Answer ONLY in JSON:
{
  "is_error": boolean,
  "confidence": number,
  "reason": string
}

Rules:
- Do NOT apply general assumptions
- Do NOT invent domain rules
- Do NOT infer intent
- Normal values are NOT errors
- Percentages are valid unless clearly impossible
`
}

async function verifyCandidateWithLLM(prompt: string) {
  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          {
            role: "system",
            content: "You are a strict verifier. You only confirm or reject a candidate issue."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0,
        max_tokens: 200
      })
    })

    if (!response.ok) {
      logger.error('[llm] API failed', await response.text())
      return null
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content
    if (!content) return null

    const parsed = JSON.parse(content)
    if (typeof parsed !== 'object' || parsed === null) return null

    return {
      is_error: !!parsed.is_error,
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0,
      reason: typeof parsed.reason === 'string' ? parsed.reason : ''
    }
  } catch (err) {
    logger.error('[llm] Verify failed', err)
    return null
  }
}

function generateSemanticCandidates(records: any[], profile: DataProfile): SemanticCandidate[] {
  const candidates: SemanticCandidate[] = []

  records.forEach((record, idx) => {
    const line = record._line || idx + 2

    profile.fields.forEach(field => {
      const value = record[field.name]
      if (value === null || value === undefined || value === '') return

      // Numeric outliers and unexpected negatives
      if (field.dataType === 'number' && typeof value === 'number' && field.numericStats) {
        const mean = field.numericStats.mean || 0
        if (mean > 0 && Math.abs(value) > Math.abs(mean) * 10 && Math.abs(value) > 1000) {
          candidates.push({
            line,
            field: field.name,
            value: String(value),
            suspicion: `Numeric outlier in ${field.name} relative to peers`
          })
        }

        if (!field.numericStats.hasNegatives && value < 0) {
          candidates.push({
            line,
            field: field.name,
            value: String(value),
            suspicion: `Unexpected negative value for typically positive field ${field.name}`
          })
        }
      }

      // Dates far outside plausible ranges
      if (field.dataType === 'date' && typeof value === 'string') {
        const date = new Date(value)
        const futureThreshold = Date.now() + 5 * 365 * 24 * 60 * 60 * 1000
        if (!isNaN(date.getTime())) {
          const year = date.getFullYear()
          if (year < 1900 || date.getTime() > futureThreshold) {
            candidates.push({
              line,
              field: field.name,
              value,
              suspicion: `Date ${value} is far outside normal range`
            })
          }
        }
      }

      // Placeholder strings in otherwise populated fields
      if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase()
        if (['unknown', 'n/a', 'null', 'none'].includes(normalized) && field.nullRate < 0.1) {
          candidates.push({
            line,
            field: field.name,
            value,
            suspicion: `Placeholder text in mostly populated field ${field.name}`
          })
        }
      }
    })
  })

  // Deduplicate candidates by line+field+value
  const seen = new Set<string>()
  return candidates.filter(c => {
    const key = `${c.line}-${c.field || 'field'}-${c.value}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function buildSampleContext(records: any[], targetLine: number, radius: number): string {
  const rows = records
    .filter(r => typeof r === 'object')
    .sort((a, b) => (a._line || 0) - (b._line || 0))

  const targetIndex = rows.findIndex(r => (r._line || 0) === targetLine)
  const start = Math.max(0, targetIndex - radius)
  const end = Math.min(rows.length, targetIndex + radius + 1)

  return rows.slice(start, end)
    .map(r => `Line ${(r._line || '?')}: ${JSON.stringify(r).slice(0, 400)}`)
    .join('\n')
}

// ============================================================================
// FILTERING AND DEDUPLICATION
// ============================================================================

function filterUniversalFalsePositives(errors: ValidationError[]): ValidationError[] {
  return errors.filter(err => {
    const msg = err.message.toLowerCase()
    
    // Universal false positive patterns (work for ANY data type)
    const falsePositivePatterns = [
      // Variation patterns
      /different.*(?:unit|value|type|format).*(?:in|across|between).*(?:row|item|record)/i,
      /(?:unit|value|type).*(?:differs|different|vary|varies|inconsistent).*(?:row|item)/i,
      /(?:various|multiple|mixed).*(?:unit|value|type).*(?:row|item)/i,
      
      // "Should be same" patterns
      /should.*(?:same|consistent|uniform).*(?:across|between)/i,
      /expected.*(?:same|consistent|uniform)/i,
      
      // Comparison patterns
      /(?:mismatch|inconsistency).*between.*(?:row|item|record)/i,
      
      // Style/format preferences (not errors)
      /(?:formatting|style|convention).*(?:inconsistent|different)/i,
    ]
    
    if (falsePositivePatterns.some(p => p.test(msg))) {
      logger.debug('[filter] Rejected false positive', { message: msg })
      return false
    }
    
    // Must have clear error indicator for low-confidence errors
    if (err.confidence < 0.8) {
      const hasErrorIndicator = 
        msg.includes('invalid') ||
        msg.includes('impossible') ||
        msg.includes('missing') ||
        msg.includes('exceed') ||
        msg.includes('negative') && (msg.includes('age') || msg.includes('price') || msg.includes('quantity')) ||
        /\b(?:cannot|can't|must not|should not)\b/i.test(msg)
      
      if (!hasErrorIndicator) {
        logger.debug('[filter] Rejected low-confidence without indicator', { message: msg })
        return false
      }
    }
    
    return true
  })
}

function deduplicateErrors(newErrors: ValidationError[], existingErrors: ValidationError[]): ValidationError[] {
  return newErrors.filter(newErr => {
    return !existingErrors.some(existing => {
      // Same line + similar message = duplicate
      if (existing.line !== newErr.line) return false
      
      const msgSimilarity = similarity(existing.message, newErr.message)
      return msgSimilarity > 0.6
    })
  })
}

function similarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase()
  const s2 = str2.toLowerCase()
  
  if (s1 === s2) return 1.0
  
  const longer = s1.length > s2.length ? s1 : s2
  const shorter = s1.length > s2.length ? s2 : s1
  
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

// ============================================================================
// PARSING UTILITIES
// ============================================================================

function parseRecords(content: string, fileType: string): any[] {
  try {
    if (fileType === 'json') {
      const parsed = JSON.parse(content)
      return Array.isArray(parsed) ? parsed : [parsed]
    }
    if (fileType === 'csv') {
      return parseCsv(content)
    }
    if (fileType === 'yaml') {
      return parseYamlSimple(content)
    }
    return []
  } catch {
    return []
  }
}

function parseCsv(content: string): any[] {
  const lines = content.split('\n').filter(l => l.trim())
  if (lines.length < 2) return []
  
  const headers = parseCsvLine(lines[0]).map(h => h.trim())
  const records: any[] = []
  
  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i])
    const record: any = { _line: i + 1 }
    
    headers.forEach((header, idx) => {
      let value: any = values[idx] || ''
      
      // Remove quotes
      if (typeof value === 'string') {
        value = value.replace(/^["']|["']$/g, '').trim()
      }
      
      // Try to infer type
      if (value === '') {
        value = null
      } else if (value === 'true' || value === 'TRUE') {
        value = true
      } else if (value === 'false' || value === 'FALSE') {
        value = false
      } else if (!isNaN(Number(value)) && value !== '') {
        value = Number(value)
      }
      
      record[header] = value
    })
    
    records.push(record)
  }
  
  return records
}

function parseCsvLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    const nextChar = line[i + 1]
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += char
    }
  }
  
  result.push(current)
  return result
}

function parseYamlSimple(content: string): any[] {
  // Very basic YAML parser - returns array of objects for simple YAML
  const lines = content.split('\n')
  const records: any[] = []
  let currentRecord: any = {}
  
  lines.forEach(line => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) return
    
    if (trimmed.startsWith('-')) {
      // New list item
      if (Object.keys(currentRecord).length > 0) {
        records.push(currentRecord)
        currentRecord = {}
      }
      const colonIdx = trimmed.indexOf(':')
      if (colonIdx > 0) {
        const key = trimmed.substring(1, colonIdx).trim()
        const value = trimmed.substring(colonIdx + 1).trim()
        currentRecord[key] = parseYamlValue(value)
      }
    } else {
      const colonIdx = trimmed.indexOf(':')
      if (colonIdx > 0) {
        const key = trimmed.substring(0, colonIdx).trim()
        const value = trimmed.substring(colonIdx + 1).trim()
        currentRecord[key] = parseYamlValue(value)
      }
    }
  })
  
  if (Object.keys(currentRecord).length > 0) {
    records.push(currentRecord)
  }
  
  return records.length > 0 ? records : [currentRecord]
}

function parseYamlValue(value: string): any {
  if (!value) return null
  if (value === 'true') return true
  if (value === 'false') return false
  if (!isNaN(Number(value))) return Number(value)
  return value.replace(/^["']|["']$/g, '')
}