/**
 * Source Mapper - Character offset to line/column conversion utility
 * 
 * This class implements a professional offset-based source mapping system that:
 * 1. Builds a line index once from source text
 * 2. Converts character offsets to line/column for display only
 * 3. Maintains offsets as the primary reference for error locations
 * 4. Provides Monaco Editor integration for precise highlighting
 */

export interface OffsetPosition {
  /** Character offset from start of source (primary reference) */
  offset: number;
  /** Line number (1-based, derived for display only) */
  line: number;
  /** Column number (1-based, derived for display only) */
  column: number;
}

export interface OffsetRange {
  /** Start character offset */
  startOffset: number;
  /** End character offset */
  endOffset: number;
}

export interface DisplayRange extends OffsetRange {
  /** Start position for display */
  startLine: number;
  startColumn: number;
  /** End position for display */
  endLine: number;
  endColumn: number;
}

/**
 * SourceMapper builds a line index from source text and provides
 * efficient offset-to-line/column conversion for error display
 */
export class SourceMapper {
  private lineOffsets: number[] = [];
  private sourceText: string = '';

  constructor(sourceText: string) {
    this.sourceText = sourceText;
    this.buildLineIndex();
  }

  /**
   * Build line offset index once from source text
   * Each entry contains the character offset where each line starts
   */
  private buildLineIndex(): void {
    this.lineOffsets = [0]; // Line 1 starts at offset 0
    
    for (let i = 0; i < this.sourceText.length; i++) {
      const char = this.sourceText[i];
      if (char === '\n') {
        // Next line starts after the newline character
        this.lineOffsets.push(i + 1);
      } else if (char === '\r') {
        // Handle Windows-style line endings (\r\n)
        if (i + 1 < this.sourceText.length && this.sourceText[i + 1] === '\n') {
          // Skip the \r, \n will be handled next iteration
          continue;
        } else {
          // Mac-style line ending (\r only)
          this.lineOffsets.push(i + 1);
        }
      }
    }
  }

  /**
   * Convert character offset to line/column position for display
   * @param offset Character offset from start of source
   * @returns Position with line/column (1-based) and original offset
   */
  offsetToPosition(offset: number): OffsetPosition {
    // Clamp offset to valid range
    offset = Math.max(0, Math.min(offset, this.sourceText.length));

    // Binary search to find the line containing this offset
    let line = 1;
    for (let i = this.lineOffsets.length - 1; i >= 0; i--) {
      if (offset >= this.lineOffsets[i]) {
        line = i + 1; // Lines are 1-based
        break;
      }
    }

    // Calculate column within the line
    const lineStartOffset = this.lineOffsets[line - 1] || 0;
    const column = offset - lineStartOffset + 1; // Columns are 1-based

    return {
      offset,
      line,
      column
    };
  }

  /**
   * Convert offset range to display range with line/column positions
   * @param range Offset range
   * @returns Display range with both offsets and line/column positions
   */
  offsetRangeToDisplayRange(range: OffsetRange): DisplayRange {
    const start = this.offsetToPosition(range.startOffset);
    const end = this.offsetToPosition(range.endOffset);

    return {
      startOffset: range.startOffset,
      endOffset: range.endOffset,
      startLine: start.line,
      startColumn: start.column,
      endLine: end.line,
      endColumn: end.column
    };
  }

  /**
   * Convert character offset to Monaco Editor position for highlighting
   * @param offset Character offset from start of source
   * @returns Monaco position object (1-based lineNumber, 1-based column)
   */
  offsetToMonacoPosition(offset: number): { lineNumber: number; column: number } {
    const pos = this.offsetToPosition(offset);
    return {
      lineNumber: pos.line,
      column: pos.column
    };
  }

  /**
   * Convert offset range to Monaco Editor range for highlighting
   * @param range Offset range
   * @returns Monaco range object with startLineNumber, startColumn, endLineNumber, endColumn
   */
  offsetRangeToMonacoRange(range: OffsetRange): {
    startLineNumber: number;
    startColumn: number;
    endLineNumber: number;
    endColumn: number;
  } {
    const displayRange = this.offsetRangeToDisplayRange(range);
    return {
      startLineNumber: displayRange.startLine,
      startColumn: displayRange.startColumn,
      endLineNumber: displayRange.endLine,
      endColumn: displayRange.endColumn
    };
  }

  /**
   * Get the text content at a specific offset range
   * @param range Offset range
   * @returns The text content within the range
   */
  getTextAtRange(range: OffsetRange): string {
    return this.sourceText.slice(range.startOffset, range.endOffset);
  }

  /**
   * Get line text at a specific line number
   * @param lineNumber Line number (1-based)
   * @returns The text content of the specified line
   */
  getLineText(lineNumber: number): string {
    if (lineNumber < 1 || lineNumber > this.lineOffsets.length) {
      return '';
    }

    const lineStartOffset = this.lineOffsets[lineNumber - 1];
    const lineEndOffset = lineNumber < this.lineOffsets.length 
      ? this.lineOffsets[lineNumber] - 1 // Exclude the newline
      : this.sourceText.length;

    return this.sourceText.slice(lineStartOffset, lineEndOffset);
  }

  /**
   * Get total number of lines in the source
   * @returns Number of lines
   */
  getLineCount(): number {
    return this.lineOffsets.length;
  }

  /**
   * Validate that an offset is within the source text bounds
   * @param offset Character offset to validate
   * @returns Whether the offset is valid
   */
  isValidOffset(offset: number): boolean {
    return offset >= 0 && offset <= this.sourceText.length;
  }
}