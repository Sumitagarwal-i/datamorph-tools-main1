/**
 * Prompt Construction System for Detective D
 * 
 * Builds structured prompts in layers: System → Context → Task
 * Enforces strict JSON output with schema validation
 * Includes RAG grounding, parser hints, and truncation context
 */

import type { RAGSnippet } from './ragGrounding.js';

// File types
type FileType = 'json' | 'csv' | 'xml' | 'yaml';

// Parser hint from prechecks
interface ParserHint {
  type: 'syntax_error' | 'structure_error' | 'warning';
  message: string;
  position?: number;
  line?: number;
  column?: number;
  row?: number;
  extra?: Record<string, any>;
}

// Truncation map
interface TruncationMap {
  was_truncated: boolean;
  original_length: number;
  truncated_length: number;
  head_chars: number;
  tail_chars: number;
  error_windows: Array<{
    start: number;
    end: number;
    reason: string;
  }>;
  omitted_ranges: Array<{
    start: number;
    end: number;
  }>;
}

// Expected error schema for LLM output
export interface DetectedError {
  id?: string;
  line: number | null;
  column?: number | null;
  position?: number | null;
  message: string;
  type: 'error' | 'warning';
  category: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  explanation: string;
  confidence: number; // 0.0 - 1.0
  snippet?: string;
  position_note?: string;
  suggestions: Array<{
    description: string;
    code_snippet?: string;
    fix_code?: string;
    safety: 'safe' | 'risky' | 'manual_review';
    preview?: string;
  }>;
}

// LLM response schema
export interface LLMAnalysisResponse {
  errors: DetectedError[];
  total_errors: number;
  analysis_confidence: number;
  sanity_checks_passed?: number;
  sanity_checks_failed?: number;
}

// Prompt construction parameters
interface PromptParams {
  fileType: FileType;
  content: string;
  fileName?: string;
  parserHints?: ParserHint[];
  ragSnippets?: RAGSnippet[];
  truncationMap?: TruncationMap;
  maxErrors?: number;
  truncationNote?: string;
}

/**
 * Build the system instructions layer
 * Role, behavior, output format
 */
function buildSystemInstructions(): string {
  return `You are Detective D, an expert code debugger and data format validator.

Your role:
- Analyze code and data files for syntax errors, structural issues, and common mistakes
- Provide precise error locations (line/column when possible, position as fallback)
- Suggest safe, actionable repairs based on authoritative specifications

Your behavior:
- Be concise and accurate
- Use the provided RAG rules and specifications as authoritative truth
- Never hallucinate or guess - if uncertain, mark confidence < 0.8
- Return ONLY valid JSON matching the exact schema provided
- No commentary, explanations outside JSON, or markdown formatting`;
}

/**
 * Build the context block
 * File type, parser hints, RAG snippets, truncation info
 */
function buildContextBlock(params: PromptParams): string {
  let context = '\n\n---\n## ANALYSIS CONTEXT\n\n';

  // File information
  context += `**File Type**: ${params.fileType.toUpperCase()}\n`;
  if (params.fileName) {
    context += `**File Name**: ${params.fileName}\n`;
  }
  context += `**Content Length**: ${params.content.length} characters\n`;

  // Parser hints from fast prechecks
  if (params.parserHints && params.parserHints.length > 0) {
    context += '\n### PARSER HINTS (Fast Prechecks)\n\n';
    context += 'The following issues were detected by local parsers:\n\n';
    context += '```json\n';
    context += JSON.stringify(params.parserHints, null, 2);
    context += '\n```\n';
    context += '\n**Use these hints as grounding for your analysis.**\n';
  }

  // RAG snippets (authoritative rules)
  if (params.ragSnippets && params.ragSnippets.length > 0) {
    context += '\n### RAG SNIPPETS (Authoritative Reference)\n\n';
    context += 'Use the following authoritative rules and patterns to guide your analysis:\n\n';
    
    for (const snippet of params.ragSnippets) {
      context += `#### ${snippet.title}\n\n`;
      context += `${snippet.content}\n\n`;
      context += '---\n\n';
    }
  }

  // Truncation information
  if (params.truncationMap?.was_truncated) {
    context += '\n### ⚠️ TRUNCATION NOTICE\n\n';
    context += params.truncationNote || '';
    context += '\n\n**Important**: Focus your analysis on the included sections. ';
    context += 'You cannot detect errors in omitted ranges. ';
    context += 'Acknowledge this limitation if relevant.\n';
  }

  return context;
}

/**
 * Build the task block with schema and examples
 * Instructions, JSON schema, few-shot examples
 */
function buildTaskBlock(params: PromptParams): string {
  const maxErrors = params.maxErrors || 100;
  
  let task = '\n\n---\n## YOUR TASK\n\n';

  // Instructions
  task += `Analyze the ${params.fileType.toUpperCase()} content below and identify up to ${maxErrors} errors.\n\n`;
  task += '**For each error, you must provide:**\n\n';
  task += '1. **Line number** (required) - The line where the error occurs\n';
  task += '2. **Column number** (preferred) - The column position if calculable\n';
  task += '3. **Position** (fallback) - Character index if line/column not available\n';
  task += '4. **Message** - Brief error description (1-2 sentences)\n';
  task += '5. **Type** - Either "error" or "warning"\n';
  task += '6. **Category** - Error classification (e.g., "syntax", "structure", "semantic")\n';
  task += '7. **Severity** - One of: "critical", "high", "medium", "low"\n';
  task += '8. **Explanation** - Detailed explanation using RAG rules (2-3 sentences)\n';
  task += '9. **Confidence** - Your confidence level (0.0 to 1.0)\n';
  task += '10. **Suggestions** - Array of 1-3 repair suggestions with safety tags\n\n';

  // Output schema
  task += '## REQUIRED OUTPUT SCHEMA\n\n';
  task += 'You MUST return valid JSON matching this exact schema:\n\n';
  task += '```json\n';
  task += JSON.stringify({
    errors: [
      {
        line: 0,
        column: 0,
        position: 0,
        message: "string",
        type: "error",
        category: "string",
        severity: "critical",
        explanation: "string",
        confidence: 0.0,
        suggestions: [
          {
            description: "string",
            code_snippet: "string (optional)",
            safety: "safe"
          }
        ]
      }
    ],
    total_errors: 0,
    analysis_confidence: 0.0
  }, null, 2);
  task += '\n```\n\n';

  // Field specifications
  task += '**Field Specifications:**\n\n';
  task += '- `line`: Integer, 1-based line number (required)\n';
  task += '- `column`: Integer, 1-based column number (optional but preferred)\n';
  task += '- `position`: Integer, 0-based character index (use if line/column not available)\n';
  task += '- `type`: Must be exactly "error" or "warning"\n';
  task += '- `severity`: Must be exactly "critical", "high", "medium", or "low"\n';
  task += '- `confidence`: Float between 0.0 and 1.0\n';
  task += '- `safety`: Must be exactly "safe", "risky", or "manual_review"\n\n';

  // Few-shot examples
  task += '## EXAMPLES\n\n';
  task += buildFewShotExamples(params.fileType);

  // Critical instructions
  task += '\n## CRITICAL INSTRUCTIONS\n\n';
  task += '1. **Output ONLY the JSON object** - No markdown, no explanations, no commentary\n';
  task += '2. **Strict schema compliance** - Every field must match the schema exactly\n';
  task += '3. **Use RAG rules** - Base your explanations on the authoritative snippets provided\n';
  task += '4. **Prefer line/column** - Calculate line and column when possible, use position as fallback\n';
  task += `5. **Limit to ${maxErrors} errors** - If more exist, prioritize by severity\n`;
  task += '6. **Confidence matters** - Mark uncertain detections with confidence < 0.8\n';
  task += '7. **Safety first** - Tag risky repairs as "risky" or "manual_review"\n';
  task += '8. **No hallucinations** - If you cannot determine something, omit it or mark low confidence\n\n';

  return task;
}

/**
 * Build few-shot examples based on file type
 */
function buildFewShotExamples(fileType: FileType): string {
  let examples = '**Example Output for Common Errors:**\n\n';

  switch (fileType) {
    case 'json':
      examples += '```json\n';
      examples += JSON.stringify({
        errors: [
          {
            line: 3,
            column: 15,
            message: "Trailing comma not allowed in JSON",
            type: "error",
            category: "syntax",
            severity: "critical",
            explanation: "JSON RFC 7159 does not permit trailing commas in objects or arrays. Remove the comma after the last element.",
            confidence: 1.0,
            suggestions: [
              {
                description: "Remove the trailing comma",
                code_snippet: '  "value": 123\n}',
                safety: "safe"
              }
            ]
          },
          {
            line: 5,
            column: 3,
            message: "Property name must be enclosed in double quotes",
            type: "error",
            category: "syntax",
            severity: "critical",
            explanation: "JSON requires all object keys to be strings wrapped in double quotes. Single quotes or unquoted keys are not valid.",
            confidence: 1.0,
            suggestions: [
              {
                description: "Wrap property name in double quotes",
                code_snippet: '  "propertyName": "value"',
                safety: "safe"
              }
            ]
          }
        ],
        total_errors: 2,
        analysis_confidence: 1.0
      }, null, 2);
      examples += '\n```\n';
      examples += '**CRITICAL JSON VALIDATION RULES:**\n';
      examples += '- Property names must be in double quotes (e.g., "name", not name)\n';
      examples += '- String values inside quotes are valid and do NOT need additional quotes\n';
      examples += '- Do NOT report missing quotes on values - values like "key": value are correct if value is a string/number/boolean\n';
      examples += '- Nested objects {} and arrays [] are allowed and valid\n';
      examples += '- Report ONLY actual syntax violations: missing braces, unclosed strings, trailing commas, duplicate keys\n';
      examples += '- Do NOT invent errors for valid JSON structure\n';
      break;

    case 'csv':
      examples += '```json\n';
      examples += JSON.stringify({
        errors: [
          {
            line: 5,
            message: "Inconsistent column count: expected 4 columns, found 3",
            type: "error",
            category: "structure",
            severity: "high",
            explanation: "CSV RFC 4180 requires each row to have the same number of fields. Row 5 is missing one column.",
            confidence: 1.0,
            suggestions: [
              {
                description: "Add missing column with empty value or placeholder",
                code_snippet: 'value1,value2,value3,""',
                safety: "risky"
              },
              {
                description: "Review source data for data loss",
                safety: "manual_review"
              }
            ]
          }
        ],
        total_errors: 1,
        analysis_confidence: 0.95
      }, null, 2);
      examples += '\n```\n';
      break;

    case 'xml':
      examples += '```json\n';
      examples += JSON.stringify({
        errors: [
          {
            line: 12,
            column: 5,
            message: "Unclosed tag: expected </item> but found </root>",
            type: "error",
            category: "syntax",
            severity: "critical",
            explanation: "XML requires all opening tags to have matching closing tags. The <item> tag on line 10 was never closed.",
            confidence: 1.0,
            suggestions: [
              {
                description: "Add closing </item> tag before </root>",
                code_snippet: '  </item>\n</root>',
                safety: "safe"
              }
            ]
          }
        ],
        total_errors: 1,
        analysis_confidence: 1.0
      }, null, 2);
      examples += '\n```\n';
      break;

    case 'yaml':
      examples += '```json\n';
      examples += JSON.stringify({
        errors: [
          {
            line: 8,
            column: 1,
            message: "Invalid indentation: expected 2 spaces, found tab character",
            type: "error",
            category: "syntax",
            severity: "high",
            explanation: "YAML spec prohibits tab characters for indentation. Use spaces only, with consistent indentation levels (typically 2 spaces).",
            confidence: 1.0,
            suggestions: [
              {
                description: "Replace tab with 2 spaces",
                code_snippet: '  key: value',
                safety: "safe"
              }
            ]
          }
        ],
        total_errors: 1,
        analysis_confidence: 1.0
      }, null, 2);
      examples += '\n```\n';
      break;
  }

  return examples;
}

/**
 * Build the complete prompt with all layers
 */
export function buildPrompt(params: PromptParams): string {
  const systemInstructions = buildSystemInstructions();
  const contextBlock = buildContextBlock(params);
  const taskBlock = buildTaskBlock(params);

  const prompt = `${systemInstructions}${contextBlock}${taskBlock}
---
## CONTENT TO ANALYZE

\`\`\`${params.fileType}
${params.content}
\`\`\`

---

Remember: Output ONLY the JSON object matching the schema. No markdown, no explanations, no commentary.`;

  return prompt;
}

/**
 * Build prompt configuration for LLM API
 * Includes temperature, max_tokens, and other parameters
 */
export interface LLMConfig {
  temperature: number;
  max_tokens: number;
  top_p: number;
  frequency_penalty: number;
  presence_penalty: number;
  response_format?: { type: 'json_object' }; // For OpenAI JSON mode
}

/**
 * Get recommended LLM configuration for analysis
 */
export function getLLMConfig(contentLength: number, maxErrors: number = 100): LLMConfig {
  // Calculate safe max_tokens based on expected output size
  // Each error ~200 tokens, add buffer for wrapper
  const estimatedOutputTokens = (maxErrors * 200) + 500;
  const safeMaxTokens = Math.min(estimatedOutputTokens, 4000);

  return {
    temperature: 0.0,           // Zero variance for consistency
    max_tokens: safeMaxTokens,  // Safe margin for response
    top_p: 1.0,                 // No nucleus sampling (deterministic)
    frequency_penalty: 0.0,     // No repetition penalty
    presence_penalty: 0.0,      // No topic penalty
    response_format: { type: 'json_object' }, // Force JSON mode (OpenAI)
  };
}

/**
 * Build streaming instructions for SSE
 */
export function buildStreamingPrompt(params: PromptParams): string {
  const basePrompt = buildPrompt(params);
  
  // Add streaming-specific instructions
  const streamingInstructions = `

---
## STREAMING INSTRUCTIONS

Since this is a streaming request, output the JSON incrementally:
1. Start with opening brace: {
2. Output "errors" array with each error as you detect it
3. Close with total_errors and analysis_confidence
4. Ensure valid JSON at all times during streaming

**Critical**: Each chunk must maintain valid JSON structure for parsing.`;

  return basePrompt + streamingInstructions;
}

/**
 * Validate LLM response matches expected schema
 */
export function validateLLMResponse(response: any): {
  valid: boolean;
  errors: string[];
  data?: LLMAnalysisResponse;
} {
  const errors: string[] = [];

  // Check top-level structure
  if (!response || typeof response !== 'object') {
    errors.push('Response is not an object');
    return { valid: false, errors };
  }

  if (!Array.isArray(response.errors)) {
    errors.push('Missing or invalid "errors" array');
    return { valid: false, errors };
  }

  if (typeof response.total_errors !== 'number') {
    errors.push('Missing or invalid "total_errors" number');
  }

  if (typeof response.analysis_confidence !== 'number') {
    errors.push('Missing or invalid "analysis_confidence" number');
  }

  // Validate each error
  response.errors.forEach((error: any, index: number) => {
    const prefix = `Error ${index + 1}`;

    if (typeof error.line !== 'number') {
      errors.push(`${prefix}: Missing or invalid "line" number`);
    }

    if (error.column !== undefined && typeof error.column !== 'number') {
      errors.push(`${prefix}: Invalid "column" type (must be number)`);
    }

    if (typeof error.message !== 'string') {
      errors.push(`${prefix}: Missing or invalid "message" string`);
    }

    if (!['error', 'warning'].includes(error.type)) {
      errors.push(`${prefix}: Invalid "type" (must be "error" or "warning")`);
    }

    if (!['critical', 'high', 'medium', 'low'].includes(error.severity)) {
      errors.push(`${prefix}: Invalid "severity"`);
    }

    if (typeof error.confidence !== 'number' || error.confidence < 0 || error.confidence > 1) {
      errors.push(`${prefix}: Invalid "confidence" (must be 0.0-1.0)`);
    }

    if (!Array.isArray(error.suggestions)) {
      errors.push(`${prefix}: Missing or invalid "suggestions" array`);
    } else {
      error.suggestions.forEach((sug: any, sugIndex: number) => {
        if (!['safe', 'risky', 'manual_review'].includes(sug.safety)) {
          errors.push(`${prefix}, Suggestion ${sugIndex + 1}: Invalid "safety" value`);
        }
      });
    }
  });

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors: [],
    data: response as LLMAnalysisResponse,
  };
}

