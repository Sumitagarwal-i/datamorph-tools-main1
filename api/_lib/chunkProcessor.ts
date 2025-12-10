/**
 * Chunk Processor - Split large files into analyzable chunks
 * Focuses on error windows and strategic sampling
 */

export interface Chunk {
  id: string;
  type: 'error_window' | 'head' | 'tail' | 'sample';
  startLine: number;
  endLine: number;
  startChar: number;
  endChar: number;
  content: string;
  context?: string; // Reason for inclusion
}

interface ChunkingConfig {
  chunkSizeChars: number; // ~4000 chars ≈ 4500 tokens
  errorWindowLinesAround: number; // 20-40 lines around error
  overlapLines: number; // 3-5 lines overlap
  headTailChars: number; // First/last N chars
  maxChunks: number; // Limit total chunks sent to LLM
}

const DEFAULT_CONFIG: ChunkingConfig = {
  chunkSizeChars: 4000,
  errorWindowLinesAround: 30,
  overlapLines: 5,
  headTailChars: 2000,
  maxChunks: 5,
};

/**
 * Split content into lines with tracking
 */
function getLines(content: string): Array<{ line: number; text: string; startChar: number }> {
  const lines: Array<{ line: number; text: string; startChar: number }> = [];
  let currentChar = 0;
  
  content.split('\n').forEach((text, index) => {
    lines.push({
      line: index + 1,
      text,
      startChar: currentChar,
    });
    currentChar += text.length + 1; // +1 for newline
  });
  
  return lines;
}

/**
 * Extract error window around a specific line
 */
export function extractErrorWindow(
  content: string,
  errorLine: number,
  config: ChunkingConfig = DEFAULT_CONFIG
): Chunk {
  const lines = getLines(content);
  const startLine = Math.max(1, errorLine - config.errorWindowLinesAround);
  const endLine = Math.min(lines.length, errorLine + config.errorWindowLinesAround);
  
  const windowLines = lines.slice(startLine - 1, endLine);
  const startChar = windowLines[0]?.startChar || 0;
  const endChar = windowLines[windowLines.length - 1]
    ? windowLines[windowLines.length - 1].startChar + windowLines[windowLines.length - 1].text.length
    : content.length;
  
  return {
    id: `error-${errorLine}`,
    type: 'error_window',
    startLine,
    endLine,
    startChar,
    endChar,
    content: windowLines.map(l => l.text).join('\n'),
    context: `Error detected at line ${errorLine}`,
  };
}

/**
 * Get head and tail chunks
 */
export function extractHeadTail(
  content: string,
  config: ChunkingConfig = DEFAULT_CONFIG
): Chunk[] {
  const lines = getLines(content);
  const chunks: Chunk[] = [];
  
  // Head chunk
  let headEndChar = 0;
  let headEndLine = 0;
  for (let i = 0; i < lines.length; i++) {
    if (headEndChar >= config.headTailChars) break;
    headEndChar += lines[i].text.length + 1;
    headEndLine = i + 1;
  }
  
  if (headEndLine > 0) {
    chunks.push({
      id: 'head',
      type: 'head',
      startLine: 1,
      endLine: headEndLine,
      startChar: 0,
      endChar: headEndChar,
      content: lines.slice(0, headEndLine).map(l => l.text).join('\n'),
      context: 'File header for schema detection',
    });
  }
  
  // Tail chunk
  let tailStartChar = content.length;
  let tailStartLine = lines.length + 1;
  let accum = 0;
  
  for (let i = lines.length - 1; i >= 0; i--) {
    if (accum >= config.headTailChars) break;
    accum += lines[i].text.length + 1;
    tailStartLine = i + 1;
  }
  
  if (tailStartLine <= lines.length) {
    chunks.push({
      id: 'tail',
      type: 'tail',
      startLine: tailStartLine,
      endLine: lines.length,
      startChar: lines[tailStartLine - 1]?.startChar || 0,
      endChar: content.length,
      content: lines.slice(tailStartLine - 1).map(l => l.text).join('\n'),
      context: 'File tail for completeness check',
    });
  }
  
  return chunks;
}

/**
 * Sample chunks from middle of file
 */
export function sampleMiddleChunks(
  content: string,
  numSamples: number = 2,
  config: ChunkingConfig = DEFAULT_CONFIG
): Chunk[] {
  const lines = getLines(content);
  const chunks: Chunk[] = [];
  
  if (lines.length <= config.headTailChars * 2 / 20) {
    // File is small enough, no need for sampling
    return chunks;
  }
  
  const step = Math.floor(lines.length / (numSamples + 1));
  
  for (let i = 1; i <= numSamples; i++) {
    const centerLine = Math.floor(step * i);
    const startLine = Math.max(1, centerLine - Math.floor(config.chunkSizeChars / 40));
    const endLine = Math.min(lines.length, startLine + Math.floor(config.chunkSizeChars / 40));
    
    chunks.push({
      id: `sample-${i}`,
      type: 'sample',
      startLine,
      endLine,
      startChar: lines[startLine - 1]?.startChar || 0,
      endChar: lines[endLine - 1]
        ? lines[endLine - 1].startChar + lines[endLine - 1].text.length
        : content.length,
      content: lines.slice(startLine - 1, endLine).map(l => l.text).join('\n'),
      context: `Middle sample ${i} for type consistency check`,
    });
  }
  
  return chunks;
}

/**
 * Build comprehensive chunk list from parser hints
 */
export function buildChunkList(
  content: string,
  parserHints: Array<{ line?: number }>,
  config: ChunkingConfig = DEFAULT_CONFIG
): Chunk[] {
  const chunks: Chunk[] = [];
  const chunkIds = new Set<string>();
  
  // 1. Error windows
  for (const hint of parserHints) {
    if (hint.line) {
      const window = extractErrorWindow(content, hint.line, config);
      if (!chunkIds.has(window.id)) {
        chunks.push(window);
        chunkIds.add(window.id);
      }
    }
  }
  
  // 2. Head and tail
  const headTail = extractHeadTail(content, config);
  for (const chunk of headTail) {
    if (!chunkIds.has(chunk.id)) {
      chunks.push(chunk);
      chunkIds.add(chunk.id);
    }
  }
  
  // 3. Samples (if no parser hints)
  if (parserHints.length === 0) {
    const samples = sampleMiddleChunks(content, 2, config);
    for (const chunk of samples) {
      if (!chunkIds.has(chunk.id)) {
        chunks.push(chunk);
        chunkIds.add(chunk.id);
      }
    }
  }
  
  // 4. Limit total chunks
  return chunks.slice(0, config.maxChunks);
}

/**
 * Deduplicate errors across chunks
 */
export function deduplicateErrors(
  errorsByChunk: Array<{
    chunkId: string;
    errors: Array<{
      line: number;
      column?: number;
      message: string;
      confidence: number;
    }>;
  }>
): Array<{
  line: number;
  column?: number;
  message: string;
  confidence: number;
  occurrences: number;
  sources: string[];
}> {
  const errorMap = new Map<string, { error: any; sources: string[]; confidences: number[] }>();
  
  for (const { chunkId, errors } of errorsByChunk) {
    for (const error of errors) {
      const key = `${error.line}:${error.column || 0}:${error.message.slice(0, 30)}`;
      
      if (!errorMap.has(key)) {
        errorMap.set(key, {
          error: { ...error },
          sources: [],
          confidences: [],
        });
      }
      
      const entry = errorMap.get(key)!;
      if (!entry.sources.includes(chunkId)) {
        entry.sources.push(chunkId);
        entry.confidences.push(error.confidence);
      }
    }
  }
  
  return Array.from(errorMap.values()).map(({ error, sources, confidences }) => ({
    ...error,
    occurrences: sources.length,
    sources,
    confidence: confidences.reduce((a, b) => a + b, 0) / confidences.length,
  }));
}

export default {
  extractErrorWindow,
  extractHeadTail,
  sampleMiddleChunks,
  buildChunkList,
  deduplicateErrors,
};
