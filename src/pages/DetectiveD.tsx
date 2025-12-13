import { Link, useNavigate } from "react-router-dom";
import { Upload, RotateCcw, Moon, Sun, HelpCircle, X, Plus, FileJson, FileText, FileCode, CircleAlert, TriangleAlert, Download, Wand2, Minimize2, Sparkles } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import Editor from "@monaco-editor/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "next-themes";

interface UploadedFile {
  id: string;
  name: string;
  content: string;
}

// File size limits
const MAX_FILE_SIZE_MB = 5; // 5MB limit to stay within Groq API limits (~32K tokens)
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

interface ErrorItem {
  id: string;
  message: string;
  type: 'error' | 'warning';
  category: string;
  line: number;
  confidence?: number;
  explanation?: string;
  suggestions?: string[];
  affectedLines?: number[];
  occurrences?: number;
  source: 'local' | 'ai'; // Track whether error is from local parser or AI analysis
  severity?: 'critical' | 'high' | 'medium' | 'low'; // AI-provided severity
}

const getFileIcon = (fileName: string) => {
  const extension = fileName.split('.').pop()?.toLowerCase();
  switch (extension) {
    case 'json':
      return <FileJson className="h-3.5 w-3.5 text-emerald-400" strokeWidth={2.2} />;
    case 'csv':
      return <FileText className="h-3.5 w-3.5 text-blue-400" strokeWidth={2.2} />;
    case 'xml':
      return <FileCode className="h-3.5 w-3.5 text-orange-400" strokeWidth={2.2} />;
    case 'yaml':
    case 'yml':
      return <FileCode className="h-3.5 w-3.5 text-yellow-400" strokeWidth={2.2} />;
    default:
      return <FileText className="h-3.5 w-3.5 text-slate-400" strokeWidth={2.2} />;
  }
};

// Define custom Monaco theme with professional syntax highlighting
const defineCustomTheme = (monaco: any) => {
  monaco.editor.defineTheme('detective-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      // JSON/General
      { token: 'string', foreground: 'CE9178' },           // Strings - coral
      { token: 'string.key.json', foreground: '9CDCFE' }, // JSON keys - light blue
      { token: 'keyword', foreground: '569CD6' },          // Keywords - blue
      { token: 'keyword.json', foreground: '569CD6' },
      { token: 'number', foreground: 'B5CEA8' },          // Numbers - light green
      { token: 'operator', foreground: 'D4D4D4' },         // Operators - light gray
      { token: 'delimiter.bracket', foreground: 'FFA500' }, // Brackets - orange
      { token: 'delimiter.parenthesis', foreground: 'D4D4D4' },
      { token: 'delimiter.square', foreground: 'D4D4D4' },
      { token: 'comment', foreground: '6A9955' },         // Comments - green
      // CSV Headers
      { token: 'csv.header', foreground: '4EC9B0' },      // Headers - teal
      // XML
      { token: 'tag', foreground: '569CD6' },             // XML tags - blue
      { token: 'attribute.name', foreground: '9CDCFE' },  // Attributes - light blue
      { token: 'attribute.value', foreground: 'CE9178' }, // Attribute values - coral
      // YAML
      { token: 'key', foreground: '9CDCFE' },             // YAML keys - light blue
      { token: 'literal', foreground: '6A9955' },         // YAML literals - green
    ],
    colors: {
      'editor.background': '#0F1113',
      'editor.foreground': '#D4D4D4',
      'editor.lineNumbersBackground': '#0F1113',
      'editor.lineNumbersForeground': '#3E4247',
      'editor.selectionBackground': '#264F78',
      'editor.selectionForeground': '#D4D4D4',
      'editor.inactiveSelectionBackground': '#264F7844',
      'editorCursor.foreground': '#3D8BFF',
      'editorWhitespace.foreground': '#3E4247',
      'editorBracketMatch.background': '#264F78',
      'editorBracketMatch.border': '#3D8BFF',
      'editor.foldBackground': '#264F7844',
    }
  });
};

const DetectiveD = () => {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);
  const decorationsRef = useRef<string[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [selectedErrorId, setSelectedErrorId] = useState<string | null>(null);
  const [editorContent, setEditorContent] = useState<string>("");
  const [errors, setErrors] = useState<ErrorItem[]>([]);
  const [lastValidationTime, setLastValidationTime] = useState<number | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisMode, setAnalysisMode] = useState<'local' | 'ai'>('local');

  // Check authentication on mount
  useEffect(() => {
    const isAuthenticated = sessionStorage.getItem("detective_d_auth");
    if (!isAuthenticated) {
      toast.error("Access denied. Please enter the developer passcode.");
      navigate("/");
    }
  }, [navigate]);

  const handleFileUpload = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check file size before reading
      if (file.size > MAX_FILE_SIZE_BYTES) {
        toast.error(`File too large: ${(file.size / (1024 * 1024)).toFixed(2)}MB`, {
          description: `Maximum file size is ${MAX_FILE_SIZE_MB}MB. Please use a smaller file or split your data.`,
          duration: 6000,
        });
        e.target.value = '';
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        
        // Double-check content size
        const contentSizeMB = new Blob([content]).size / (1024 * 1024);
        if (contentSizeMB > MAX_FILE_SIZE_MB) {
          toast.error(`Content too large: ${contentSizeMB.toFixed(2)}MB`, {
            description: `Maximum file size is ${MAX_FILE_SIZE_MB}MB for AI analysis.`,
            duration: 6000,
          });
          return;
        }

        const newFile: UploadedFile = {
          id: Date.now().toString(),
          name: file.name,
          content: content
        };
        setUploadedFiles(prev => [...prev, newFile]);
        setActiveFileId(newFile.id);
        
        toast.success('File uploaded successfully', {
          description: `${file.name} (${(file.size / 1024).toFixed(1)}KB)`,
          duration: 3000,
        });
      };
      reader.readAsText(file);
      // Clear input value to allow re-uploading the same file
      e.target.value = '';
    }
  };

  const handleReset = () => {
    setUploadedFiles([]);
    setActiveFileId(null);
    setEditorContent("");
    setErrors([]);
    setSelectedErrorId(null);
    setLastValidationTime(null);
    // Clear file input to allow re-uploading the same file
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const closeFile = (fileId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setUploadedFiles(prev => prev.filter(f => f.id !== fileId));
    if (activeFileId === fileId) {
      setActiveFileId(uploadedFiles[0]?.id || null);
    }
  };

  const activeFile = uploadedFiles.find(f => f.id === activeFileId);

  // Update editor content when active file changes
  useEffect(() => {
    if (activeFile) {
      setEditorContent(activeFile.content);
    }
  }, [activeFile]);

  // Syntax validation function
  const validateSyntax = (content: string, fileName: string): ErrorItem[] => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    const detectedErrors: ErrorItem[] = [];

    try {
      switch (extension) {
        case 'json':
          // JSON validation
          try {
            JSON.parse(content);
          } catch (e: any) {
            const message = e.message;
            const posMatch = message.match(/position (\d+)/);
            let line = 1;
            
            if (posMatch) {
              const pos = parseInt(posMatch[1], 10);
              const lines = content.substring(0, pos).split('\n');
              line = lines.length;
            }

            let errorMsg = 'Invalid JSON syntax';
            let suggestion = 'Check for missing brackets, commas, or quotes';
            
            if (message.includes('Unexpected token')) {
              const token = message.match(/Unexpected token (.)/)?.[1];
              errorMsg = `Unexpected token ${token || ''}`;
              suggestion = `Remove or correct the unexpected character at line ${line}`;
            } else if (message.includes('Unexpected end')) {
              errorMsg = 'Unexpected end of JSON';
              suggestion = 'Check for unclosed brackets, braces, or quotes';
            } else if (message.includes('Unexpected string')) {
              errorMsg = 'Unexpected string';
              suggestion = 'Add a comma before this property or check for extra quotes';
            }

            detectedErrors.push({
              id: Date.now().toString(),
              message: errorMsg,
              type: 'error',
              category: 'Syntax',
              line: line,
              confidence: 95,
              source: 'local'
            });
          }
          break;

        case 'csv':
          // CSV validation - basic check
          const lines = content.split('\n').filter(l => l.trim());
          if (lines.length === 0) break;

          const firstRowCols = lines[0].split(',').length;
          lines.forEach((line, idx) => {
            const cols = line.split(',').length;
            if (cols !== firstRowCols) {
              detectedErrors.push({
                id: `csv-${idx}`,
                message: `Inconsistent column count`,
                source: 'local',
                type: 'warning',
                category: 'Format',
                line: idx + 1,
                confidence: 85
              });
            }
          });
          break;

        case 'xml':
          // XML validation using DOMParser
          const parser = new DOMParser();
          const xmlDoc = parser.parseFromString(content, 'application/xml');
          const errorNode = xmlDoc.querySelector('parsererror');
          
          if (errorNode) {
            const errorText = errorNode.textContent || 'XML parsing error';
            const lineMatch = errorText.match(/line (\d+)/i);
            const line = lineMatch ? parseInt(lineMatch[1], 10) : 1;

            detectedErrors.push({
              id: Date.now().toString(),
              message: 'Invalid XML syntax',
              type: 'error',
              category: 'Syntax',
              line: line,
              confidence: 90,
              source: 'local'
            });
          }
          break;

        default:
          // No validation for unsupported types
          break;
      }
    } catch (e) {
      console.error('Validation error:', e);
    }

    return detectedErrors;
  };

  // Group similar errors occurring on different lines
  const groupSimilarErrors = (errors: ErrorItem[]): ErrorItem[] => {
    const errorGroups = new Map<string, ErrorItem>();

    errors.forEach(error => {
      // Create a key based on message and category (ignore line number)
      const key = `${error.message}-${error.category}-${error.type}`;
      
      if (errorGroups.has(key)) {
        const existing = errorGroups.get(key)!;
        // Add line to affected lines
        if (!existing.affectedLines) {
          existing.affectedLines = [existing.line];
        }
        if (!existing.affectedLines.includes(error.line)) {
          existing.affectedLines.push(error.line);
        }
        existing.occurrences = (existing.occurrences || 1) + 1;
        // Keep the explanation and suggestions from the first occurrence
        if (!existing.explanation && error.explanation) {
          existing.explanation = error.explanation;
        }
        if ((!existing.suggestions || existing.suggestions.length === 0) && error.suggestions) {
          existing.suggestions = error.suggestions;
        }
      } else {
        errorGroups.set(key, {
          ...error,
          affectedLines: [error.line],
          occurrences: 1,
        });
      }
    });

    return Array.from(errorGroups.values()).sort((a, b) => a.line - b.line);
  };

  // Correct line numbers by searching actual file content
  const correctLineNumbers = (errors: ErrorItem[], fileContent: string): ErrorItem[] => {
    const lines = fileContent.split('\n');
    
    return errors.map(error => {
      // If line number is already accurate (from local validation), keep it
      if (error.source === 'local') {
        return error;
      }
      
      // For AI errors, try to find the actual line
      const llmLine = error.line || 1;
      
      // Extract key terms from error message to search for
      const searchTerms = extractSearchTerms(error.message);
      
      if (searchTerms.length === 0) {
        // No searchable terms, keep LLM's guess
        return error;
      }
      
      // Search for the error near the LLM's guessed line first (within ±10 lines)
      const searchStart = Math.max(0, llmLine - 11);
      const searchEnd = Math.min(lines.length, llmLine + 10);
      
      for (let i = searchStart; i < searchEnd; i++) {
        const lineContent = lines[i].toLowerCase();
        if (searchTerms.some(term => lineContent.includes(term))) {
          return { ...error, line: i + 1 };
        }
      }
      
      // If not found nearby, search entire file
      for (let i = 0; i < lines.length; i++) {
        const lineContent = lines[i].toLowerCase();
        if (searchTerms.some(term => lineContent.includes(term))) {
          return { ...error, line: i + 1 };
        }
      }
      
      // Could not find, keep LLM's guess but mark as uncertain
      return { ...error, line: llmLine };
    });
  };

  // Extract searchable terms from error message
  const extractSearchTerms = (message: string): string[] => {
    const terms: string[] = [];
    
    // Extract field names in quotes: "age", "price", etc.
    const quotedFields = message.match(/"([^"]+)"/g);
    if (quotedFields) {
      terms.push(...quotedFields.map(q => q.replace(/"/g, '').toLowerCase()));
    }
    
    // Extract values that might appear in code: -5, 150, etc.
    const numbers = message.match(/\b-?\d+\.?\d*\b/g);
    if (numbers) {
      terms.push(...numbers);
    }
    
    // Extract key property names without quotes
    const propertyPatterns = [
      /(?:field|property|column)\s+['"]?(\w+)['"]?/i,
      /['"]?(\w+)['"]?\s+(?:field|property|column)/i,
    ];
    
    propertyPatterns.forEach(pattern => {
      const match = message.match(pattern);
      if (match && match[1]) {
        terms.push(match[1].toLowerCase());
      }
    });
    
    return terms;
  };

  // AI-powered analysis using Phase B backend
  const analyzeWithAI = async () => {
    if (!activeFile || !editorContent) return;

    setIsAnalyzing(true);
    setAnalysisMode('ai');
    
    try {
      const extension = activeFile.name.split('.').pop()?.toLowerCase();
      let fileType = 'auto';
      if (extension === 'json') fileType = 'json';
      else if (extension === 'csv') fileType = 'csv';
      else if (extension === 'xml') fileType = 'xml';
      else if (extension === 'yaml' || extension === 'yml') fileType = 'yaml';

      const requestPayload = {
        content: editorContent,
        file_type: fileType,
        file_name: activeFile.name,
      };
      
      const requestBody = JSON.stringify(requestPayload);
      const requestSize = new Blob([requestBody]).size;
      
      console.log('Sending AI analysis request', {
        fileSize: `${(requestSize / 1024).toFixed(2)}KB`,
        contentLength: editorContent.length,
        fileType,
        endpoint: 'Supabase Edge Function: analyze',
      });

      // Call Supabase Edge Function (no more 413 errors!)
      const response = await fetch('https://emvtxsjzxcpluflrdyut.supabase.co/functions/v1/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVtdnR4c2p6eGNwbHVmbHJkeXV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM2MjQ5MjUsImV4cCI6MjA3OTIwMDkyNX0.KWfgtAvdCtk2aETI6KzVjK5G_Anxn3cGeHvJFoGTxRo`,
        },
        body: requestBody,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API response:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText,
        });
        throw new Error(`API error ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      console.log('AI analysis response:', {
        status: response.status,
        errorsCount: result.errors?.length || 0,
        rawResponse: result,
      });
      
      console.log('===== DEBUGGING DEEP DIVE =====');
      console.log('1. Raw API response errors:', result.errors);
      console.log('2. Response type:', typeof result);
      console.log('3. Response keys:', Object.keys(result));
      console.log('4. Errors array:', Array.isArray(result.errors), 'Length:', result.errors?.length);
      
      // Transform API response to ErrorItem format
      const rawErrors: ErrorItem[] = (result.errors || []).map((err: any, idx: number) => ({
        id: `ai-${Date.now()}-${idx}`,
        message: err.message || err.description || 'Unknown error',
        type: err.type === 'warning' ? 'warning' : 'error',
        category: err.category || err.type || 'General',
        line: err.line || err.position?.line || 1,
        confidence: typeof err.confidence === 'number' ? err.confidence * 100 : 85,
        explanation: err.explanation || err.details || '',
        suggestions: Array.isArray(err.suggestions) 
          ? err.suggestions.map((s: any) => 
              typeof s === 'string' ? s : (s.description || s.fix_code || s.code_snippet || '')
            ).filter(Boolean)
          : [],
        source: 'ai',
        severity: err.severity || 'medium',
      }));

      // COMBINE local validation errors with AI errors (don't replace!)
      const localErrors = validateSyntax(editorContent, activeFile.name);
      
      // Correct AI error line numbers by searching actual file content
      const correctedAIErrors = correctLineNumbers(rawErrors, editorContent);
      
      const allErrors = [...localErrors, ...correctedAIErrors];

      console.log('3. Local validation errors:', localErrors.length);
      console.log('4. Raw AI errors (before correction):', rawErrors.length);
      console.log('5. Corrected AI errors:', correctedAIErrors.length);
      console.log('6. Combined errors before grouping:', allErrors.length);

      // Group similar errors occurring on different lines
      const groupedErrors = groupSimilarErrors(allErrors);

      console.log('7. Grouped errors:', groupedErrors.length);
      console.log('8. Grouped errors details:', groupedErrors);
      console.log('===== END DEBUG =====');

      setErrors(groupedErrors);
      setLastValidationTime(Date.now());
      
    } catch (error: any) {
      console.error('AI analysis failed:', error);
      
      // Handle 413 Content Too Large error
      if (error.message?.includes('413')){
        toast.error('Request rejected by server (413)', {
          description: `Your file is ${(editorContent.length / 1024).toFixed(1)}KB. If still too large, try: 1) Remove comments, 2) Split into smaller files, 3) Check internet connection.`,
          duration: 7000,
        });
      } else if (error.message?.includes('API error 413')) {
        toast.error('Content size exceeds server limit', {
          description: 'The server rejected your request. Try removing unnecessary content or splitting the file.',
          duration: 6000,
        });
      } else if (error.message?.includes('API error 500')) {
        toast.error('Server processing error', {
          description: 'The backend encountered an error. Please try again or contact support.',
          duration: 6000,
        });
      } else if (error.message?.includes('Failed to fetch')) {
        toast.error('Network error - check your connection', {
          description: 'The request was blocked or your connection was interrupted.',
          duration: 6000,
        });
      } else {
        // Show helpful message - API only works when deployed
        toast.info('AI analysis unavailable', {
          description: 'Check your internet connection or try again later. Local validation is still available.',
          duration: 4000,
        });
      }
      
      // Fall back to local validation
      const localErrors = validateSyntax(editorContent, activeFile.name);
      const groupedLocalErrors = groupSimilarErrors(localErrors);
      setErrors(groupedLocalErrors);
      setAnalysisMode('local');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Validate content when it changes (with debounce)
  useEffect(() => {
    if (!activeFile || !editorContent) {
      setErrors([]);
      setSelectedErrorId(null);
      setLastValidationTime(null);
      return;
    }

    // Debounce validation for 300ms
    const timeoutId = setTimeout(() => {
      const validationErrors = validateSyntax(editorContent, activeFile.name);
      const groupedErrors = groupSimilarErrors(validationErrors);
      setErrors(groupedErrors);
      setLastValidationTime(Date.now());
      setAnalysisMode('local');
      
      // Clear selected error if it no longer exists
      if (selectedErrorId && !groupedErrors.find(e => e.id === selectedErrorId)) {
        setSelectedErrorId(null);
      }
      
      // Smart auto-trigger for AI analysis if critical errors found
      const criticalErrors = validationErrors.filter(e => e.type === 'error');
      if (criticalErrors.length > 0 && !isAnalyzing) {
        // Auto-trigger AI analysis if file has critical errors
        // This is disabled by default (user can uncomment to enable)
        // analyzeWithAI();
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [editorContent, activeFile]);

  // Generate contextual suggestions based on error
  const getSuggestions = (error: ErrorItem, fileName: string): string[] => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    const suggestions: string[] = [];

    if (extension === 'json') {
      if (error.message.includes('Unexpected token')) {
        suggestions.push('Remove or correct the unexpected character');
        suggestions.push('Check for missing commas between properties');
      } else if (error.message.includes('Unexpected end')) {
        suggestions.push('Add the missing closing bracket or brace');
        suggestions.push('Check for unclosed quotes or strings');
      } else if (error.message.includes('Unexpected string')) {
        suggestions.push('Add a comma before this property');
        suggestions.push('Remove extra quotes if present');
      } else {
        suggestions.push('Review the syntax at the indicated line');
        suggestions.push('Use a JSON validator to identify the exact issue');
      }
    } else if (extension === 'csv') {
      suggestions.push('Ensure all rows have the same number of columns');
      suggestions.push('Check for missing or extra delimiters');
    } else if (extension === 'xml') {
      suggestions.push('Ensure all tags are properly closed');
      suggestions.push('Check for mismatched opening and closing tags');
    }

    return suggestions;
  };

  // Format time elapsed since validation
  const getTimeAgoText = (timestamp: number | null): string => {
    if (!timestamp) return 'never';
    const now = Date.now();
    const elapsed = now - timestamp;
    
    if (elapsed < 1000) return 'just now';
    if (elapsed < 60000) return `${Math.floor(elapsed / 1000)}s ago`;
    if (elapsed < 3600000) return `${Math.floor(elapsed / 60000)}m ago`;
    return `${Math.floor(elapsed / 3600000)}h ago`;
  };

  // Handle summary panel click - scroll to first error
  const handleSummaryClick = () => {
    if (errors.length > 0 && editorRef.current) {
      const firstError = errors[0];
      editorRef.current.revealLineInCenter(firstError.line);
      editorRef.current.setPosition({ lineNumber: firstError.line, column: 1 });
      setSelectedErrorId(firstError.id);
    }
  };

  // Get file language for Monaco Editor
  const getLanguage = (fileName: string) => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'json': return 'json';
      case 'csv': return 'plaintext';
      case 'xml': return 'xml';
      case 'yaml':
      case 'yml': return 'yaml';
      default: return 'plaintext';
    }
  };

  // Get file type display
  const getFileType = (fileName: string) => {
    const extension = fileName.split('.').pop()?.toUpperCase();
    return extension || 'TEXT';
  };

  // Count lines in content
  const getLineCount = (content: string) => {
    return content.split('\n').length;
  };

  // Format/Beautify content
  const handleBeautify = () => {
    if (!activeFile) return;
    try {
      if (activeFile.name.endsWith('.json')) {
        const formatted = JSON.stringify(JSON.parse(editorContent), null, 2);
        setEditorContent(formatted);
      }
    } catch (e) {
      console.error('Beautify failed:', e);
    }
  };

  // Minify content
  const handleMinify = () => {
    if (!activeFile) return;
    try {
      if (activeFile.name.endsWith('.json')) {
        const minified = JSON.stringify(JSON.parse(editorContent));
        setEditorContent(minified);
      }
    } catch (e) {
      console.error('Minify failed:', e);
    }
  };

  // Download file
  const handleDownload = () => {
    if (!activeFile) return;
    const blob = new Blob([editorContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = activeFile.name;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Apply error highlights to editor with enhanced decorations
  const applyErrorHighlights = () => {
    if (!editorRef.current || !monacoRef.current) return;

    const editor = editorRef.current;
    const monaco = monacoRef.current;

    // Clear previous decorations
    if (decorationsRef.current.length > 0) {
      decorationsRef.current = editor.deltaDecorations(decorationsRef.current, []);
    }

    // Create new decorations for each error
    const newDecorations = errors.map((error) => {
      const isError = error.type === 'error';
      const isWarning = error.type === 'warning';

      return {
        range: new monaco.Range(error.line, 1, error.line, 1),
        options: {
          isWholeLine: true,
          className: isError ? 'error-line-highlight' : 'warning-line-highlight',
          glyphMarginClassName: isError ? 'error-line-glyph' : 'warning-line-glyph',
          minimap: {
            color: isError ? '#FF4D4D' : '#EAB308',
            position: monaco.editor.MinimapPosition.Inline
          },
          overviewRuler: {
            color: isError ? '#FF4D4D' : '#EAB308',
            position: monaco.editor.OverviewRulerLane.Full
          }
        }
      };
    });

    // Apply decorations with line numbers
    decorationsRef.current = editor.deltaDecorations([], newDecorations);
  };

  // Handle Monaco Editor mount
  const handleEditorDidMount = (editor: any, monaco: any) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    
    // Define custom theme with syntax highlighting
    defineCustomTheme(monaco);
    
    // Ensure proper layout on mount
    setTimeout(() => {
      editor.layout();
    }, 100);
    
    // Apply error highlights if any
    if (errors.length > 0) {
      applyErrorHighlights();
    }
    
    // Highlight error lines if selected
    if (selectedErrorId) {
      const selectedError = errors.find(e => e.id === selectedErrorId);
      if (selectedError) {
        editor.revealLineInCenter(selectedError.line);
        editor.setPosition({ lineNumber: selectedError.line, column: 1 });
      }
    }
  };

  // Apply highlights when errors change
  useEffect(() => {
    if (editorRef.current && monacoRef.current) {
      applyErrorHighlights();
    }
  }, [errors]);

  // Scroll to error line when error is selected
  useEffect(() => {
    if (editorRef.current && selectedErrorId) {
      const selectedError = errors.find(e => e.id === selectedErrorId);
      if (selectedError) {
        editorRef.current.revealLineInCenter(selectedError.line);
        editorRef.current.setPosition({ lineNumber: selectedError.line, column: 1 });
      }
    }
  }, [selectedErrorId]);

  return (
    <div className="min-h-screen h-screen bg-[#0d0f13] text-slate-200 flex flex-col overflow-hidden detective-d-slide-in">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,.csv,.xml,.yaml,.yml"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Top Navigation Bar */}
      <nav className="border-b border-slate-800 bg-[#0d0f13] px-4 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Logo and Breadcrumb Navigation */}
            <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <img src="/Logo.png" alt="DatumInt Logo" className="h-6 w-6" />
            </Link>
            <span className="mx-1 text-slate-600 text-lg font-bold select-none">/</span>
            {/* Detective D Logo */}
            <div className="flex items-center gap-2">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-slate-100">
                {/* Magnifying glass with circuit pattern - real-world tool meets digital analysis */}
                <circle cx="10.5" cy="10.5" r="6" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M15 15L19.5 19.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <path d="M7.5 10.5H13.5M10.5 7.5V13.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                <circle cx="8" cy="8" r="0.8" fill="currentColor"/>
                <circle cx="13" cy="8" r="0.8" fill="currentColor"/>
                <circle cx="8" cy="13" r="0.8" fill="currentColor"/>
                <circle cx="13" cy="13" r="0.8" fill="currentColor"/>
              </svg>
              <h1 className="text-base font-semibold text-slate-100">Detective D</h1>
            </div>
          </div>

          {/* Right Side - Utility Buttons */}
          <div className="flex items-center gap-2">
            {/* Upload File Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleFileUpload}
              className="text-slate-400 hover:text-slate-200 hover:bg-slate-800 gap-1 px-2"
              title="Upload File"
            >
              <Upload className="h-4 w-4" />
              <span className="text-xs font-medium">Upload</span>
            </Button>

            {/* AI Analysis Button */}
            {activeFile && (
              <Button
                variant="default"
                size="sm"
                onClick={analyzeWithAI}
                disabled={isAnalyzing}
                className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground gap-1.5 px-3 shadow-lg shadow-primary/25"
                title="AI-powered deep analysis - detects issues beyond basic syntax errors"
              >
                <Sparkles className={`h-4 w-4 ${isAnalyzing ? 'animate-pulse' : ''}`} />
                <span className="text-xs font-semibold">
                  {isAnalyzing ? 'AI Analyzing...' : 'Deep Dive'}
                </span>
              </Button>
            )}

            {/* Reset/Clear Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              className="text-slate-400 hover:text-slate-200 hover:bg-slate-800 gap-1 px-2"
              title="Reset / Clear"
            >
              <RotateCcw className="h-4 w-4" />
              <span className="text-xs font-medium">Reset</span>
            </Button>

            {/* Theme Toggle */}
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="relative p-2 rounded-full border border-slate-700 hover:border-slate-600 hover:bg-slate-800/50 transition-all text-slate-400 hover:text-slate-200 flex items-center justify-center w-9 h-9"
              title="Toggle Theme"
            >
              <Sun className="h-4 w-4 absolute rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="h-4 w-4 absolute rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            </button>

            {/* Help/Documentation Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="p-2 rounded-full border border-slate-700 hover:border-slate-600 hover:bg-slate-800/50 transition-all text-slate-400 hover:text-slate-200 flex items-center justify-center w-9 h-9"
                  title="Help & Documentation"
                >
                  <HelpCircle className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-slate-900 border-slate-800">
                <DropdownMenuItem className="text-slate-300 focus:bg-slate-800 focus:text-slate-100 cursor-pointer">
                  FAQ
                </DropdownMenuItem>
                <DropdownMenuItem className="text-slate-300 focus:bg-slate-800 focus:text-slate-100 cursor-pointer">
                  Examples
                </DropdownMenuItem>
                <DropdownMenuItem className="text-slate-300 focus:bg-slate-800 focus:text-slate-100 cursor-pointer">
                  How Detective D Works
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </nav>

      {/* File Tabs Bar (Horizontal) */}
      {uploadedFiles.length > 0 && (
        <div className="border-b border-slate-800 bg-[#0d0f13] flex items-center overflow-x-auto">
          {uploadedFiles.map((file) => (
            <button
              key={file.id}
              onClick={() => setActiveFileId(file.id)}
              className={`
                flex items-center gap-2 px-3 py-1.5 text-sm border-r border-slate-800 whitespace-nowrap
                transition-colors group relative
                ${activeFileId === file.id 
                  ? 'bg-slate-800/50 text-slate-100' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'
                }
              `}
            >
              {getFileIcon(file.name)}
              <span className="max-w-[150px] truncate">{file.name}</span>
              <button
                onClick={(e) => closeFile(file.id, e)}
                className="opacity-0 group-hover:opacity-100 hover:bg-slate-700 rounded p-0.5 transition-opacity"
              >
                <X className="h-3 w-3" />
              </button>
            </button>
          ))}
          <button
            onClick={handleFileUpload}
            className="flex items-center gap-1 px-3 py-1.5 text-slate-400 hover:text-slate-200 transition-colors"
            title="Upload another file"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Main Content Area - 3 Column Grid */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-[280px_1fr_350px] gap-0 overflow-hidden">
        {/* Left Panel - Error List Sidebar */}
        <div className="border-r border-[#1C1F22] bg-[#111315] overflow-y-auto">
          {/* Header */}
          <div className="px-3 py-3 border-b border-[#1C1F22]">
            <h2 className="text-sm font-semibold text-[#E6E7E9]">
              Errors ({errors.length})
            </h2>
          </div>
          
          {/* Error Items */}
          {errors.length > 0 ? (
            <div className="py-1">
              {/* Info Banner */}
              <div className="px-3 py-2.5 bg-[#1A1D20] border-b border-[#1C1F22]">
                <div className="text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-[#E6E7E9]">
                      {errors.filter(e => e.type === 'error').length} errors found
                    </span>
                    {errors.some(e => e.source === 'ai') && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-primary/20 text-primary border border-primary/30">
                        <Sparkles className="h-2.5 w-2.5" />
                        AI Enhanced
                      </span>
                    )}
                  </div>
                  <div className="text-[#7A7F86]">
                    {errors.some(e => e.source === 'ai') 
                      ? 'AI found issues beyond basic syntax' 
                      : 'Click "Deep Dive" for AI insights'
                    }
                  </div>
                </div>
              </div>
              
              {errors.map((error) => (
                <button
                  key={error.id}
                  onClick={() => setSelectedErrorId(error.id)}
                  className={`
                    w-full px-3 py-2 text-left transition-all
                    hover:bg-[#1A1D20]
                    ${selectedErrorId === error.id 
                      ? 'bg-[#1A1D20] border-l-2 border-[#3D8BFF]' 
                      : 'border-l-2 border-transparent'
                    }
                  `}
                >
                  <div className="flex items-start gap-2">
                    {error.type === 'error' ? (
                      <CircleAlert className="h-3.5 w-3.5 text-[#E6E7E9] mt-0.5 flex-shrink-0" strokeWidth={2} />
                    ) : (
                      <TriangleAlert className="h-3.5 w-3.5 text-[#E6E7E9] mt-0.5 flex-shrink-0" strokeWidth={2} />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-medium text-[#E6E7E9] leading-tight">
                          {error.message}
                        </div>
                        {error.source === 'ai' && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-primary/20 text-primary border border-primary/30">
                            <Sparkles className="h-2.5 w-2.5" />
                            AI
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-[#7A7F86] mt-1 flex items-center gap-1.5">
                        <span>{error.category}</span>
                        {error.severity && error.source === 'ai' && (
                          <>
                            <span>•</span>
                            <span className={`font-medium ${
                              error.severity === 'critical' ? 'text-red-400' :
                              error.severity === 'high' ? 'text-orange-400' :
                              error.severity === 'medium' ? 'text-yellow-400' :
                              'text-blue-400'
                            }`}>
                              {error.severity}
                            </span>
                          </>
                        )}
                        <span>•</span>
                        <span>{error.occurrences && error.occurrences > 1 
                          ? `Lines ${error.affectedLines?.join(', ')} (${error.occurrences}×)`
                          : `Line ${error.line}`
                        }</span>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="px-3 py-8 text-center space-y-3">
              <div className="text-sm text-[#7A7F86]">✓ No issues found</div>
              <div className="text-xs text-[#7A7F86]">The file looks valid.</div>
              <div className="pt-4 border-t border-[#1C1F22]">
                <div className="text-xs text-[#5A5F66] font-semibold mb-2">How it works:</div>
                <div className="text-xs text-[#5A5F66] leading-relaxed space-y-1">
                  <div>1. Upload a file (auto-detected)</div>
                  <div>2. Get instant error feedback</div>
                  <div>3. Click "Deep Dive" for AI insights</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Middle Panel - Code Editor */}
        <div className="border-x border-[#1B1E21] bg-[#0F1113] flex flex-col">
          {activeFile ? (
            <>
              {/* Top Toolbar */}
              <div className="h-10 border-b border-[#1C1F22] bg-[#0F1113] flex items-center justify-between px-3">
                {/* Left: File Info */}
                <div className="flex items-center gap-3 text-xs text-[#7A7F86]">
                  <span className="font-medium text-[#D0D3D8]">{getFileType(activeFile.name)}</span>
                  <span>•</span>
                  <span>Lines: {getLineCount(editorContent)}</span>
                  <span>•</span>
                  <span>Chars: {editorContent.length}</span>
                </div>
                
                {/* Right: Action Buttons */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleBeautify}
                    className="rounded px-2.5 py-1 text-xs text-[#D0D3D8] hover:bg-[#1A1D20] transition-colors flex items-center gap-1.5"
                    title="Format / Beautify"
                  >
                    <Wand2 className="h-3 w-3" strokeWidth={2} />
                    Pretty Print
                  </button>
                  <button
                    onClick={handleMinify}
                    className="rounded px-2.5 py-1 text-xs text-[#D0D3D8] hover:bg-[#1A1D20] transition-colors flex items-center gap-1.5"
                    title="Minify"
                  >
                    <Minimize2 className="h-3 w-3" strokeWidth={2} />
                    Minify
                  </button>
                  <button
                    onClick={handleDownload}
                    className="rounded px-2.5 py-1 text-xs text-[#D0D3D8] hover:bg-[#1A1D20] transition-colors flex items-center gap-1.5"
                    title="Download"
                  >
                    <Download className="h-3 w-3" strokeWidth={2} />
                    Download
                  </button>
                </div>
              </div>

              {/* Error Summary Panel (A4) */}
              {activeFile && (
                <div 
                  onClick={handleSummaryClick}
                  className="h-9 border-b border-[#1C1F22] bg-[#0F1113] flex items-center px-3 cursor-pointer hover:bg-[#151719] transition-colors"
                >
                  <div className="flex items-center gap-4 text-xs text-[#7A7F86]">
                    {/* Error count */}
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full" style={{
                        backgroundColor: errors.length > 0 ? (errors.some(e => e.type === 'error') ? '#FF4D4D' : '#EAB308') : '#4EC9B0'
                      }}></span>
                      <span>
                        <span className="text-[#D0D3D8] font-medium">
                          {errors.filter(e => e.type === 'error').length}
                        </span>
                        {' error' + (errors.filter(e => e.type === 'error').length !== 1 ? 's' : '')}
                      </span>
                    </div>

                    {/* Warning count */}
                    <div className="flex items-center gap-2">
                      <span className="text-[#7A7F86]">•</span>
                      <span>
                        <span className="text-[#D0D3D8] font-medium">
                          {errors.filter(e => e.type === 'warning').length}
                        </span>
                        {' warning' + (errors.filter(e => e.type === 'warning').length !== 1 ? 's' : '')}
                      </span>
                    </div>

                    {/* Analysis mode */}
                    <div className="flex items-center gap-2">
                      <span className="text-[#7A7F86]">•</span>
                      <span className={analysisMode === 'ai' ? 'text-primary font-medium' : ''}>
                        {analysisMode === 'ai' ? 'AI Analysis' : 'Local Validation'}
                      </span>
                    </div>

                    {/* Last updated */}
                    <div className="flex items-center gap-2 ml-auto">
                      <span className="text-[#7A7F86]">•</span>
                      <span>Updated {getTimeAgoText(lastValidationTime)}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Monaco Editor */}
              <div className="flex-1 overflow-hidden relative">
                <Editor
                  key={activeFile.id}
                  height="100%"
                  language={getLanguage(activeFile.name)}
                  value={editorContent}
                  onChange={(value) => setEditorContent(value || "")}
                  beforeMount={(monaco) => {
                    // Define theme before editor mounts to prevent white flash
                    defineCustomTheme(monaco);
                  }}
                  onMount={handleEditorDidMount}
                  theme="detective-dark"
                  loading={<div className="flex items-center justify-center h-full bg-[#0F1113] text-[#7A7F86]">Loading editor...</div>}
                  options={{
                    fontSize: 14,
                    fontFamily: "JetBrains Mono, Fira Code, Consolas, monospace",
                    lineHeight: 21,
                    letterSpacing: 0,
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                    renderLineHighlight: 'line',
                    cursorStyle: 'line',
                    cursorBlinking: 'smooth',
                    cursorSmoothCaretAnimation: 'on',
                    smoothScrolling: true,
                    padding: { top: 16, bottom: 16 },
                    lineNumbers: 'on',
                    lineNumbersMinChars: 3,
                    glyphMargin: true,
                    folding: true,
                    selectOnLineNumbers: true,
                    roundedSelection: false,
                    readOnly: false,
                    automaticLayout: true,
                    wordWrap: 'off',
                    wrappingIndent: 'none',
                    renderWhitespace: 'selection',
                    tabSize: 2,
                    insertSpaces: true,
                    detectIndentation: true,
                    trimAutoWhitespace: true,
                    formatOnPaste: true,
                    formatOnType: true,
                    guides: {
                      indentation: true,
                      highlightActiveIndentation: true,
                      bracketPairs: true
                    },
                    bracketPairColorization: {
                      enabled: true
                    },
                    quickSuggestions: true,
                    suggestOnTriggerCharacters: true,
                    acceptSuggestionOnEnter: 'on',
                    mouseWheelZoom: false,
                    fixedOverflowWidgets: true
                  }}
                />
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center px-6 space-y-4">
                <Upload className="h-12 w-12 text-[#7A7F86] mx-auto mb-3" />
                <div>
                  <div className="text-sm text-[#E6E7E9] mb-1 font-medium">No file selected</div>
                  <div className="text-xs text-[#7A7F86]">Upload a file to start analyzing</div>
                </div>
                <div className="pt-3 border-t border-[#1C1F22] text-xs text-[#5A5F66] space-y-1">
                  <div>Supported: JSON, CSV, XML, YAML</div>
                  <div>Max size: <span className="font-semibold text-[#7A7F86]">{MAX_FILE_SIZE_MB}MB</span></div>
                  <div>AI analysis available up to 5MB</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Panel - Error Details Analysis */}
        <div className="border-l border-[#1C1F22] bg-[#101113] overflow-y-auto">
          {selectedErrorId && activeFile ? (
            (() => {
              const selectedError = errors.find(e => e.id === selectedErrorId);
              if (!selectedError) return null;

              return (
                <div className="h-full flex flex-col">
                  {/* Header */}
                  <div className="px-4 py-4 border-b border-[#1C1F22]">
                    <h2 className="text-sm font-semibold text-[#E6E7E9]">
                      Error Details
                    </h2>
                  </div>

                  {/* Content */}
                  <div className="px-4 py-4 overflow-y-auto flex-1">
                    {/* Error Title Block */}
                    <div className="error-details-section">
                      <div className="flex items-start gap-2 mb-2">
                        <h3 className="text-base font-medium text-[#E6E7E9] flex-1">
                          {selectedError.message}
                        </h3>
                        {selectedError.source === 'ai' ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-semibold bg-primary/20 text-primary border border-primary/30">
                            <Sparkles className="h-3 w-3" />
                            AI Detected
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-semibold bg-gray-500/20 text-gray-400 border border-gray-500/30">
                            Local Parser
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-[#7A7F86] space-y-1">
                        <div className="flex flex-wrap items-center gap-x-2">
                          <span className="text-[#9CA3AF] font-medium">{selectedError.category}</span>
                          {selectedError.severity && selectedError.source === 'ai' && (
                            <>
                              <span>•</span>
                              <span className={`font-semibold ${
                                selectedError.severity === 'critical' ? 'text-red-400' :
                                selectedError.severity === 'high' ? 'text-orange-400' :
                                selectedError.severity === 'medium' ? 'text-yellow-400' :
                                'text-blue-400'
                              }`}>
                                {selectedError.severity.toUpperCase()}
                              </span>
                            </>
                          )}
                          <span>•</span>
                          <span>Line {selectedError.line}</span>
                          <span>•</span>
                          <span>Confidence {selectedError.confidence || 85}%</span>
                        </div>
                      </div>
                    </div>

                    {/* Affected Lines (if grouped) */}
                    {selectedError.occurrences && selectedError.occurrences > 1 && (
                      <div className="error-details-section">
                        <div className="text-xs font-semibold text-[#7A7F86] uppercase tracking-wide mb-2">
                          Affected Lines ({selectedError.occurrences})
                        </div>
                        <p className="text-sm text-[#D0D3D8] leading-relaxed">
                          This error occurs on {selectedError.occurrences} different lines: {selectedError.affectedLines?.join(', ')}
                        </p>
                      </div>
                    )}

                    {/* Explanation Section */}
                    <div className="error-details-section">
                      <div className="text-xs font-semibold text-[#7A7F86] uppercase tracking-wide mb-2">
                        Explanation
                      </div>
                      <p className="text-sm text-[#D0D3D8] leading-relaxed">
                        {selectedError.explanation || (
                          selectedError.type === 'error' 
                            ? `A syntax error has been detected at line ${selectedError.line}. This error prevents the file from being parsed correctly. The parser encountered an unexpected token or structure that doesn't conform to the expected format.`
                            : `A potential issue has been identified at line ${selectedError.line}. While the file may still be valid, this structure could lead to unexpected behavior or parsing issues.`
                        )}
                      </p>
                    </div>

                    {/* Suggested Fixes Section */}
                    <div className="error-details-section">
                      <div className="text-xs font-semibold text-[#7A7F86] uppercase tracking-wide mb-2">
                        Suggested Fixes ({(selectedError.suggestions && selectedError.suggestions.length > 0) 
                          ? selectedError.suggestions.length 
                          : getSuggestions(selectedError, activeFile.name).length})
                      </div>
                      <div className="space-y-2">
                        {(selectedError.suggestions && selectedError.suggestions.length > 0 
                          ? selectedError.suggestions 
                          : getSuggestions(selectedError, activeFile.name)
                        ).map((suggestion, idx) => (
                          <div key={idx} className="text-sm text-[#D0D3D8]">
                            <span className="text-[#7A7F86]">•</span>
                            <span className="ml-2">{suggestion}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Affected Area Section */}
                    <div className="error-details-section">
                      <div className="text-xs font-semibold text-[#7A7F86] uppercase tracking-wide mb-2">
                        Affected Area
                      </div>
                      <div className="text-sm text-[#D0D3D8] bg-[#0F1113] rounded px-3 py-2 font-mono">
                        {selectedError.occurrences && selectedError.occurrences > 1 
                          ? `Lines: ${selectedError.affectedLines?.join(', ')}`
                          : `Line ${selectedError.line}`
                        }
                      </div>
                    </div>

                    {/* Confidence Breakdown */}
                    <div className="error-details-section">
                      <div className="text-xs font-semibold text-[#7A7F86] uppercase tracking-wide mb-2">
                        Detection Confidence
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-[#0F1113] rounded-full h-2 overflow-hidden">
                            <div 
                              className={`h-full transition-all ${
                                (selectedError.confidence || 85) >= 90 ? 'bg-green-500' :
                                (selectedError.confidence || 85) >= 75 ? 'bg-blue-500' :
                                (selectedError.confidence || 85) >= 60 ? 'bg-yellow-500' :
                                'bg-orange-500'
                              }`}
                              style={{ width: `${selectedError.confidence || 85}%` }}
                            />
                          </div>
                          <span className="text-sm font-semibold text-[#E6E7E9] min-w-[45px]">
                            {selectedError.confidence || 85}%
                          </span>
                        </div>
                        <p className="text-sm text-[#D0D3D8] leading-relaxed">
                          {selectedError.source === 'ai' 
                            ? `AI analysis confidence based on semantic understanding, pattern recognition, and best practices validation.`
                            : `Local parser detection based on syntax rules and format specifications. ${selectedError.confidence && selectedError.confidence >= 95 ? 'High confidence indicates a definite syntax violation.' : ''}`
                          }
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()
          ) : (
            <div className="h-full flex items-center justify-center">
              <div className="text-center px-4">
                <div className="text-sm text-[#7A7F86]">Select an error to view details</div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default DetectiveD;
