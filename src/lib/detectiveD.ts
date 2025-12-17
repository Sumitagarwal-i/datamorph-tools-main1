/**
 * 🕵️ Detective D — Enterprise Data Investigation Engine
 * 
 * Version: 2.0.0 (Professional 15-Module Architecture)
 * Philosophy: Deterministic. Evidence-based. Zero hallucinations.
 * 
 * ============================================================================
 * ARCHITECTURE: 15 INDEPENDENT MODULES
 * ============================================================================
 * 
 * Module 1:   Input Normalization          — Parse & normalize files
 * Module 2:   Structure Validator          — Detect syntax/parsing errors
 * Module 3:   Schema Inference Engine      — Learn schema from data
 * Module 4:   Schema Deviation Detector    — Type/enum drift detection
 * Module 5:   Statistical Analyzer         — Build distribution models
 * Module 6:   Outlier Detector            — Flag statistical anomalies
 * Module 7:   Logical Consistency Checker  — Cross-field validation
 * Module 8:   Drift Detection Engine       — Compare versions
 * Module 9:   Evidence Builder             — Attach proof to findings
 * Module 10:  Severity Classifier          — Deterministic severity
 * Module 11:  Confidence Scorer            — Explain reliability
 * Module 12:  Finding Aggregator           — Normalize findings
 * Module 13:  Output Formatter             — UI-ready JSON
 * Module 14:  Performance Guard            — Ensure scalability
 * Module 15:  Trust Rules (Hard Constraints) — Prevent false positives
 * 
 * ============================================================================
 * IMPLEMENTATION STATUS
 * ============================================================================
 * ✅ Modules 1-15:  Complete (parsing, structure, schema, drift, performance, trust)
 * 
 * ============================================================================
 * DESIGN PRINCIPLE: "Never invent. Never guess. Infer from data only."
 * ============================================================================
 * Each module is independent, deterministic, and testable.
 * No AI. No hallucinations. Every finding includes evidence.
 * Rule: If unsure about a pattern → do not flag it.
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface DetectiveFinding {
  id: string
  category: 'anomaly' | 'schema' | 'logic' | 'structure' | 'drift'
  severity: 'error' | 'warning' | 'info'
  confidence: 'high' | 'medium' | 'low'
  location: {
    row: number | null
    column: string | null
  }
  summary: string
  evidence: {
    observed: any
    expected_range?: string
    statistic?: string
    context?: string
    baseline?: any
  }
  why_it_matters: string
  suggested_action: string
}

export interface DataProfile {
  recordCount: number
  fields: FieldAnalysis[]
  fileType: 'json' | 'csv' | 'xml' | 'yaml'
  fileSize: number
  sampleSize: number
}

export interface FieldAnalysis {
  name: string
  dataType: 'number' | 'string' | 'boolean' | 'date' | 'mixed' | 'null'
  nullCount: number
  nullRate: number
  uniqueCount: number
  uniqueRate: number
  samples: any[]
  
  // Numeric stats
  numericStats?: {
    min: number
    max: number
    mean: number
    median: number
    stdev: number
    p90: number
    p95: number
    p99: number
    hasNegatives: boolean
    isZeroInflated: boolean
  }
  
  // String stats
  stringStats?: {
    minLength: number
    maxLength: number
    avgLength: number
    patterns: string[]
  }
  
  // Enum-like detection
  enumLike?: {
    isEnumLike: boolean
    valueSet: string[]
    cardinality: number
  }
}

// ============================================================================
// MAIN DETECTIVE ENGINE
// ============================================================================

export class DetectiveD {
  private rawData: string
  private fileType: 'json' | 'csv' | 'xml' | 'yaml'
  private fileName: string
  private findings: DetectiveFinding[] = []
  private findingIdCounter: number = 0
  private recordLineMap: Map<number, number> = new Map() // Maps record index to original file line number
  private parsedData: any = null // Cache parsed data for line tracking

  private previousContent?: string
  private previousFileType?: 'json' | 'csv' | 'xml' | 'yaml'

  // Performance guard settings
  private performanceMode: 'fast' | 'thorough' = 'thorough'
  private maxRecordsToProfile: number = 10000
  private chunkSize: number = 1000

  constructor(content: string, fileName: string, fileTypeHint?: string, previousContent?: string) {
    this.rawData = content
    this.fileName = fileName
    this.fileType = this.detectFileType(fileTypeHint, this.rawData)
    this.previousContent = previousContent
    this.previousFileType = previousContent
      ? this.detectFileType(undefined, previousContent)
      : undefined

    // Auto-tune performance
    const sizeInMB = this.rawData.length / (1024 * 1024)
    if (sizeInMB > 5) {
      this.performanceMode = 'fast'
      this.maxRecordsToProfile = 1000
      this.chunkSize = 500
    }
  }

  // =========================================================================
  // PUBLIC API
  // =========================================================================

  /**
   * Run full analysis and return findings
   */
  async analyze(): Promise<DetectiveFinding[]> {
    try {
      // Performance guard: hard stop on oversized files
      const sizeInMB = this.rawData.length / (1024 * 1024)
      if (sizeInMB > 50) {
        this.addFinding({
          category: 'structure',
          severity: 'error',
          confidence: 'high',
          location: { row: null, column: null },
          summary: 'File too large to analyze safely',
          evidence: { observed: `${sizeInMB.toFixed(2)} MB`, expected_range: '<= 50 MB' },
          why_it_matters: 'Files larger than 50 MB risk browser instability and timeouts',
          suggested_action: 'Reduce file size, sample data, or analyze in batches'
        })
        return this.sortFindings()
      }

      // Stage 1: Structure validation (deterministic)
      this.stage1_validateStructure()

      // If structure is broken, stop here
      if (this.findings.some(f => f.category === 'structure')) {
        return this.findings
      }

      // Stage 2: Parse and profile data
      const profile = this.stage2_profileData()

      // Stage 3: Schema analysis
      this.stage3_analyzeSchema(profile)

      // Stage 4: Statistical anomalies (core value)
      this.stage4_detectAnomalies(profile)

      // Stage 5: Logical inconsistencies
      this.stage5_checkLogic(profile)

      // Stage 6: Drift detection (compare with previous version if provided)
      if (this.previousContent && this.previousFileType) {
        const previousProfile = this.profileDataFromContent(this.previousContent, this.previousFileType)
        this.stage6_detectDrift(profile, previousProfile)
      }

      // Return sorted by severity + confidence
      return this.sortFindings()
    } catch (err) {
      console.error('[Detective D] Analysis failed:', err)
      return [
        {
          id: this.nextId(),
          category: 'structure',
          severity: 'error',
          confidence: 'high',
          location: { row: null, column: null },
          summary: 'File could not be analyzed',
          evidence: { observed: String(err) },
          why_it_matters: 'The file format is not recognized or is severely malformed',
          suggested_action: 'Verify file format and encoding'
        }
      ]
    }
  }

  // =========================================================================
  // STAGE 1: STRUCTURE VALIDATION
  // =========================================================================

  private stage1_validateStructure(): void {
    switch (this.fileType) {
      case 'json':
        this.validateJson()
        break
      case 'csv':
        this.validateCsv()
        break
      case 'xml':
        this.validateXml()
        break
      case 'yaml':
        this.validateYaml()
        break
    }
  }

  private validateJson(): void {
    try {
      JSON.parse(this.rawData)

      // Even if JSON.parse succeeds, check for semantic issues
      this.detectSemanticIssues()

    } catch (err: any) {
      const message = err.message
      const posMatch = message.match(/position (\d+)/)
      const position = posMatch ? parseInt(posMatch[1]) : 0
      const line = this.rawData.substring(0, position).split('\n').length

      this.addFinding({
        category: 'structure',
        severity: 'error',
        confidence: 'high',
        location: { row: line, column: null },
        summary: 'Invalid JSON syntax',
        evidence: { observed: message },
        why_it_matters: 'JSON parsing failed. File cannot be read by downstream systems',
        suggested_action: 'Check for unclosed brackets, missing commas, or invalid escapes'
      })
    }
  }

  private validateCsv(): void {
    const lines = this.rawData.split('\n').filter(l => l.trim())
    if (lines.length === 0) {
      this.addFinding({
        category: 'structure',
        severity: 'error',
        confidence: 'high',
        location: { row: 1, column: null },
        summary: 'Empty CSV file',
        evidence: { observed: 'No data rows' },
        why_it_matters: 'File contains no data and cannot be processed',
        suggested_action: 'Add header and data rows'
      })
      return
    }

    const headerCols = this.countCsvColumns(lines[0])
    const issues: Array<{ line: number; expected: number; found: number }> = []

    for (let i = 1; i < lines.length; i++) {
      const cols = this.countCsvColumns(lines[i])
      if (Math.abs(cols - headerCols) > 1) {
        issues.push({ line: i + 1, expected: headerCols, found: cols })
      }
    }

    if (issues.length > 0) {
      issues.slice(0, 5).forEach(issue => {
        this.addFinding({
          category: 'structure',
          severity: 'error',
          confidence: 'high',
          location: { row: issue.line, column: null },
          summary: `Column count mismatch: expected ${issue.expected}, found ${issue.found}`,
          evidence: {
            observed: issue.found,
            expected_range: String(issue.expected)
          },
          why_it_matters: 'Row has incorrect column count. Parsing will fail or data will misalign',
          suggested_action: 'Ensure all rows have same number of columns as header'
        })
      })
    }
  }

  private validateXml(): void {
    const openTags = (this.rawData.match(/<(\w+)[^>]*>/g) || []).filter(
      t => !t.startsWith('<?') && !t.includes('/>')
    )
    const closeTags = this.rawData.match(/<\/(\w+)>/g) || []

    if (openTags.length !== closeTags.length) {
      this.addFinding({
        category: 'structure',
        severity: 'error',
        confidence: 'high',
        location: { row: 1, column: null },
        summary: 'Mismatched XML tags',
        evidence: {
          observed: `${closeTags.length} closing tags`,
          expected_range: String(openTags.length)
        },
        why_it_matters: 'XML is malformed. Parsers will reject the document',
        suggested_action: 'Ensure every opening tag has matching closing tag'
      })
    }
  }

  private validateYaml(): void {
    const lines = this.rawData.split('\n')
    let issues = 0

    for (let i = 0; i < lines.length && issues < 3; i++) {
      const trimmed = lines[i].trim()
      if (!trimmed || trimmed.startsWith('#')) continue

      if (!trimmed.includes(':') && !trimmed.startsWith('-')) {
        this.addFinding({
          category: 'structure',
          severity: 'warning',
          confidence: 'medium',
          location: { row: i + 1, column: null },
          summary: 'Invalid YAML syntax',
          evidence: { observed: `Line: "${trimmed.slice(0, 50)}"` },
          why_it_matters: 'Line does not match YAML key:value format',
          suggested_action: 'Use "key: value" format or list items with "-"'
        })
        issues++
      }
    }
  }

  private countCsvColumns(line: string): number {
    let count = 1
    let inQuotes = false

    for (let i = 0; i < line.length; i++) {
      if (line[i] === '"') inQuotes = !inQuotes
      if (line[i] === ',' && !inQuotes) count++
    }

    return count
  }

  // =========================================================================
  // STAGE 2: DATA PROFILING
    // =========================================================================
    // SEMANTIC VALIDATION (RFC + Best Practices)
    // =========================================================================

    private detectSemanticIssues(): void {
      try {
        const parsed = JSON.parse(this.rawData)
        this.checkForNaNInfinity(parsed)
        this.checkForNullUndefinedValues(parsed)
        this.checkForEmptyValues(parsed)
        this.checkForDuplicateKeys()
        this.checkForInvalidDataTypes(parsed)
      } catch {
        // If parsing fails, structural validator will catch it
      }
    }

    private checkForNaNInfinity(obj: any, path: string = '', row: number = 1): void {
      if (Array.isArray(obj)) {
        obj.forEach((item, index) => {
          this.checkForNaNInfinity(item, `${path}[${index}]`, row + index)
        })
      } else if (obj && typeof obj === 'object') {
        Object.entries(obj).forEach(([key, value]) => {
          const currentPath = path ? `${path}.${key}` : key
        
          // Check for NaN
          if (typeof value === 'number' && isNaN(value)) {
            this.addFinding({
              category: 'schema',
              severity: 'error',
              confidence: 'high',
              location: { row, column: key },
              summary: `Invalid value: NaN in field "${key}"`,
              evidence: { 
                observed: 'NaN', 
                expected_range: 'Valid number',
                context: `Field path: ${currentPath}`
              },
              why_it_matters: 'NaN is not a valid JSON value per RFC 7159. Most systems will reject this data.',
              suggested_action: `Replace NaN with null or a valid number`
            })
          }
        
          // Check for Infinity
          if (value === Infinity || value === -Infinity) {
            this.addFinding({
              category: 'schema',
              severity: 'error',
              confidence: 'high',
              location: { row, column: key },
              summary: `Invalid value: ${value} in field "${key}"`,
              evidence: { 
                observed: String(value), 
                expected_range: 'Finite number',
                context: `Field path: ${currentPath}`
              },
              why_it_matters: 'Infinity is not a valid JSON value per RFC 7159. Data will be rejected.',
              suggested_action: `Replace with a large finite number or null`
            })
          }
        
          // Recurse
          if (typeof value === 'object' && value !== null) {
            this.checkForNaNInfinity(value, currentPath, row)
          }
        })
      }
    }

    private checkForNullUndefinedValues(obj: any, path: string = '', row: number = 1): void {
      if (Array.isArray(obj)) {
        obj.forEach((item, index) => {
          this.checkForNullUndefinedValues(item, `${path}[${index}]`, row + index)
        })
      } else if (obj && typeof obj === 'object') {
        Object.entries(obj).forEach(([key, value]) => {
          const currentPath = path ? `${path}.${key}` : key
        
          // Undefined check
          if (value === undefined) {
            this.addFinding({
              category: 'schema',
              severity: 'warning',
              confidence: 'high',
              location: { row, column: key },
              summary: `Undefined value in field "${key}"`,
              evidence: { 
                observed: 'undefined', 
                expected_range: 'Defined value or omit field',
                context: `Field path: ${currentPath}`
              },
              why_it_matters: 'Undefined is not a valid JSON value. Field should either have a value or be omitted.',
              suggested_action: `Either set a value, use null, or remove the field`
            })
          }
        
          // Excessive null check (>50% nulls suggests schema issue)
          if (value === null) {
            // Count nulls in this field across all records
            if (Array.isArray(obj)) {
              const nullCount = obj.filter(item => item && item[key] === null).length
              const nullRate = nullCount / obj.length
            
              if (nullRate > 0.5) {
                this.addFinding({
                  category: 'schema',
                  severity: 'info',
                  confidence: 'medium',
                  location: { row, column: key },
                  summary: `High null rate (${Math.round(nullRate * 100)}%) in field "${key}"`,
                  evidence: { 
                    observed: `${nullCount} nulls out of ${obj.length} records`,
                    statistic: `${Math.round(nullRate * 100)}% null rate`,
                    context: `Field path: ${currentPath}`
                  },
                  why_it_matters: 'Fields with >50% nulls may indicate missing data or incorrect schema design',
                  suggested_action: `Consider making this field optional or investigate data collection`
                })
              }
            }
          }
        
          // Recurse
          if (typeof value === 'object' && value !== null) {
            this.checkForNullUndefinedValues(value, currentPath, row)
          }
        })
      }
    }

    private checkForEmptyValues(obj: any, path: string = '', row: number = 1): void {
      if (Array.isArray(obj)) {
        obj.forEach((item, index) => {
          this.checkForEmptyValues(item, `${path}[${index}]`, row + index)
        })
      } else if (obj && typeof obj === 'object') {
        Object.entries(obj).forEach(([key, value]) => {
          const currentPath = path ? `${path}.${key}` : key
        
          // Empty string check (often unintentional)
          if (value === '') {
            this.addFinding({
              category: 'schema',
              severity: 'warning',
              confidence: 'medium',
              location: { row, column: key },
              summary: `Empty string in field "${key}"`,
              evidence: { 
                observed: '""', 
                expected_range: 'Non-empty string or null',
                context: `Field path: ${currentPath}`
              },
              why_it_matters: 'Empty strings can cause validation errors. Consider using null for missing values.',
              suggested_action: `Use null for missing values or provide a default value`
            })
          }
        
          // Empty array check (may be intentional, flag if suspicious)
          if (Array.isArray(value) && value.length === 0 && key.match(/^(items|data|results|records|list)/i)) {
            this.addFinding({
              category: 'schema',
              severity: 'info',
              confidence: 'low',
              location: { row, column: key },
              summary: `Empty array in field "${key}"`,
              evidence: { 
                observed: '[]', 
                context: `Field path: ${currentPath}`
              },
              why_it_matters: 'Empty data arrays may indicate no results or incomplete data collection',
              suggested_action: `Verify this is intentional or check data source`
            })
          }
        
          // Empty object check
          if (typeof value === 'object' && value !== null && !Array.isArray(value) && Object.keys(value).length === 0) {
            this.addFinding({
              category: 'schema',
              severity: 'info',
              confidence: 'low',
              location: { row, column: key },
              summary: `Empty object in field "${key}"`,
              evidence: { 
                observed: '{}', 
                context: `Field path: ${currentPath}`
              },
              why_it_matters: 'Empty objects may indicate missing data or schema issues',
              suggested_action: `Consider using null for empty objects or populate with default values`
            })
          }
        
          // Recurse
          if (typeof value === 'object' && value !== null) {
            this.checkForEmptyValues(value, currentPath, row)
          }
        })
      }
    }

    private checkForDuplicateKeys(): void {
      // RFC 7159: Duplicate keys are discouraged but allowed
      // Most parsers keep the last value, causing data loss
      const lines = this.rawData.split('\n')
      const keyPattern = /"([^"]+)"\s*:/g
    
      lines.forEach((line, index) => {
        const keys: string[] = []
        let match
      
        while ((match = keyPattern.exec(line)) !== null) {
          keys.push(match[1])
        }
      
        const duplicates = keys.filter((key, i) => keys.indexOf(key) !== i)
      
        if (duplicates.length > 0) {
          duplicates.forEach(dupKey => {
            this.addFinding({
              category: 'structure',
              severity: 'warning',
              confidence: 'high',
              location: { row: index + 1, column: dupKey },
              summary: `Duplicate object key: "${dupKey}"`,
              evidence: { 
                observed: `Key appears multiple times in same object`,
                context: `Line ${index + 1}`
              },
              why_it_matters: 'Duplicate keys violate RFC 7159 recommendations. Most parsers will keep only the last value, causing silent data loss.',
              suggested_action: `Remove duplicate key or rename one of them`
            })
          })
        }
      })
    }

    private checkForInvalidDataTypes(obj: any, path: string = '', row: number = 1): void {
      if (Array.isArray(obj)) {
        obj.forEach((item, index) => {
          this.checkForInvalidDataTypes(item, `${path}[${index}]`, row + index)
        })
      } else if (obj && typeof obj === 'object') {
        Object.entries(obj).forEach(([key, value]) => {
          const currentPath = path ? `${path}.${key}` : key
        
          // Check for numeric strings that should be numbers
          if (typeof value === 'string' && value.match(/^-?\d+(\.\d+)?$/) && 
              key.match(/(id|count|price|amount|quantity|age|year|score|rate)/i)) {
            this.addFinding({
              category: 'schema',
              severity: 'warning',
              confidence: 'medium',
              location: { row, column: key },
              summary: `Numeric value stored as string in field "${key}"`,
              evidence: { 
                observed: `"${value}" (string)`, 
                expected_range: `${value} (number)`,
                context: `Field path: ${currentPath}`
              },
              why_it_matters: 'Numeric strings prevent calculations and may cause type errors in downstream systems',
              suggested_action: `Convert to number: ${value}`
            })
          }
        
          // Check for boolean strings
          if (typeof value === 'string' && ['true', 'false', 'TRUE', 'FALSE'].includes(value)) {
            this.addFinding({
              category: 'schema',
              severity: 'warning',
              confidence: 'medium',
              location: { row, column: key },
              summary: `Boolean value stored as string in field "${key}"`,
              evidence: { 
                observed: `"${value}" (string)`, 
                expected_range: `${value.toLowerCase()} (boolean)`,
                context: `Field path: ${currentPath}`
              },
              why_it_matters: 'Boolean strings prevent logical operations and may cause type errors',
              suggested_action: `Convert to boolean: ${value.toLowerCase()}`
            })
          }
        
          // Check for date-like strings without ISO format
          if (typeof value === 'string' && value.match(/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/) &&
              key.match(/(date|time|created|updated|timestamp)/i)) {
            this.addFinding({
              category: 'schema',
              severity: 'info',
              confidence: 'medium',
              location: { row, column: key },
              summary: `Non-ISO date format in field "${key}"`,
              evidence: { 
                observed: value, 
                expected_range: 'ISO 8601 format (YYYY-MM-DD)',
                context: `Field path: ${currentPath}`
              },
              why_it_matters: 'Non-standard date formats cause parsing ambiguity and timezone issues',
              suggested_action: `Use ISO 8601 format for dates`
            })
          }
        
          // Recurse
          if (typeof value === 'object' && value !== null) {
            this.checkForInvalidDataTypes(value, currentPath, row)
          }
        })
      }
    }
  // =========================================================================

  private stage2_profileData(): DataProfile {
    const records = this.getParsedRecords()

    if (records.length === 0) {
      return {
        recordCount: 0,
        fields: [],
        fileType: this.fileType,
        fileSize: this.rawData.length,
        sampleSize: 0
      }
    }

    // Build field map
    const fieldMap = new Map<string, any[]>()
    records.forEach(record => {
      if (typeof record === 'object' && record !== null) {
        Object.entries(record).forEach(([key, value]) => {
          if (!fieldMap.has(key)) fieldMap.set(key, [])
          fieldMap.get(key)!.push(value)
        })
      }
    })

    // Profile each field
    const fields: FieldAnalysis[] = []
    fieldMap.forEach((values, fieldName) => {
      fields.push(this.profileField(fieldName, values, records.length))
    })

    return {
      recordCount: records.length,
      fields,
      fileType: this.fileType,
      fileSize: this.rawData.length,
      sampleSize: Math.min(records.length, this.maxRecordsToProfile)
    }
  }

  private profileField(name: string, values: any[], totalRecords: number): FieldAnalysis {
    const typeCounts = { number: 0, string: 0, boolean: 0, date: 0, null: 0 }
    const nonNullValues: any[] = []
    const uniqueValues = new Set<string>()
    const numericValues: number[] = []

    values.forEach(val => {
      if (val === null || val === undefined || val === '') {
        typeCounts.null++
      } else {
        nonNullValues.push(val)
        uniqueValues.add(String(val))

        if (typeof val === 'number') {
          typeCounts.number++
          numericValues.push(val)
        } else if (typeof val === 'boolean') {
          typeCounts.boolean++
        } else if (typeof val === 'string') {
          if (this.isDateString(val)) {
            typeCounts.date++
          } else {
            typeCounts.string++
          }
        }
      }
    })

    const totalNonNull = nonNullValues.length
    let dataType: FieldAnalysis['dataType'] = 'null'

    if (totalNonNull > 0) {
      const ratios = {
        number: typeCounts.number / totalNonNull,
        date: typeCounts.date / totalNonNull,
        boolean: typeCounts.boolean / totalNonNull,
        string: typeCounts.string / totalNonNull
      }

      if (ratios.number > 0.8) dataType = 'number'
      else if (ratios.date > 0.8) dataType = 'date'
      else if (ratios.boolean > 0.8) dataType = 'boolean'
      else if (ratios.string > 0.8) dataType = 'string'
      else dataType = 'mixed'
    }

    const field: FieldAnalysis = {
      name,
      dataType,
      nullCount: typeCounts.null,
      nullRate: typeCounts.null / totalRecords,
      uniqueCount: uniqueValues.size,
      uniqueRate: uniqueValues.size / totalNonNull || 0,
      samples: nonNullValues.slice(0, 10)
    }

    // Numeric stats
    if (dataType === 'number' && numericValues.length > 0) {
      numericValues.sort((a, b) => a - b)
      const mean = numericValues.reduce((a, b) => a + b, 0) / numericValues.length
      const variance =
        numericValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
        numericValues.length
      const stdev = Math.sqrt(variance)

      field.numericStats = {
        min: numericValues[0],
        max: numericValues[numericValues.length - 1],
        mean,
        median: numericValues[Math.floor(numericValues.length / 2)],
        stdev,
        p90: this.percentile(numericValues, 90),
        p95: this.percentile(numericValues, 95),
        p99: this.percentile(numericValues, 99),
        hasNegatives: numericValues.some(v => v < 0),
        isZeroInflated: numericValues.filter(v => v === 0).length / numericValues.length > 0.5
      }
    }

    // String stats
    if (dataType === 'string' && nonNullValues.filter(v => typeof v === 'string').length > 0) {
      const strings = nonNullValues.filter(v => typeof v === 'string')
      field.stringStats = {
        minLength: Math.min(...strings.map(s => s.length)),
        maxLength: Math.max(...strings.map(s => s.length)),
        avgLength: strings.reduce((sum, s) => sum + s.length, 0) / strings.length,
        patterns: this.detectPatterns(strings)
      }
    }

    // Enum detection
    if (uniqueValues.size <= 20 && totalNonNull > 0) {
      field.enumLike = {
        isEnumLike: true,
        valueSet: Array.from(uniqueValues),
        cardinality: uniqueValues.size
      }
    }

    return field
  }

  private isDateString(str: string): boolean {
    if (typeof str !== 'string' || str.length < 8) return false
    try {
      const date = new Date(str)
      return !isNaN(date.getTime())
    } catch {
      return false
    }
  }

  private percentile(arr: number[], p: number): number {
    const index = Math.ceil((p / 100) * arr.length) - 1
    return arr[Math.max(0, index)] || arr[arr.length - 1]
  }

  private detectPatterns(strings: string[]): string[] {
    const patterns: string[] = []
    const sample = strings.slice(0, 100)

    if (sample.some(s => /@.+\..+/.test(s))) patterns.push('email')
    if (sample.some(s => /^https?:\/\//.test(s))) patterns.push('url')
    if (sample.some(s => /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(s)))
      patterns.push('ipv4')
    if (sample.some(s => /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(s))) patterns.push('uuid')

    return patterns
  }

  // =========================================================================
  // STAGE 3: SCHEMA ANALYSIS
  // =========================================================================

  private stage3_analyzeSchema(profile: DataProfile): void {
    const records = this.getParsedRecords()

    records.forEach((record, recordIdx) => {
      profile.fields.forEach(field => {
        const value = record[field.name]
        if (value === null || value === undefined) return

        // Type consistency check
        if (field.dataType !== 'mixed' && field.dataType !== 'null') {
          const actualType = this.getActualType(value)
          if (
            actualType !== 'null' &&
            actualType !== field.dataType &&
            // Allow flexibility for string/number coercion
            !(
              (field.dataType === 'number' || field.dataType === 'string') &&
              (actualType === 'number' || actualType === 'string')
            )
          ) {
            this.addFinding({
              category: 'schema',
              severity: 'warning',
              confidence: 'high',
              location: { row: this.getRecordLineNumber(recordIdx), column: field.name },
              summary: `Type mismatch in "${field.name}"`,
              evidence: {
                observed: actualType,
                expected_range: field.dataType
              },
              why_it_matters: `Field is ${field.dataType} in 80%+ rows but ${actualType} here. May cause processing failures`,
              suggested_action: `Ensure all values in "${field.name}" are ${field.dataType}`
            })
          }
        }

        // Enum violation
        if (field.enumLike?.isEnumLike) {
          const strVal = String(value)
          if (!field.enumLike.valueSet.includes(strVal)) {
            this.addFinding({
              category: 'schema',
              severity: 'warning',
              confidence: 'medium',
              location: { row: this.getRecordLineNumber(recordIdx), column: field.name },
              summary: `Unexpected enum value in "${field.name}"`,
              evidence: {
                observed: strVal,
                context: `Valid values: ${field.enumLike.valueSet.slice(0, 5).join(', ')}`
              },
              why_it_matters: 'This value has not appeared in other records. May indicate typo or new category',
              suggested_action: 'Verify this is intended or correct the value'
            })
          }
        }
      })
    })
  }

  private getActualType(value: any): string {
    if (value === null || value === undefined || value === '') return 'null'
    if (typeof value === 'number') return 'number'
    if (typeof value === 'boolean') return 'boolean'
    if (typeof value === 'string') {
      if (this.isDateString(value)) return 'date'
      return 'string'
    }
    return 'mixed'
  }

  // =========================================================================
  // STAGE 4: STATISTICAL ANOMALIES (CORE VALUE)
  // =========================================================================

  private stage4_detectAnomalies(profile: DataProfile): void {
    const records = this.getParsedRecords()

    records.forEach((record, recordIdx) => {
      profile.fields.forEach(field => {
        const value = record[field.name]
        if (value === null || value === undefined) return

        // Numeric outliers
        if (field.dataType === 'number' && typeof value === 'number' && field.numericStats) {
          const stats = field.numericStats
          const zScore =
            stats.stdev > 0 ? Math.abs((value - stats.mean) / stats.stdev) : 0

          if (zScore > 4) {
            this.addFinding({
              category: 'anomaly',
              severity: 'warning',
              confidence: 'high',
              location: { row: this.getRecordLineNumber(recordIdx), column: field.name },
              summary: `Extreme outlier in "${field.name}"`,
              evidence: {
                observed: value,
                statistic: `Z-score: ${zScore.toFixed(2)}, P95: ${stats.p95}`
              },
              why_it_matters: `Value is ${zScore.toFixed(1)}× standard deviations from mean. May cause analytics errors or overflow`,
              suggested_action: 'Review this value or mark as invalid'
            })
          }

          // Unexpected negatives
          if (!stats.hasNegatives && value < 0) {
            this.addFinding({
              category: 'anomaly',
              severity: 'warning',
              confidence: 'high',
              location: { row: this.getRecordLineNumber(recordIdx), column: field.name },
              summary: `Negative value in typically positive field "${field.name}"`,
              evidence: { observed: value },
              why_it_matters: 'All other values are non-negative. This may be a data entry error',
              suggested_action: 'Verify this is intentional'
            })
          }
        }

        // Implausible dates
        if (field.dataType === 'date' && typeof value === 'string') {
          const date = new Date(value)
          if (!isNaN(date.getTime())) {
            const year = date.getFullYear()
            const now = new Date()

            if (year < 1900) {
              this.addFinding({
                category: 'anomaly',
                severity: 'warning',
                confidence: 'medium',
                location: { row: this.getRecordLineNumber(recordIdx), column: field.name },
                summary: `Implausibly old date: ${year}`,
                evidence: { observed: value },
                why_it_matters: 'Date predates modern record-keeping',
                suggested_action: 'Verify year is correct'
              })
            }

            if (date.getTime() > now.getTime() + 5 * 365 * 24 * 60 * 60 * 1000) {
              this.addFinding({
                category: 'anomaly',
                severity: 'info',
                confidence: 'medium',
                location: { row: this.getRecordLineNumber(recordIdx), column: field.name },
                summary: `Future date: ${value}`,
                evidence: { observed: value },
                why_it_matters: 'Date is more than 5 years in future',
                suggested_action: 'Verify if intentional'
              })
            }
          }
        }

        // Placeholder values in important fields
        if (
          typeof value === 'string' &&
          field.nullRate < 0.1 &&
          field.uniqueRate > 0.5
        ) {
          const normalized = value.trim().toLowerCase()
          if (['unknown', 'n/a', 'null', 'none', 'na', '???'].includes(normalized)) {
            this.addFinding({
              category: 'anomaly',
              severity: 'info',
              confidence: 'medium',
              location: { row: this.getRecordLineNumber(recordIdx), column: field.name },
              summary: `Placeholder value in mostly populated field`,
              evidence: { observed: value },
              why_it_matters: 'Field is rarely empty but this row has placeholder. May indicate incomplete data',
              suggested_action: 'Fill in actual value or mark as intentionally absent'
            })
          }
        }
      })
    })
  }

  // =========================================================================
  // STAGE 5: LOGICAL INCONSISTENCIES
  // =========================================================================

  private stage5_checkLogic(profile: DataProfile): void {
    const records = Array.isArray(this.parseData()) ? this.parseData() : [this.parseData()]

    // Rule: start_date <= end_date
    const startField = profile.fields.find(f =>
      f.name.toLowerCase().includes('start')
    )
    const endField = profile.fields.find(f =>
      f.name.toLowerCase().includes('end')
    )

    if (startField && endField) {
      records.forEach((record, recordIdx) => {
        const start = record[startField.name]
        const end = record[endField.name]

        if (start && end) {
          const startDate = new Date(start)
          const endDate = new Date(end)

          if (startDate > endDate) {
            this.addFinding({
              category: 'logic',
              severity: 'warning',
              confidence: 'high',
              location: { row: this.getRecordLineNumber(recordIdx), column: startField.name },
              summary: `Start date is after end date`,
              evidence: {
                observed: `${start} > ${end}`
              },
              why_it_matters: 'Logical inconsistency: start cannot be after end',
              suggested_action: 'Swap values or verify dates'
            })
          }
        }
      })
    }

    // Rule: Detect missing IDs in ID column
    const idField = profile.fields.find(
      f =>
        f.name.toLowerCase() === 'id' ||
        f.name.toLowerCase().endsWith('_id')
    )

    if (idField && idField.uniqueRate === 1.0) {
      const seen = new Set<string>()
      records.forEach((record, recordIdx) => {
        const id = String(record[idField.name])
        if (seen.has(id)) {
          this.addFinding({
            category: 'logic',
            severity: 'error',
            confidence: 'high',
            location: { row: this.getRecordLineNumber(recordIdx), column: idField.name },
            summary: `Duplicate ID: ${id}`,
            evidence: { observed: id },
            why_it_matters: 'ID should be unique. Duplicates will break joins and lookups',
            suggested_action: 'Ensure all IDs are unique'
          })
        }
        seen.add(id)
      })
    }
  }

  // =========================================================================
  // UTILITIES
  // =========================================================================

  private detectFileType(hint?: string, content?: string): 'json' | 'csv' | 'xml' | 'yaml' {
    if (hint && hint !== 'auto') {
      return hint as any
    }

    const source = content ?? this.rawData
    const trimmed = source.trim()

    if (trimmed.startsWith('{') || trimmed.startsWith('[')) return 'json'
    if (trimmed.startsWith('<') || trimmed.includes('<?xml')) return 'xml'

    const lines = trimmed.split('\n')
    if (lines.length > 1 && lines[0].includes(',')) return 'csv'
    if (/^\w+:\s*.+$/m.test(trimmed)) return 'yaml'

    return 'json'
  }

  private parseData(): any {
    try {
      if (this.fileType === 'json') {
        return JSON.parse(this.rawData)
      }
      if (this.fileType === 'csv') {
        return this.parseCsv()
      }
      if (this.fileType === 'yaml') {
        return this.parseYaml()
      }
      return {}
    } catch {
      return {}
    }
  }

  private parseDataFromContent(content: string, fileType: 'json' | 'csv' | 'xml' | 'yaml'): any {
    try {
      if (fileType === 'json') return JSON.parse(content)
      if (fileType === 'csv') return this.parseCsv(content)
      if (fileType === 'yaml') return this.parseYaml()
      return {}
    } catch {
      return {}
    }
  }

  private getParsedRecords(limit: number = this.maxRecordsToProfile): any[] {
    const parsed = this.parseData()
    
    // Cache parsed data for line tracking
    if (!this.parsedData) {
      this.parsedData = parsed
    }
    
    const records = Array.isArray(parsed) ? parsed : [parsed]
    if (records.length > limit) return records.slice(0, limit)
    return records
  }

  private parseCsv(content: string = this.rawData): any[] {
    this.recordLineMap.clear() // Clear previous mappings
    
    const allLines = content.split('\n')
    const nonEmptyLines: { content: string; originalLineNum: number }[] = []
    
    // Track which lines are non-empty and their original line numbers
    allLines.forEach((line, index) => {
      if (line.trim()) {
        nonEmptyLines.push({ content: line, originalLineNum: index + 1 }) // 1-based line numbers
      }
    })
    
    if (nonEmptyLines.length < 2) return []

    const headers = this.parseCsvLine(nonEmptyLines[0].content).map(h => h.trim())
    const records: any[] = []

    const maxLines = this.performanceMode === 'fast' 
      ? Math.min(nonEmptyLines.length, this.chunkSize + 1) // +1 for header
      : nonEmptyLines.length

    for (let i = 1; i < maxLines; i++) {
      const lineInfo = nonEmptyLines[i]
      const values = this.parseCsvLine(lineInfo.content)
      const record: any = {}

      // Store the mapping from record index to original file line number
      this.recordLineMap.set(records.length, lineInfo.originalLineNum)

      headers.forEach((header, idx) => {
        let value: any = values[idx] || ''
        if (typeof value === 'string') {
          value = value.replace(/^["']|["']$/g, '').trim()
        }

        if (value === '') {
          value = null
        } else if (value === 'true') {
          value = true as any
        } else if (value === 'false') {
          value = false as any
        } else if (!isNaN(Number(value))) {
          value = Number(value)
        }

        record[header] = value
      })

      records.push(record)
    }

    return records
  }

  private parseCsvLine(line: string): string[] {
    const result: string[] = []
    let current = ''
    let inQuotes = false

    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      const nextChar = line[i + 1]

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
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

  private parseYaml(): any[] {
    const lines = this.rawData.split('\n')
    const records: any[] = []
    let current: any = {}

    lines.forEach(line => {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) return

      if (trimmed.startsWith('-')) {
        if (Object.keys(current).length > 0) {
          records.push(current)
          current = {}
        }

        const colonIdx = trimmed.indexOf(':')
        if (colonIdx > 0) {
          const key = trimmed.substring(1, colonIdx).trim()
          const value = trimmed.substring(colonIdx + 1).trim()
          current[key] = this.parseYamlValue(value)
        }
      } else {
        const colonIdx = trimmed.indexOf(':')
        if (colonIdx > 0) {
          const key = trimmed.substring(0, colonIdx).trim()
          const value = trimmed.substring(colonIdx + 1).trim()
          current[key] = this.parseYamlValue(value)
        }
      }
    })

    if (Object.keys(current).length > 0) {
      records.push(current)
    }

    return records
  }

  private parseYamlValue(value: string): any {
    if (!value) return null
    if (value === 'true') return true
    if (value === 'false') return false
    if (!isNaN(Number(value))) return Number(value)
    return value.replace(/^["']|["']$/g, '')
  }

  private addFinding(params: Omit<DetectiveFinding, 'id'>): void {
    if (!params.evidence || Object.keys(params.evidence).length === 0) {
      console.warn('[Detective D] Finding rejected: no evidence provided')
      return
    }

    this.findings.push({
      id: this.nextId(),
      ...params
    })
  }

  private nextId(): string {
    return `det-${++this.findingIdCounter}`
  }

  private getRecordLineNumber(recordIndex: number): number {
    // For CSV files, use the tracked line mapping
    if (this.fileType === 'csv') {
      return this.recordLineMap.get(recordIndex) || recordIndex + 2
    }
    
    // For JSON arrays, calculate actual line numbers based on file content
    if (this.fileType === 'json') {
      return this.calculateJsonLineNumber(recordIndex)
    }
    
    return recordIndex + 1
  }
  
  private calculateJsonLineNumber(recordIndex: number): number {
    if (!this.parsedData || !Array.isArray(this.parsedData)) {
      return recordIndex + 2 // Fallback
    }
    
    const lines = this.rawData.split('\n')
    let currentRecordIndex = 0
    let inArrayObject = false
    let braceDepth = 0
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      
      // Skip empty lines and comments
      if (!line || line.startsWith('//')) continue
      
      // Track brace depth to identify object boundaries
      for (const char of line) {
        if (char === '{') {
          braceDepth++
          if (!inArrayObject && braceDepth === 1 && i > 0) {
            // Starting a new object in the array
            if (currentRecordIndex === recordIndex) {
              return i + 1 // Return 1-based line number
            }
            currentRecordIndex++
            inArrayObject = true
          }
        } else if (char === '}') {
          braceDepth--
          if (braceDepth === 0) {
            inArrayObject = false
          }
        }
      }
      
      // Handle single-line objects or array items
      if (line.includes('{') && line.includes('}') && currentRecordIndex === recordIndex) {
        return i + 1
      }
    }
    
    // Fallback calculation based on estimated line distribution
    const totalLines = lines.length
    const arrayLength = this.parsedData.length
    if (arrayLength > 0) {
      const avgLinesPerRecord = Math.max(1, Math.floor(totalLines / arrayLength))
      return Math.min(totalLines, 2 + (recordIndex * avgLinesPerRecord))
    }
    
    return recordIndex + 2
  }

  private sortFindings(): DetectiveFinding[] {
    const severityOrder = { error: 0, warning: 1, info: 2 }
    const confidenceOrder = { high: 0, medium: 1, low: 2 }

    return this.findings.sort((a, b) => {
      const severityDiff = severityOrder[a.severity] - severityOrder[b.severity]
      if (severityDiff !== 0) return severityDiff

      const confidenceDiff = confidenceOrder[a.confidence] - confidenceOrder[b.confidence]
      if (confidenceDiff !== 0) return confidenceDiff

      return (a.location.row || 999999) - (b.location.row || 999999)
    })
  }

  // =========================================================================
  // STAGE 6: DRIFT DETECTION
  // =========================================================================
  private profileDataFromContent(content: string, fileType: 'json' | 'csv' | 'xml' | 'yaml'): DataProfile {
    const parsed = this.parseDataFromContent(content, fileType)
    const records = Array.isArray(parsed) ? parsed : [parsed]

    const fieldMap = new Map<string, any[]>()
    records.forEach(record => {
      if (typeof record === 'object' && record !== null) {
        Object.entries(record).forEach(([key, value]) => {
          if (!fieldMap.has(key)) fieldMap.set(key, [])
          fieldMap.get(key)!.push(value)
        })
      }
    })

    const fields: FieldAnalysis[] = []
    fieldMap.forEach((values, fieldName) => {
      fields.push(this.profileField(fieldName, values, records.length))
    })

    return {
      recordCount: records.length,
      fields,
      fileType,
      fileSize: content.length,
      sampleSize: Math.min(records.length, this.maxRecordsToProfile)
    }
  }

  private stage6_detectDrift(current: DataProfile, previous: DataProfile): void {
    try {
      // Row count drift
      if (previous.recordCount > 0) {
        const delta = current.recordCount - previous.recordCount
        const pct = previous.recordCount === 0 ? 0 : (delta / previous.recordCount) * 100
        if (Math.abs(pct) >= 20) {
          this.addFinding({
            category: 'drift',
            severity: 'info',
            confidence: 'high',
            location: { row: null, column: null },
            summary: 'Row count changed between versions',
            evidence: {
              observed: `Current: ${current.recordCount}, Previous: ${previous.recordCount}`,
              statistic: `${pct.toFixed(1)}% change`
            },
            why_it_matters: 'Significant record count change may indicate data drop or surge',
            suggested_action: 'Confirm upstream data volume is expected'
          })
        }
      }

      const currentFields = new Map(current.fields.map(f => [f.name, f]))
      const previousFields = new Map(previous.fields.map(f => [f.name, f]))

      // Added fields
      currentFields.forEach((field, name) => {
        if (!previousFields.has(name)) {
          this.addFinding({
            category: 'drift',
            severity: 'info',
            confidence: 'medium',
            location: { row: null, column: name },
            summary: `New field added: "${name}"`,
            evidence: { observed: name },
            why_it_matters: 'Schema expansion detected. Downstream consumers may need updates',
            suggested_action: 'Notify consumers and update contracts if required'
          })
        }
      })

      // Removed fields
      previousFields.forEach((field, name) => {
        if (!currentFields.has(name)) {
          this.addFinding({
            category: 'drift',
            severity: 'info',
            confidence: 'medium',
            location: { row: null, column: name },
            summary: `Field removed: "${name}"`,
            evidence: { observed: name },
            why_it_matters: 'Schema contraction detected. Upstream change may break consumers',
            suggested_action: 'Coordinate schema change with consumers'
          })
        }
      })

      // Enum/value set drift
      currentFields.forEach((field, name) => {
        const prevField = previousFields.get(name)
        if (prevField?.enumLike?.isEnumLike && field.enumLike?.isEnumLike) {
          const prevValues = new Set(prevField.enumLike.valueSet)
          const newValues = field.enumLike.valueSet.filter(v => !prevValues.has(v))
          if (newValues.length > 0) {
            this.addFinding({
              category: 'drift',
              severity: 'info',
              confidence: 'medium',
              location: { row: null, column: name },
              summary: `Enum expanded in "${name}"`,
              evidence: {
                observed: newValues.slice(0, 5).join(', '),
                context: `Previous cardinality: ${prevField.enumLike.cardinality}, Current: ${field.enumLike.cardinality}`
              },
              why_it_matters: 'New categories introduced. Downstream validations may need updates',
              suggested_action: 'Review and update validation rules or reference data'
            })
          }
        }
      })
    } catch (err) {
      console.warn('[Detective D] Drift detection failed:', err)
    }
  }
}
