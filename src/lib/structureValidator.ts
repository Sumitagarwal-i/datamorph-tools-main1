/**
 * 🔧 Structure Validator & Auto-Fixer
 * 
 * Validates and automatically repairs structural/syntax errors in data files
 * before semantic analysis. Based on RFC 7159 (JSON), RFC 4180 (CSV), 
 * and W3C XML standards.
 * 
 * Philosophy: Fix only structural issues that have single unambiguous solutions.
 * Never modify semantics or guess business logic.
 */

export interface StructureIssue {
  id: string
  type: 'error' | 'warning'
  pattern: string // Error pattern name (e.g., 'TRAILING_COMMA', 'UNCLOSED_QUOTE')
  line: number
  column: number
  message: string
  originalText: string
  suggestedFix: string
  canAutoFix: boolean
  evidence: {
    observed: string
    context: string
    ruleViolated: string
  }
}

export interface StructureValidationResult {
  isValid: boolean
  issues: StructureIssue[]
  fixedContent?: string // Only if auto-fixes were applied
  summary: {
    totalIssues: number
    errors: number
    warnings: number
    autoFixable: number
  }
}

export class StructureValidator {
  private content: string
  private fileType: 'json' | 'csv' | 'xml' | 'yaml'
  private issues: StructureIssue[] = []
  private issueIdCounter = 0

  constructor(content: string, fileType: 'json' | 'csv' | 'xml' | 'yaml') {
    this.content = content
    this.fileType = fileType
  }

  /**
   * Main validation entry point
   */
  public validate(): StructureValidationResult {
    this.issues = []
    this.issueIdCounter = 0

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

    const errors = this.issues.filter(i => i.type === 'error').length
    const warnings = this.issues.filter(i => i.type === 'warning').length
    const autoFixable = this.issues.filter(i => i.canAutoFix).length

    return {
      isValid: errors === 0,
      issues: this.issues,
      summary: {
        totalIssues: this.issues.length,
        errors,
        warnings,
        autoFixable
      }
    }
  }

  /**
   * Apply all auto-fixes and return corrected content
   */
  public autoFix(): string {
    let fixed = this.content
    const fixableIssues = this.issues.filter(i => i.canAutoFix)
    
    // Sort by line number (descending) to avoid offset issues
    fixableIssues.sort((a, b) => b.line - a.line)

    for (const issue of fixableIssues) {
      fixed = this.applyFix(fixed, issue)
    }

    return fixed
  }

  // =========================================================================
  // JSON VALIDATION & FIXES (RFC 7159 Compliant)
  // =========================================================================

  private validateJson(): void {
    try {
      JSON.parse(this.content)
      // If parsing succeeds, check for warnings (non-fatal issues)
      this.checkJsonWarnings()
      return
    } catch (err: any) {
      this.analyzeJsonError(err)
      // After analyzing the immediate parse failure, also run a broader
      // scan for trailing commas so users can see multiple structural
      // issues at once instead of one opaque 'unknown' error.
      try {
        this.detectAllTrailingCommas()
      } catch (e) {
        // Non-fatal - detection best-effort only
      }
    }
  }

  private analyzeJsonError(err: Error): void {
    const message = err.message
    // Try several common variants of parser error messages and fall back
    // to the last numeric token in the message as a final attempt.
    const posMatch = message.match(/position\s+(\d+)/i)
      || message.match(/at position\s+(\d+)/i)
      || message.match(/position:\s*(\d+)/i)
      || message.match(/(\d+)(?![\s\S]*\d)/)
    const position = posMatch ? parseInt(posMatch[1] || posMatch[0]) : 0
    const lineInfo = this.getLineAndColumn(position)

    // Pattern detection and auto-fix suggestions
    if (message.includes('Unexpected token } in JSON') || message.includes("Unexpected token }")) {
      this.detectTrailingComma(position, '}')
    } else if (message.includes('Unexpected token ] in JSON')) {
      this.detectTrailingComma(position, ']')
    } else if (message.includes('Unexpected token')) {
      this.detectUnexpectedToken(position, message)
    } else if (message.includes('Unexpected end of JSON input')) {
      this.detectUnexpectedEnd(position)
    } else if (message.includes('Unexpected string')) {
      this.detectMissingComma(position)
    } else {
      // Generic structural error
      this.addIssue({
        type: 'error',
        pattern: 'GENERIC_SYNTAX_ERROR',
        line: lineInfo.line,
        column: lineInfo.column,
        message: `JSON syntax error: ${message}`,
        originalText: this.getContextAroundPosition(position),
        suggestedFix: 'Manual review required',
        canAutoFix: false,
        evidence: {
          observed: message,
          context: this.getContextAroundPosition(position),
          ruleViolated: 'RFC 7159 JSON Grammar'
        }
      })
    }
  }

  // Scan the whole document for trailing commas and add issues for each
  private detectAllTrailingCommas(): void {
    const regex = /,(?=\s*[\}\]])/g
    let match: RegExpExecArray | null
    const seen = new Set<number>()
    while ((match = regex.exec(this.content)) !== null) {
      const commaPos = match.index
      // Avoid duplicate issues for the same position
      if (seen.has(commaPos)) continue
      seen.add(commaPos)
      const commaLineInfo = this.getLineAndColumn(commaPos)
      this.addIssue({
        type: 'error',
        pattern: 'TRAILING_COMMA',
        line: commaLineInfo.line,
        column: commaLineInfo.column,
        message: 'Trailing comma before closing bracket',
        originalText: this.getLineText(commaLineInfo.line),
        suggestedFix: 'Remove trailing comma',
        canAutoFix: true,
        evidence: {
          observed: ',',
          context: this.getContextAroundPosition(commaPos, 40),
          ruleViolated: 'RFC 7159 Trailing comma'
        }
      })
    }
  }

  private detectTrailingComma(position: number, closingChar: string, lineInfo?: { line: number; column: number }): void {
    const beforeClosing = this.content.substring(0, position).trimEnd()
    if (beforeClosing.endsWith(',')) {
      const commaPos = beforeClosing.length - 1
      const commaLineInfo = this.getLineAndColumn(commaPos)
      
      this.addIssue({
        type: 'error',
        pattern: closingChar === '}' ? 'OBJECT_TRAILING_COMMA' : 'ARRAY_TRAILING_COMMA',
        line: commaLineInfo.line,
        column: commaLineInfo.column,
        message: `Trailing comma before ${closingChar}`,
        originalText: this.getLineText(commaLineInfo.line),
        suggestedFix: 'Remove trailing comma',
        canAutoFix: true,
        evidence: {
          observed: `,${closingChar}`,
          context: `RFC 7159: Trailing commas not permitted`,
          ruleViolated: 'RFC 7159 Section 2 (Grammar)'
        }
      })
    }
  }

  private detectUnexpectedToken(position: number, message: string, lineInfo?: { line: number; column: number }): void {
    const finalLineInfo = lineInfo || this.getLineAndColumn(position)
    let tokenMatch = message.match(/Unexpected token\s+(.+?)\s+in JSON/i)
    if (!tokenMatch) tokenMatch = message.match(/Unexpected token\s+(.+?)\s+at position/i)
    let token = tokenMatch ? tokenMatch[1] : ''
    // If token still not found, derive from surrounding text to avoid 'unknown'.
    if (!token) {
      const ctx = this.getContextAroundPosition(position, 8).trim()
      token = ctx ? ctx[0] : 'unknown'
    }
    
    // CRITICAL FIX: [ and { are VALID at document start
    // If [ or { appears at the very beginning, it's a valid JSON root
    const trimmedStart = this.content.trimStart()
    if (position === 0 && (token === '[' || token === '{')) {
      // This is actually valid JSON. The error might be from something later.
      // Don't report this as an error - likely a nested structural issue.
      return
    }
    
    // Check for common patterns
    if (token === ',' && this.isAfterClosingBrace(position)) {
      // Comma after object/array in wrong context
      this.addIssue({
        type: 'error',
        pattern: 'MISPLACED_COMMA',
        line: finalLineInfo.line,
        column: finalLineInfo.column,
        message: 'Comma in wrong position',
        originalText: this.getLineText(finalLineInfo.line),
        suggestedFix: 'Remove or relocate comma',
        canAutoFix: true,
        evidence: {
          observed: token,
          context: this.getContextAroundPosition(position, 40),
          ruleViolated: 'RFC 7159 Structural Grammar'
        }
      })
    } else {
      this.addIssue({
        type: 'error',
        pattern: 'UNEXPECTED_TOKEN',
        line: finalLineInfo.line,
        column: finalLineInfo.column,
        message: `Unexpected ${token}`,
        originalText: this.getLineText(finalLineInfo.line),
        suggestedFix: `Remove or correct ${token}`,
        canAutoFix: false,
        evidence: {
          observed: token,
          context: this.getContextAroundPosition(position, 40),
          ruleViolated: 'RFC 7159 Token Grammar'
        }
      })
    }
  }

  private detectUnexpectedEnd(position: number, lineInfo?: { line: number; column: number }): void {
    const finalLineInfo = lineInfo || this.getLineAndColumn(position)
    
    // Check for unclosed structures
    const openBraces = (this.content.match(/\{/g) || []).length
    const closeBraces = (this.content.match(/\}/g) || []).length
    const openBrackets = (this.content.match(/\[/g) || []).length
    const closeBrackets = (this.content.match(/\]/g) || []).length
    
    let suggestion = 'Add missing closing character'
    let canFix = false
    
    if (openBraces > closeBraces) {
      suggestion = `Add ${openBraces - closeBraces} closing brace(s) }`
      canFix = true
    } else if (openBrackets > closeBrackets) {
      suggestion = `Add ${openBrackets - closeBrackets} closing bracket(s) ]`
      canFix = true
    }
    
    this.addIssue({
      type: 'error',
      pattern: 'UNEXPECTED_END',
      line: finalLineInfo.line,
      column: finalLineInfo.column,
      message: 'Unexpected end of input',
      originalText: this.content.slice(-50), // Last 50 chars
      suggestedFix: suggestion,
      canAutoFix: canFix,
      evidence: {
        observed: 'EOF',
        context: `Open braces: ${openBraces}, Close braces: ${closeBraces}`,
        ruleViolated: 'RFC 7159 Complete Structure'
      }
    })
  }

  private detectMissingComma(position: number, lineInfo?: { line: number; column: number }): void {
    const finalLineInfo = lineInfo || this.getLineAndColumn(position)
    
    // For missing comma, the error is usually reported at the NEXT property
    // But the fix is needed at the PREVIOUS line. Try to find the previous property line.
    let fixLine = finalLineInfo.line
    let fixColumn = finalLineInfo.column
    
    // Check if previous line ends with a value (no comma)
    if (finalLineInfo.line > 1) {
      const prevLine = this.getLineText(finalLineInfo.line - 1)
      if (prevLine && !prevLine.trim().endsWith(',') && !prevLine.trim().endsWith('{') && !prevLine.trim().endsWith('[')) {
        fixLine = finalLineInfo.line - 1
        fixColumn = prevLine.length
      }
    }
    
    this.addIssue({
      type: 'error',
      pattern: 'MISSING_COMMA',
      line: fixLine,
      column: fixColumn,
      message: 'Missing comma after property value',
      originalText: this.getLineText(fixLine),
      suggestedFix: 'Add comma after the value',
      canAutoFix: true,
      evidence: {
        observed: 'Property without trailing comma',
        context: `Missing comma before line ${finalLineInfo.line}`,
        ruleViolated: 'RFC 7159 Object Grammar'
      }
    })
  }

  private checkJsonWarnings(): void {
    // Check for duplicate keys (RFC 7159 discourages but allows)
    this.checkDuplicateKeys()
    
    // Check for non-standard formatting
    this.checkJsonFormatting()
  }

  private checkDuplicateKeys(): void {
    const lines = this.content.split('\n')
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
          this.addIssue({
            type: 'warning',
            pattern: 'DUPLICATE_OBJECT_KEY',
            line: index + 1,
            column: 1,
            message: `Duplicate object key: "${dupKey}"`,
            originalText: line,
            suggestedFix: 'Remove duplicate or rename one key',
            canAutoFix: false,
            evidence: {
              observed: `Key appears multiple times: "${dupKey}"`,
              context: 'RFC 7159: Member names should be unique',
              ruleViolated: 'RFC 7159 Section 4 (Objects)'
            }
          })
        })
      }
    })
  }

  private checkJsonFormatting(): void {
    // Check for inconsistent indentation (warning only)
    const lines = this.content.split('\n')
    let expectedIndent = 0
    let inconsistentFound = false
    
    lines.forEach((line, index) => {
      if (line.trim() === '') return
      
      const indent = line.length - line.trimStart().length
      const trimmed = line.trim()
      
      // Simple indentation check
      if (trimmed.includes('{') || trimmed.includes('[')) {
        if (!inconsistentFound && indent !== expectedIndent) {
          inconsistentFound = true
        }
        expectedIndent += 2
      }
      if (trimmed.includes('}') || trimmed.includes(']')) {
        expectedIndent = Math.max(0, expectedIndent - 2)
      }
    })
    
    if (inconsistentFound) {
      this.addIssue({
        type: 'warning',
        pattern: 'INCONSISTENT_INDENTATION',
        line: 1,
        column: 1,
        message: 'Inconsistent indentation detected',
        originalText: 'Multiple lines',
        suggestedFix: 'Auto-format with consistent 2-space indentation',
        canAutoFix: true,
        evidence: {
          observed: 'Mixed indentation levels',
          context: 'Not required by RFC but affects readability',
          ruleViolated: 'Style Convention'
        }
      })
    }
  }

  // =========================================================================
  // CSV VALIDATION & FIXES (RFC 4180 Compliant)
  // =========================================================================

  private validateCsv(): void {
    const lines = this.content.split('\n')
    if (lines.length === 0) {
      this.addIssue({
        type: 'error',
        pattern: 'EMPTY_FILE',
        line: 1,
        column: 1,
        message: 'Empty CSV file',
        originalText: '',
        suggestedFix: 'Add header row and data',
        canAutoFix: false,
        evidence: {
          observed: 'No content',
          context: 'CSV requires at least a header row',
          ruleViolated: 'RFC 4180 Basic Structure'
        }
      })
      return
    }

    const headerCols = this.countCsvColumns(lines[0])
    
    // Check each line for column count mismatch
    lines.forEach((line, index) => {
      if (line.trim() === '') return // Skip empty lines
      
      const cols = this.countCsvColumns(line)
      if (Math.abs(cols - headerCols) > 0) {
        this.addIssue({
          type: 'error',
          pattern: 'CSV_COLUMN_MISMATCH',
          line: index + 1,
          column: 1,
          message: `Column count mismatch: expected ${headerCols}, found ${cols}`,
          originalText: line,
          suggestedFix: cols < headerCols ? 'Add missing columns' : 'Remove extra columns',
          canAutoFix: cols < headerCols, // Can add empty columns
          evidence: {
            observed: `${cols} columns`,
            context: `Header has ${headerCols} columns`,
            ruleViolated: 'RFC 4180 Record Structure'
          }
        })
      }
      
      // Check for unescaped quotes
      this.checkCsvQuoting(line, index + 1)
    })
  }

  private checkCsvQuoting(line: string, lineNumber: number): void {
    // Simple quote validation - more complex parsing would be needed for full RFC 4180
    let inQuotes = false
    let i = 0
    
    while (i < line.length) {
      const char = line[i]
      
      if (char === '"') {
        if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
          // Escaped quote ""
          i += 2
          continue
        } else {
          inQuotes = !inQuotes
        }
      } else if (char === ',' && !inQuotes) {
        // Valid separator
      } else if (char === '"' && !inQuotes) {
        // Quote in middle of field without proper escaping
        this.addIssue({
          type: 'warning',
          pattern: 'CSV_UNESCAPED_QUOTE',
          line: lineNumber,
          column: i + 1,
          message: 'Unescaped quote in field',
          originalText: line,
          suggestedFix: 'Wrap field in quotes or escape quote as ""',
          canAutoFix: true,
          evidence: {
            observed: `Quote at position ${i + 1}`,
            context: 'RFC 4180: Quotes must be escaped or field must be quoted',
            ruleViolated: 'RFC 4180 Section 2.7'
          }
        })
      }
      i++
    }
    
    if (inQuotes) {
      this.addIssue({
        type: 'error',
        pattern: 'CSV_UNCLOSED_QUOTE',
        line: lineNumber,
        column: line.length,
        message: 'Unclosed quote at end of line',
        originalText: line,
        suggestedFix: 'Add closing quote',
        canAutoFix: true,
        evidence: {
          observed: 'Quote opened but not closed',
          context: 'RFC 4180: Quoted fields must be properly closed',
          ruleViolated: 'RFC 4180 Section 2.6'
        }
      })
    }
  }

  private countCsvColumns(line: string): number {
    let count = 1
    let inQuotes = false

    for (let i = 0; i < line.length; i++) {
      if (line[i] === '"') {
        if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
          i++ // Skip escaped quote
        } else {
          inQuotes = !inQuotes
        }
      } else if (line[i] === ',' && !inQuotes) {
        count++
      }
    }

    return count
  }

  // =========================================================================
  // XML & YAML VALIDATION (Basic)
  // =========================================================================

  private validateXml(): void {
    // Basic tag matching
    const openTags = (this.content.match(/<(\w+)[^>]*>/g) || []).filter(
      t => !t.startsWith('<?') && !t.includes('/>')
    )
    const closeTags = this.content.match(/<\/(\w+)>/g) || []

    if (openTags.length !== closeTags.length) {
      this.addIssue({
        type: 'error',
        pattern: 'XML_MISMATCHED_TAGS',
        line: 1,
        column: 1,
        message: `Mismatched XML tags: ${openTags.length} opening, ${closeTags.length} closing`,
        originalText: 'Multiple lines',
        suggestedFix: 'Ensure every opening tag has matching closing tag',
        canAutoFix: false,
        evidence: {
          observed: `${closeTags.length} closing tags`,
          context: `${openTags.length} opening tags found`,
          ruleViolated: 'XML Well-Formedness'
        }
      })
    }
  }

  private validateYaml(): void {
    const lines = this.content.split('\n')
    lines.forEach((line, index) => {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) return

      if (!trimmed.includes(':') && !trimmed.startsWith('-')) {
        this.addIssue({
          type: 'warning',
          pattern: 'YAML_INVALID_SYNTAX',
          line: index + 1,
          column: 1,
          message: 'Invalid YAML syntax',
          originalText: line,
          suggestedFix: 'Use "key: value" format or list items with "-"',
          canAutoFix: false,
          evidence: {
            observed: trimmed.slice(0, 50),
            context: 'YAML requires key:value pairs or list items',
            ruleViolated: 'YAML Specification'
          }
        })
      }
    })
  }

  // =========================================================================
  // AUTO-FIX APPLICATION
  // =========================================================================

  private applyFix(content: string, issue: StructureIssue): string {
    switch (issue.pattern) {
      case 'OBJECT_TRAILING_COMMA':
      case 'ARRAY_TRAILING_COMMA':
        return this.fixTrailingComma(content, issue)
      
      case 'UNEXPECTED_END':
        return this.fixUnexpectedEnd(content, issue)
        
      case 'MISSING_COMMA':
        return this.fixMissingComma(content, issue)
        
      case 'CSV_COLUMN_MISMATCH':
        return this.fixCsvColumnMismatch(content, issue)
        
      case 'CSV_UNCLOSED_QUOTE':
        return this.fixCsvUnclosedQuote(content, issue)
        
      case 'INCONSISTENT_INDENTATION':
        return this.fixJsonIndentation(content)
        
      default:
        return content // No auto-fix available
    }
  }

  private fixTrailingComma(content: string, issue: StructureIssue): string {
    const lines = content.split('\n')
    const line = lines[issue.line - 1]
    
    // Find and remove trailing comma
    const fixed = line.replace(/,\s*$/, '')
    lines[issue.line - 1] = fixed
    
    return lines.join('\n')
  }

  private fixUnexpectedEnd(content: string, issue: StructureIssue): string {
    const openBraces = (content.match(/\{/g) || []).length
    const closeBraces = (content.match(/\}/g) || []).length
    const openBrackets = (content.match(/\[/g) || []).length
    const closeBrackets = (content.match(/\]/g) || []).length
    
    let addition = ''
    
    if (openBraces > closeBraces) {
      addition = '}\n'.repeat(openBraces - closeBraces)
    } else if (openBrackets > closeBrackets) {
      addition = ']\n'.repeat(openBrackets - closeBrackets)
    }
    
    return content + addition
  }

  private fixMissingComma(content: string, issue: StructureIssue): string {
    const lines = content.split('\n')
    const prevLine = issue.line > 1 ? lines[issue.line - 2] : ''
    
    if (prevLine.trim() && !prevLine.trim().endsWith(',')) {
      lines[issue.line - 2] = prevLine.trim() + ','
    }
    
    return lines.join('\n')
  }

  private fixCsvColumnMismatch(content: string, issue: StructureIssue): string {
    const lines = content.split('\n')
    const line = lines[issue.line - 1]
    const headerCols = this.countCsvColumns(lines[0])
    const currentCols = this.countCsvColumns(line)
    
    if (currentCols < headerCols) {
      // Add empty columns
      const missing = headerCols - currentCols
      lines[issue.line - 1] = line + ','.repeat(missing)
    }
    
    return lines.join('\n')
  }

  private fixCsvUnclosedQuote(content: string, issue: StructureIssue): string {
    const lines = content.split('\n')
    lines[issue.line - 1] += '"'
    return lines.join('\n')
  }

  private fixJsonIndentation(content: string): string {
    try {
      const parsed = JSON.parse(content)
      return JSON.stringify(parsed, null, 2)
    } catch {
      return content // Cannot auto-format invalid JSON
    }
  }

  // =========================================================================
  // UTILITY METHODS
  // =========================================================================

  private addIssue(issue: Omit<StructureIssue, 'id'>): void {
    this.issues.push({
      id: `struct-${++this.issueIdCounter}`,
      ...issue
    })
  }

  private getLineAndColumn(position: number): { line: number; column: number } {
    const beforePos = this.content.substring(0, position)
    const lines = beforePos.split('\n')
    return {
      line: lines.length,
      column: lines[lines.length - 1].length + 1
    }
  }

  private getLineText(lineNumber: number): string {
    const lines = this.content.split('\n')
    return lines[lineNumber - 1] || ''
  }

  private getContextAroundPosition(position: number, radius: number = 20): string {
    const start = Math.max(0, position - radius)
    const end = Math.min(this.content.length, position + radius)
    return this.content.substring(start, end)
  }

  private isAfterClosingBrace(position: number): boolean {
    const char = this.content[position - 1]
    return char === '}' || char === ']'
  }
}