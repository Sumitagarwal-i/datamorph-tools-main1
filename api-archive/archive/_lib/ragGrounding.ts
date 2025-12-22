/**
 * RAG (Retrieval-Augmented Generation) Grounding System
 * 
 * Loads authoritative rules, patterns, and repair strategies from
 * Detective-D-RAG-Specs.md to reduce LLM hallucinations.
 * 
 * For MVP: Simple keyword matching to retrieve relevant snippets.
 * Future: Embeddings + vector search for semantic retrieval.
 */

import * as fs from 'fs';
import * as path from 'path';
import { logger } from './logger.js';

// RAG snippet structure
export interface RAGSnippet {
  id: string;              // Unique identifier (e.g., "JSON_RFC_NO_TRAILING_COMMAS")
  file_type: string;       // json, csv, xml, yaml
  category: string;        // rules, patterns, repairs, edge_cases
  title: string;           // Human-readable title
  content: string;         // The actual snippet (100-500 words)
  keywords: string[];      // Keywords for matching
}

// Parsed RAG knowledge base
let ragKnowledgeBase: RAGSnippet[] = [];
let ragLoadError: string | null = null;

/**
 * Load and parse the Detective-D-RAG-Specs.md file on startup
 */
export function initializeRAG(): void {
  try {
    const specsPath = path.join(process.cwd(), 'Detective-D-RAG-Specs.md');
    
    if (!fs.existsSync(specsPath)) {
      ragLoadError = 'Detective-D-RAG-Specs.md not found';
      logger.warn('RAG initialization failed: specs file not found', { path: specsPath });
      return;
    }

    const rawContent = fs.readFileSync(specsPath, 'utf-8');
    ragKnowledgeBase = parseRAGSpecs(rawContent);
    
    logger.info('RAG knowledge base initialized', {
      total_snippets: ragKnowledgeBase.length,
      json_snippets: ragKnowledgeBase.filter(s => s.file_type === 'json').length,
      csv_snippets: ragKnowledgeBase.filter(s => s.file_type === 'csv').length,
      xml_snippets: ragKnowledgeBase.filter(s => s.file_type === 'xml').length,
      yaml_snippets: ragKnowledgeBase.filter(s => s.file_type === 'yaml').length,
    });
  } catch (error) {
    ragLoadError = `Failed to load RAG specs: ${error}`;
    logger.error('RAG initialization error', { error: String(error) });
  }
}

/**
 * Parse the specs markdown into structured snippets
 */
function parseRAGSpecs(content: string): RAGSnippet[] {
  const snippets: RAGSnippet[] = [];
  
  // Split into documents by file type
  const documents = [
    { type: 'json', pattern: /# DOCUMENT 1 — JSON[\s\S]*?(?=# DOCUMENT 2|$)/i },
    { type: 'csv', pattern: /# DOCUMENT 2 — CSV[\s\S]*?(?=# DOCUMENT 3|$)/i },
    { type: 'xml', pattern: /# DOCUMENT 3 — XML[\s\S]*?(?=# DOCUMENT 4|$)/i },
    { type: 'yaml', pattern: /# DOCUMENT 4 — YAML[\s\S]*?(?=# DOCUMENT 5|$)/i },
  ];

  for (const doc of documents) {
    const match = content.match(doc.pattern);
    if (!match) continue;

    const docContent = match[0];
    
    // Extract major sections (rules, patterns, repairs)
    snippets.push(...extractSnippets(docContent, doc.type));
  }

  return snippets;
}

/**
 * Extract snippets from a document section
 */
function extractSnippets(docContent: string, fileType: string): RAGSnippet[] {
  const snippets: RAGSnippet[] = [];
  
  // Extract sections by heading patterns
  const sectionPatterns = [
    { category: 'rules', pattern: /##\s+\d+\.\d+\s+(.+?)\n([\s\S]*?)(?=##|$)/g },
    { category: 'patterns', pattern: /###\s+(.+?)\n([\s\S]*?)(?=###|##|$)/g },
  ];

  // Extract common mistakes section
  const mistakesMatch = docContent.match(/##?\s+\d+\.?\s*Common (Mistakes|Errors|Pitfalls)[\s\S]*?(?=##?\s+\d+|$)/i);
  if (mistakesMatch) {
    snippets.push(createSnippet(
      fileType,
      'patterns',
      `${fileType.toUpperCase()} Common Mistakes`,
      mistakesMatch[0],
      ['mistake', 'error', 'pitfall', 'common', 'typical', fileType]
    ));
  }

  // Extract repair strategies section
  const repairsMatch = docContent.match(/##?\s+\d+\.?\s*Repair (Strategies|Fixes|Solutions)[\s\S]*?(?=##?\s+\d+|$)/i);
  if (repairsMatch) {
    snippets.push(createSnippet(
      fileType,
      'repairs',
      `${fileType.toUpperCase()} Repair Strategies`,
      repairsMatch[0],
      ['repair', 'fix', 'solution', 'strategy', fileType]
    ));
  }

  // Extract grammar/RFC rules
  const grammarMatch = docContent.match(/##?\s+\d+\.?\s*(Grammar|RFC|Specification|Structural Tokens)[\s\S]{100,1500}/i);
  if (grammarMatch) {
    snippets.push(createSnippet(
      fileType,
      'rules',
      `${fileType.toUpperCase()} Grammar Rules`,
      grammarMatch[0],
      ['grammar', 'rfc', 'specification', 'rule', 'syntax', fileType]
    ));
  }

  // Extract edge cases
  const edgeCasesMatch = docContent.match(/##?\s+\d+\.?\s*Edge Cases[\s\S]*?(?=##?\s+\d+|$)/i);
  if (edgeCasesMatch) {
    snippets.push(createSnippet(
      fileType,
      'edge_cases',
      `${fileType.toUpperCase()} Edge Cases`,
      edgeCasesMatch[0],
      ['edge', 'case', 'corner', 'special', fileType]
    ));
  }

  // Extract specific rules (trailing commas, quotes, etc.)
  const trailingCommaMatch = docContent.match(/.*trailing comma.*[\s\S]{0,300}/gi);
  if (trailingCommaMatch && trailingCommaMatch.length > 0) {
    snippets.push(createSnippet(
      fileType,
      'rules',
      `${fileType.toUpperCase()} Trailing Comma Rules`,
      trailingCommaMatch.join('\n\n').substring(0, 500),
      ['trailing', 'comma', 'separator', fileType]
    ));
  }

  // Extract quoting rules
  const quotingMatch = docContent.match(/.*quot(e|ing).*[\s\S]{0,300}/gi);
  if (quotingMatch && quotingMatch.length > 0) {
    snippets.push(createSnippet(
      fileType,
      'rules',
      `${fileType.toUpperCase()} Quoting Rules`,
      quotingMatch.slice(0, 2).join('\n\n').substring(0, 500),
      ['quote', 'quoting', 'string', 'escape', fileType]
    ));
  }

  return snippets;
}

/**
 * Create a structured snippet with metadata
 */
function createSnippet(
  fileType: string,
  category: string,
  title: string,
  content: string,
  keywords: string[]
): RAGSnippet {
  // Truncate content to 100-500 word range
  const words = content.split(/\s+/);
  const truncatedContent = words.slice(0, 150).join(' ');
  
  // Generate unique ID
  const id = `${fileType.toUpperCase()}_${category.toUpperCase()}_${title.replace(/[^A-Z0-9]/gi, '_').toUpperCase()}`;

  return {
    id,
    file_type: fileType.toLowerCase(),
    category,
    title,
    content: truncatedContent,
    keywords: keywords.map(k => k.toLowerCase()),
  };
}

/**
 * Retrieve relevant RAG snippets for a given file type and error context
 * 
 * @param fileType - json, csv, xml, yaml
 * @param errorContext - String containing error messages or detected issues
 * @param maxSnippets - Maximum number of snippets to return (default: 3)
 * @returns Array of relevant RAG snippets
 */
export function retrieveRAGSnippets(
  fileType: string,
  errorContext: string = '',
  maxSnippets: number = 3
): RAGSnippet[] {
  if (ragLoadError || ragKnowledgeBase.length === 0) {
    logger.warn('RAG retrieval skipped - knowledge base not loaded', {
      error: ragLoadError,
    });
    return [];
  }

  const normalizedFileType = fileType.toLowerCase();
  const normalizedContext = errorContext.toLowerCase();

  // Filter by file type first
  const fileTypeSnippets = ragKnowledgeBase.filter(
    snippet => snippet.file_type === normalizedFileType
  );

  if (fileTypeSnippets.length === 0) {
    logger.debug('No RAG snippets found for file type', { fileType });
    return [];
  }

  // Score snippets by keyword matching
  const scoredSnippets = fileTypeSnippets.map(snippet => {
    let score = 0;

    // Match keywords against error context
    for (const keyword of snippet.keywords) {
      if (normalizedContext.includes(keyword)) {
        score += 2; // Keyword in error context is highly relevant
      }
    }

    // Boost certain categories based on context
    if (normalizedContext.includes('error') || normalizedContext.includes('invalid')) {
      if (snippet.category === 'repairs') score += 3;
      if (snippet.category === 'patterns') score += 2;
    }

    // Always include grammar rules as baseline
    if (snippet.category === 'rules') score += 1;

    return { snippet, score };
  });

  // Sort by score (descending) and take top N
  const topSnippets = scoredSnippets
    .sort((a, b) => b.score - a.score)
    .slice(0, maxSnippets)
    .map(item => item.snippet);

  logger.debug('Retrieved RAG snippets', {
    fileType,
    requestedMax: maxSnippets,
    retrieved: topSnippets.length,
    snippetIds: topSnippets.map(s => s.id),
  });

  return topSnippets;
}

/**
 * Format RAG snippets for inclusion in LLM prompt
 */
export function formatRAGSnippetsForPrompt(snippets: RAGSnippet[]): string {
  if (snippets.length === 0) {
    return '';
  }

  let formatted = '\n\n---\n## RAG_SNIPPETS (Authoritative Reference)\n\n';
  formatted += 'Use the following authoritative rules and patterns to guide your analysis:\n\n';

  for (const snippet of snippets) {
    formatted += `### ${snippet.title}\n\n`;
    formatted += `${snippet.content}\n\n`;
    formatted += '---\n\n';
  }

  return formatted;
}

/**
 * Get RAG system status
 */
export function getRAGStatus(): {
  loaded: boolean;
  error: string | null;
  snippet_count: number;
} {
  return {
    loaded: ragKnowledgeBase.length > 0,
    error: ragLoadError,
    snippet_count: ragKnowledgeBase.length,
  };
}

// Auto-initialize on module load
initializeRAG();

