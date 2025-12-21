import { Link, useNavigate } from "react-router-dom";
import { Upload, RotateCcw, Moon, Sun, HelpCircle, X, Check, Plus, FileJson, FileText, FileCode, CircleAlert, TriangleAlert, Download, Wand2, Minimize2, Table, AlignLeft, Zap, ExternalLink, FileDown, Share2, Shield, Bell, MessageSquare, AlertCircle, Info } from "lucide-react";
import { HelpCenterModal } from "@/components/HelpCenterModal";
import { DetectiveDExplainerModal } from "@/components/DetectiveDExplainerModal";
import { ShareModal } from "@/components/ShareModal";
import { AuditLogModal } from "@/components/AuditLogModal";
import { ExportModal } from "@/components/ExportModal";
import { useState, useRef, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import Editor from "@monaco-editor/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { useTheme } from "next-themes";
import { DetectiveD as DetectiveDEngine, DetectiveFinding } from "@/lib/detectiveD";
import { StructureValidator, StructureIssue, StructureValidationResult } from "@/lib/structureValidator";

interface UploadedFile {
  id: string;
  name: string;
  content: string;
}

// File size limits
const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

// ============================================================================
// UI TYPE - Convert Detective Finding to ErrorItem for display
// ============================================================================
interface ErrorItem {
  id: string;
  /** Display line number (derived from offset) */
  line: number;
  /** Display column number (derived from offset) */
  column?: number;
  /** Character offset range for precise highlighting */
  startOffset?: number;
  endOffset?: number;
  type: 'error' | 'warning';
  message: string;
  category?: string;
  source?: 'detective';
  severity?: 'error' | 'warning' | 'info';
  confidence?: 'high' | 'medium' | 'low';
  explanation?: string;
  suggestions?: string[];
  
  // Detective D specific properties
  evidence?: {
    observed?: string;
    expected_range?: string;
    expected?: string;
    context?: string;
    statistic?: string;
  };
  whyItMatters?: string;
  suggestedAction?: string;
}

interface TableView {
  columns: string[];
  rows: string[][];
  error?: string;
}

// Custom Monaco theme definition
const defineCustomTheme = (monaco: any) => {
  monaco.editor.defineTheme('detective-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'string', foreground: 'CE9178' },          // Strings - coral
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
  const [selectedStructureIssue, setSelectedStructureIssue] = useState<StructureIssue | null>(null);
  const [editorContent, setEditorContent] = useState<string>("");
  const [errors, setErrors] = useState<ErrorItem[]>([]);
  const [lastValidationTime, setLastValidationTime] = useState<number | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [structureIssues, setStructureIssues] = useState<StructureIssue[]>([]);
  const [hasStructureErrors, setHasStructureErrors] = useState(false);
  const [isFixingStructure, setIsFixingStructure] = useState(false);
  const [showFileLimitModal, setShowFileLimitModal] = useState(false);
  const [isRealTimeValidating, setIsRealTimeValidating] = useState(false);
  const [validationTimeoutId, setValidationTimeoutId] = useState<NodeJS.Timeout | null>(null);
  const [viewMode, setViewMode] = useState<'text' | 'table'>('text');
  const [helpCenterOpen, setHelpCenterOpen] = useState(false);
  const [showExplainerModal, setShowExplainerModal] = useState(true);
  
  // Edit mode: track if user is editing after analysis (shows cancel/confirm buttons)
  const [isEditMode, setIsEditMode] = useState(false);
  const [originalContent, setOriginalContent] = useState<string>("");
  const [hasAnalyzedOnce, setHasAnalyzedOnce] = useState(false);
  
  // Modal open/close state
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [auditModalOpen, setAuditModalOpen] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [stayConnectedModalOpen, setStayConnectedModalOpen] = useState(false);
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackEmail, setFeedbackEmail] = useState("");
  const [feedbackOptIn, setFeedbackOptIn] = useState(false);
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  const [stayConnectedEmail, setStayConnectedEmail] = useState("");
  const [stayConnectedOptIn, setStayConnectedOptIn] = useState(false);
  
  // Store errors and structure issues per file ID for persistence
  const fileErrorsRef = useRef<Map<string, ErrorItem[]>>(new Map());
  const fileStructureIssuesRef = useRef<Map<string, StructureIssue[]>>(new Map());
  const fileAnalyzedRef = useRef<Map<string, boolean>>(new Map());
  const fileOriginalContentRef = useRef<Map<string, string>>(new Map());

  // Detective D is now public - no passcode required

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
        
        // Limit to maximum 2 open files
        if (uploadedFiles.length >= 2) {
          setShowFileLimitModal(true);
          return;
        }
        
        setUploadedFiles(prev => [...prev, newFile]);
        setActiveFileId(newFile.id);
        
        // Automatically validate structure on upload
        validateFileStructure(content, file.name);
        
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
    // Clear validation timeout
    if (validationTimeoutId) {
      clearTimeout(validationTimeoutId);
      setValidationTimeoutId(null);
    }
    
    setUploadedFiles([]);
    setActiveFileId(null);
    setEditorContent("");
    setErrors([]);
    setStructureIssues([]);
    setHasStructureErrors(false);
    setSelectedErrorId(null);
    setSelectedStructureIssue(null);
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
      setSelectedErrorId(null);
      setSelectedStructureIssue(null);
      
      // Restore errors and structure issues for this file (complete isolation)
      const savedErrors = fileErrorsRef.current.get(activeFile.id) || [];
      const savedStructureIssues = fileStructureIssuesRef.current.get(activeFile.id) || [];
      const wasAnalyzed = fileAnalyzedRef.current.get(activeFile.id) || false;
      const savedOriginalContent = fileOriginalContentRef.current.get(activeFile.id) || activeFile.content;
      
      setErrors(savedErrors);
      setStructureIssues(savedStructureIssues);
      setHasStructureErrors(savedStructureIssues.length > 0 && savedStructureIssues.some(i => i.type === 'error'));
      setHasAnalyzedOnce(wasAnalyzed);
      setOriginalContent(savedOriginalContent);
      setIsEditMode(false); // Reset edit mode when switching files
      
      // Only re-validate if no saved issues exist
      if (savedStructureIssues.length === 0) {
        validateFileStructure(activeFile.content, activeFile.name);
      }
    }
  }, [activeFile]);

  // ============================================================================
  // NOTE: Deep Dive / AI Analysis REMOVED
  // All analysis is now deterministic via Detective D engine running locally
  // Real-time validation happens automatically - no external API calls
  // ============================================================================
  // Manual analysis function - triggered by button click only
  // ============================================================================

  const runAnalysis = async () => {
    if (!activeFile || !editorContent || editorContent.trim().length === 0) {
      setErrors([]);
      toast.info('No data to analyze', {
        description: 'Please upload or paste data first',
        duration: 3000
      });
      return;
    }

    // Re-validate structure using CURRENT editor content before analysis
    const extension = activeFile.name.split('.').pop()?.toLowerCase();
    let fileType: 'json' | 'csv' | 'xml' | 'yaml';
    switch (extension) {
      case 'json': fileType = 'json'; break;
      case 'csv': fileType = 'csv'; break;
      case 'xml': fileType = 'xml'; break;
      case 'yaml':
      case 'yml': fileType = 'yaml'; break;
      default: fileType = 'json';
    }
    
    const validator = new StructureValidator(editorContent, fileType);
    const structureResult = validator.validate();
    
    // Update structure issues with current validation
    setStructureIssues(structureResult.issues);
    fileStructureIssuesRef.current.set(activeFile.id, structureResult.issues);
    setHasStructureErrors(!structureResult.isValid);
    
    // Prevent analysis if structural issues exist in CURRENT content
    if (!structureResult.isValid && structureResult.issues.length > 0) {
      toast.error('Analysis blocked', {
        description: 'Please fix structural issues before running analysis. Structure errors must be resolved first.',
        duration: 5000
      });
      return;
    }

    try {
      setIsAnalyzing(true);
      
      // Run Detective D engine
      const engine = new DetectiveDEngine(editorContent, activeFile.name);
      const findings = await engine.analyze();
      
      // Convert findings to ErrorItem for display
      const displayItems: ErrorItem[] = findings.map(finding => ({
        id: finding.id,
        line: finding.location.row || 1, // Display line number (derived from offset)
        column: finding.location.column ? Number(finding.location.column) : undefined,
        startOffset: finding.location.startOffset, // Primary reference for highlighting
        endOffset: finding.location.endOffset,
        type: finding.severity === 'error' ? 'error' : 'warning',
        message: finding.summary,
        category: finding.category,
        source: 'detective',
        severity: finding.severity as 'error' | 'warning' | 'info',
        confidence: finding.confidence as 'high' | 'medium' | 'low',
        explanation: `${finding.evidence.observed ? `Observed: ${JSON.stringify(finding.evidence.observed)}. ` : ''}${finding.why_it_matters}`,
        suggestions: [finding.suggested_action],
        
        // Include Detective D's detailed evidence
        evidence: finding.evidence,
        whyItMatters: finding.why_it_matters,
        suggestedAction: finding.suggested_action
      }));
      
      setErrors(displayItems);
      if (activeFile) {
        fileErrorsRef.current.set(activeFile.id, displayItems);
        fileAnalyzedRef.current.set(activeFile.id, true);
        fileOriginalContentRef.current.set(activeFile.id, editorContent);
      }
      setHasAnalyzedOnce(true);
      setOriginalContent(editorContent);
      setIsEditMode(false); // Clear edit mode after successful analysis
      setLastValidationTime(Date.now());
      
      // Show feedback toast
      if (displayItems.length > 0) {
        toast.info('Analysis complete', {
          description: `Found ${displayItems.length} issue${displayItems.length !== 1 ? 's' : ''} in ${activeFile.name}`,
          duration: 3000
        });
      } else {
        toast.success('Analysis complete', {
          description: 'No issues found! Data looks good.',
          duration: 3000
        });
      }
      
      if (selectedErrorId && !displayItems.find(e => e.id === selectedErrorId)) {
        setSelectedErrorId(null);
      }
      if (selectedStructureIssue && !structureIssues.find(i => i.id === selectedStructureIssue.id)) {
        setSelectedStructureIssue(null);
      }
    } catch (err) {
      console.error('[Detective D] Analysis error:', err);
      toast.error('Analysis failed', {
        description: 'Detective D encountered an error during analysis',
        duration: 4000
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  // ============================================================================
  // STRUCTURE VALIDATION - Runs automatically on file upload
  // ============================================================================

  const validateFileStructure = async (content: string, fileName: string) => {
    try {
      const extension = fileName.split('.').pop()?.toLowerCase();
      let fileType: 'json' | 'csv' | 'xml' | 'yaml';
      
      switch (extension) {
        case 'json':
          fileType = 'json';
          break;
        case 'csv':
          fileType = 'csv';
          break;
        case 'xml':
          fileType = 'xml';
          break;
        case 'yaml':
        case 'yml':
          fileType = 'yaml';
          break;
        default:
          fileType = 'json'; // Default fallback
      }
      
      console.log('Validating structure for:', fileName, 'as', fileType);
      console.log('Content length:', content.length);
      
      const validator = new StructureValidator(content, fileType);
      const result = validator.validate();
      
      console.log('Validation result:', {
        isValid: result.isValid,
        issueCount: result.issues.length,
        issues: result.issues,
        summary: result.summary
      });
      
      setStructureIssues(result.issues);
      if (activeFile) {
        fileStructureIssuesRef.current.set(activeFile.id, result.issues);
      }
      setHasStructureErrors(!result.isValid);
      
      if (!result.isValid) {
        const errorCount = result.summary.errors;
        const warningCount = result.summary.warnings;
        const fixableCount = result.summary.autoFixable;
        
        console.log('Structure issues found:', {
          errors: errorCount,
          warnings: warningCount,
          fixable: fixableCount
        });
        
        toast.warning('Structure issues detected', {
          description: `${errorCount} error(s), ${warningCount} warning(s). ${fixableCount} can be auto-fixed.`,
          duration: 5000
        });
      } else {
        console.log('Structure validation passed');
        toast.success('Structure validated', {
          description: 'File structure is valid and ready for analysis',
          duration: 3000
        });
      }
    } catch (error) {
      console.error('Structure validation failed:', error);
      
      // Set fallback structure issues to make Fix All available
      setHasStructureErrors(true);
      setStructureIssues([{
        id: 'validation-error',
        type: 'error',
        pattern: 'ValidationError',
        message: 'Structure validation failed - manual review required',
        line: 1,
        column: 1,
        originalText: '',
        suggestedFix: '',
        canAutoFix: true,
        evidence: {
          observed: 'Validation error',
          context: fileName,
          ruleViolated: 'Structure validation'
        }
      }]);
      
      toast.error('Structure validation failed', {
        description: 'Could not validate file structure - but Fix All is available',
        duration: 4000
      });
    }
  };

  // ============================================================================
  // REAL-TIME VALIDATION - Runs as user edits
  // ============================================================================

  const debouncedValidateStructure = async (content: string, fileName: string) => {
    // Clear existing timeout
    if (validationTimeoutId) {
      clearTimeout(validationTimeoutId);
    }

    // Set new timeout for debounced validation
    const timeoutId = setTimeout(async () => {
      if (!content || !fileName) return;
      
      try {
        setIsRealTimeValidating(true);
        
        const extension = fileName.split('.').pop()?.toLowerCase();
        let fileType: 'json' | 'csv' | 'xml' | 'yaml';
        
        switch (extension) {
          case 'json': fileType = 'json'; break;
          case 'csv': fileType = 'csv'; break;
          case 'xml': fileType = 'xml'; break;
          case 'yaml':
          case 'yml': fileType = 'yaml'; break;
          default: fileType = 'json';
        }
        
        const validator = new StructureValidator(content, fileType);
        const result = validator.validate();
        
        console.log('Real-time validation result:', {
          fileName,
          contentLength: content.length,
          isValid: result.isValid,
          issueCount: result.issues.length,
          issues: result.issues.map(i => ({ id: i.id, line: i.line, column: i.column, message: i.message })),
          previousIssueCount: structureIssues.length
        });
        
        setStructureIssues(result.issues);
        setHasStructureErrors(!result.isValid);
        
        // Update the file content in state to match editor
        if (activeFile) {
          // Save structure issues to the Map for this file
          fileStructureIssuesRef.current.set(activeFile.id, result.issues);
          
          // CRITICAL: If structure is now valid, clear ALL old state completely
          if (result.isValid && result.issues.length === 0) {
            console.log('Structure is now valid - clearing all old errors');
            setErrors([]);
            fileErrorsRef.current.set(activeFile.id, []);
            setSelectedErrorId(null);
            setSelectedStructureIssue(null);
            
            // Also clear any stale structure issue selections
            if (selectedStructureIssue) {
              setSelectedStructureIssue(null);
            }
          }
          
          // Update file content
          setUploadedFiles(prev => prev.map(f => 
            f.id === activeFile.id 
              ? { ...f, content }
              : f
          ));
        }
      } catch (error) {
        console.error('Real-time validation failed:', error);
      } finally {
        setIsRealTimeValidating(false);
      }
    }, 500); // 500ms debounce

    setValidationTimeoutId(timeoutId);
  };

  const handleEditorChange = (value: string | undefined) => {
    if (value !== undefined) {
      // Let Monaco Editor handle cursor position naturally during content updates
      // Do NOT override the cursor position - Monaco will maintain it correctly
      setEditorContent(value);
      
      // If user has analyzed once and starts editing, enter edit mode (pause real-time validation)
      if (hasAnalyzedOnce && value !== originalContent && !isEditMode) {
        setIsEditMode(true);
      }
      
      // Only run real-time validation if NOT in edit mode (i.e., before first analysis)
      if (!isEditMode && !hasAnalyzedOnce && activeFile) {
        debouncedValidateStructure(value, activeFile.name);
      }
    }
  };

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (validationTimeoutId) {
        clearTimeout(validationTimeoutId);
      }
    };
  }, [validationTimeoutId]);

  // Handle edit confirmation: validate structure → auto-analyze if valid
  const handleConfirmEdit = async () => {
    if (!activeFile) return;
    
    setIsEditMode(false);
    
    // First, run structure validation on the edited content
    const extension = activeFile.name.split('.').pop()?.toLowerCase();
    let fileType: 'json' | 'csv' | 'xml' | 'yaml';
    switch (extension) {
      case 'json': fileType = 'json'; break;
      case 'csv': fileType = 'csv'; break;
      case 'xml': fileType = 'xml'; break;
      case 'yaml':
      case 'yml': fileType = 'yaml'; break;
      default: fileType = 'json';
    }
    
    const validator = new StructureValidator(editorContent, fileType);
    const structureResult = validator.validate();
    
    setStructureIssues(structureResult.issues);
    fileStructureIssuesRef.current.set(activeFile.id, structureResult.issues);
    setHasStructureErrors(!structureResult.isValid);
    
    if (!structureResult.isValid && structureResult.issues.length > 0) {
      toast.error('Structural issues found', {
        description: 'Please fix structural errors before analysis can proceed.',
        duration: 4000
      });
      return;
    }
    
    // Structure is valid → auto-run Detective D analysis
    toast.success('Changes confirmed', {
      description: 'Running analysis on updated content...',
      duration: 2000
    });
    
    // Automatically trigger analysis (no button click needed)
    await runAnalysis();
  };

  // Handle edit cancellation: revert to original content
  const handleCancelEdit = () => {
    setEditorContent(originalContent);
    setIsEditMode(false);
    
    // Restore content in the file object
    if (activeFile) {
      setUploadedFiles(prev => prev.map(f => 
        f.id === activeFile.id ? { ...f, content: originalContent } : f
      ));
    }
    
    toast.info('Changes cancelled', {
      description: 'Reverted to analyzed content',
      duration: 2000
    });
  };

  // Generate contextual suggestions based on error
  // Extract error context from content for detailed analysis
  const getErrorContext = (error: ErrorItem, content: string, fileName: string) => {
    const lines = content.split('\n');
    const errorLine = lines[error.line - 1] || '';
    const extension = fileName.split('.').pop()?.toLowerCase();
    
    let actualValue = '';
    let expectedType = '';
    let fieldPath = '';
    let suggestion = '';
    let whyMatters = '';
    
    // Use Detective D's evidence and context if available
    if (error.evidence) {
      actualValue = error.evidence.observed || '';
      expectedType = error.evidence.expected_range || error.evidence.expected || '';
      fieldPath = error.evidence.context || '';
      
      // Use Detective D's statistic if available for better context
      if (error.evidence.statistic) {
        actualValue += ` (${error.evidence.statistic})`;
      }
    }
    
    // Use Detective D's explanations and suggestions
    if (error.whyItMatters) {
      whyMatters = error.whyItMatters;
    } else if (error.explanation) {
      whyMatters = error.explanation;
    }
    
    if (error.suggestedAction) {
      suggestion = error.suggestedAction;
    } else if (error.suggestions && error.suggestions.length > 0) {
      suggestion = error.suggestions[0];
    }

    // If Detective D didn't provide values, try to extract from content
    if (!actualValue || !fieldPath) {
      if (extension === 'json') {
      try {
        // Try to parse JSON to get structured field path
        const parsed = JSON.parse(content);
        
        // Try to extract field name and value from the line
        const fieldMatch = errorLine.match(/"([^"]+)"\s*:\s*(.+?)(?:,|$)/);
        if (fieldMatch) {
          fieldPath = fieldMatch[1];
          actualValue = fieldMatch[2].trim().replace(/,$/, '');
        }

        // Try to extract field name from message
        if (!fieldPath) {
          // Common patterns: "age is -5", '"email" is missing', 'price: invalid'
          const fieldInMessage = error.message.match(/"([^"]+)"|'([^']+)'|^(\w+)\s+(?:is|has|must|should)/i);
          if (fieldInMessage) {
            fieldPath = fieldInMessage[1] || fieldInMessage[2] || fieldInMessage[3];
            
            // Try to find the actual value in the JSON
            if (Array.isArray(parsed)) {
              // Search in array of objects
              for (const item of parsed) {
                if (item && typeof item === 'object' && fieldPath in item) {
                  actualValue = JSON.stringify(item[fieldPath]);
                  break;
                }
              }
            } else if (parsed && typeof parsed === 'object' && fieldPath in parsed) {
              actualValue = JSON.stringify(parsed[fieldPath]);
            }
          }
        }
      } catch {
        // JSON parsing failed, fall back to regex
        const fieldMatch = errorLine.match(/"([^"]+)"\s*:\s*(.+?)(?:,|$)/);
        if (fieldMatch) {
          fieldPath = fieldMatch[1];
          actualValue = fieldMatch[2].trim().replace(/,$/, '');
        }
      }

      // Determine expected type based on category
      const categoryLower = error.category?.toLowerCase() || '';
      
      if (categoryLower.includes('type') || categoryLower.includes('mismatch')) {
        if (actualValue.startsWith('"') && actualValue.endsWith('"')) {
          expectedType = 'number';
          const numValue = actualValue.replace(/"/g, '');
          if (!isNaN(Number(numValue)) && !suggestion) {
            suggestion = `Change "${fieldPath}": ${actualValue} → "${fieldPath}": ${numValue}`;
          }
          if (!whyMatters) {
            whyMatters = `"${fieldPath}" must be numeric to support calculations and comparisons.`;
          }
        } else if (!actualValue.startsWith('"') && isNaN(Number(actualValue))) {
          expectedType = 'string';
          if (!suggestion) {
            suggestion = `Change "${fieldPath}": ${actualValue} → "${fieldPath}": "${actualValue}"`;
          }
          if (!whyMatters) {
            whyMatters = `Text values must be wrapped in quotes for valid JSON.`;
          }
        }
      } else if (categoryLower.includes('impossible') || categoryLower.includes('value') || categoryLower.includes('range')) {
        // Extract the actual problematic value from the message if available
        const valueMatch = error.message.match(/(?:is|has|value)\s+["']?(-?\d+\.?\d*)["']?/i);
        if (valueMatch && !actualValue) {
          actualValue = valueMatch[1];
        }
        
        if (actualValue.includes('-') || (valueMatch && parseFloat(valueMatch[1]) < 0)) {
          expectedType = 'positive number';
          if (!suggestion) {
            suggestion = `Replace negative value with a valid positive number`;
          }
          if (!whyMatters) {
            whyMatters = `${fieldPath ? `"${fieldPath}"` : 'This field'} cannot have negative values.`;
          }
        } else if (parseFloat(actualValue) > 100 && (error.message.toLowerCase().includes('percent') || categoryLower.includes('percent'))) {
          expectedType = 'percentage (0-100)';
          if (!suggestion) {
            suggestion = `Change value to be between 0 and 100`;
          }
          if (!whyMatters) {
            whyMatters = `Percentages must be within the valid range.`;
          }
        } else if (categoryLower.includes('impossible')) {
          expectedType = 'valid value';
          if (!whyMatters) {
            whyMatters = `This value is logically impossible or semantically incorrect.`;
          }
        }
      } else if (categoryLower.includes('logic')) {
        expectedType = 'logically consistent value';
        if (!whyMatters) {
          whyMatters = `This creates a logical inconsistency in the data (e.g., end before start, total mismatch).`;
        }
      } else if (categoryLower.includes('missing') || categoryLower.includes('required')) {
        expectedType = 'required value';
        if (!suggestion) {
          suggestion = `Add a value for "${fieldPath}"`;
        }
        if (!whyMatters) {
          whyMatters = `This field is required and cannot be empty.`;
        }
      }
      
    } else if (extension === 'csv') {
      const cells = errorLine.split(',');
      const colMatch = error.message.match(/column (\d+)/i);
      if (colMatch) {
        const colIndex = parseInt(colMatch[1]) - 1;
        actualValue = cells[colIndex] || '';
        fieldPath = `Row ${error.line}, Column ${colMatch[1]}`;
      } else {
        // Try to extract field name from CSV header
        const headerLine = lines[0];
        const headers = headerLine.split(',');
        const fieldInMessage = error.message.match(/"([^"]+)"|'([^']+)'|^(\w+)\s+/i);
        if (fieldInMessage) {
          const field = fieldInMessage[1] || fieldInMessage[2] || fieldInMessage[3];
          const fieldIndex = headers.findIndex(h => h.trim().toLowerCase() === field.toLowerCase());
          if (fieldIndex !== -1 && cells[fieldIndex]) {
            actualValue = cells[fieldIndex].trim();
            fieldPath = `${field} (Column ${fieldIndex + 1})`;
          }
        }
      }
      
      if (error.category?.toLowerCase().includes('inconsistent') || error.category?.toLowerCase().includes('column')) {
        expectedType = `consistent column count`;
        if (!suggestion) {
          suggestion = `Add or remove delimiters to match header row`;
        }
        if (!whyMatters) {
          whyMatters = `All rows must have the same column count for proper parsing.`;
        }
      }
    }
    }

    // Fallback suggestions for syntax errors (typically local parser errors)
    if (!suggestion) {
      if (error.message.includes('Unexpected token')) {
        suggestion = 'Remove the unexpected character or add missing punctuation';
        if (!whyMatters) {
          whyMatters = 'Syntax errors prevent the file from being parsed correctly.';
        }
      } else if (error.message.includes('Unexpected end')) {
        suggestion = 'Add the missing closing bracket, brace, or quote';
        if (!whyMatters) {
          whyMatters = 'Unclosed structures cause parsing failures.';
        }
      } else if (error.message.includes('comma')) {
        suggestion = 'Add a comma between properties or array elements';
        if (!whyMatters) {
          whyMatters = 'Proper delimiters are required for valid syntax.';
        }
      } else {
        suggestion = 'Review and correct the syntax at this line';
        if (!whyMatters) {
          whyMatters = 'Valid syntax is required for successful parsing.';
        }
      }
    }

    return {
      actualValue,
      expectedType,
      fieldPath,
      errorLine: errorLine.trim(),
      suggestion,
      whyMatters
    };
  };

  // Get category display info
  const getCategoryInfo = (category: string) => {
    const categoryLower = category.toLowerCase();
    
    // Type-related errors
    if (categoryLower.includes('type') || categoryLower.includes('mismatch')) {
      return { color: 'text-red-400 bg-red-500/20 border-red-500/30', label: 'Type Mismatch' };
    }
    
    // Value/range errors (including AI's "impossible_value" category)
    if (categoryLower.includes('value') || categoryLower.includes('impossible') || 
        categoryLower.includes('range') || categoryLower.includes('invalid')) {
      return { color: 'text-orange-400 bg-orange-500/20 border-orange-500/30', label: 'Invalid Value' };
    }
    
    // Missing/required field errors (including AI's "missing_critical" category)
    if (categoryLower.includes('missing') || categoryLower.includes('required') || 
        categoryLower.includes('empty') || categoryLower.includes('critical')) {
      return { color: 'text-yellow-400 bg-yellow-500/20 border-yellow-500/30', label: 'Missing Field' };
    }
    
    // Logic errors (including AI's "logic_error" category)
    if (categoryLower.includes('logic') || categoryLower.includes('consistency') || 
        categoryLower.includes('inconsistent') || categoryLower.includes('conflict')) {
      return { color: 'text-blue-400 bg-blue-500/20 border-blue-500/30', label: 'Logic Error' };
    }
    
    // Syntax/parse errors
    if (categoryLower.includes('syntax') || categoryLower.includes('parse') || 
        categoryLower.includes('format') || categoryLower.includes('structure')) {
      return { color: 'text-purple-400 bg-purple-500/20 border-purple-500/30', label: 'Syntax Error' };
    }
    
    // Generic/unknown category
    return { color: 'text-gray-400 bg-gray-500/20 border-gray-500/30', label: category };
  };

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

  // Get file icon based on extension
  const getFileIcon = (fileName: string) => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'json':
        return <FileJson className="h-3.5 w-3.5" />;
      case 'csv':
        return <FileText className="h-3.5 w-3.5" />;
      case 'xml':
      case 'yaml':
      case 'yml':
        return <FileCode className="h-3.5 w-3.5" />;
      default:
        return <FileText className="h-3.5 w-3.5" />;
    }
  };

  // Count lines in content
  const getLineCount = (content: string) => {
    return content.split('\n').length;
  };

  // Parse CSV text into rows/columns (lightweight parser for table view)
  const parseCsvForTable = (text: string) => {
    const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '');
    if (lines.length === 0) return { columns: [], rows: [], error: 'No rows to display' };

    const parseLine = (line: string) => {
      const cells: string[] = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          if (inQuotes && line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (ch === ',' && !inQuotes) {
          cells.push(current);
          current = '';
        } else {
          current += ch;
        }
      }
      cells.push(current);
      return cells;
    };

    const rows = lines.map(parseLine);
    const columns = rows[0] || [];
    const dataRows = rows.slice(1);
    return { columns, rows: dataRows, error: null };
  };

  // Build table-ready data for supported types
  const tableView = useMemo(() => {
    if (!activeFile) return { columns: [], rows: [], error: 'No file loaded' };
    const ext = activeFile.name.split('.').pop()?.toLowerCase();

    try {
      if (ext === 'csv') {
        return parseCsvForTable(editorContent);
      }


      if (ext === 'json') {
        const parsed = JSON.parse(editorContent);

        // Helper to flatten one level of nested objects for table view
        const flattenRow = (row: any) => {
          const flat: Record<string, string> = {};
          if (row && typeof row === 'object') {
            for (const key of Object.keys(row)) {
              const val = row[key];
              if (val === null || val === undefined) {
                flat[key] = '';
              } else if (typeof val === 'object') {
                flat[key] = JSON.stringify(val);
              } else {
                flat[key] = String(val);
              }
            }
          }
          return flat;
        };

        // Detect if the parsed value is an object containing an array of objects (e.g., { groceries: [...] })
        const extractArrayFromObject = (obj: any): any[] | null => {
          if (!obj || typeof obj !== 'object') return null;
          const entries = Object.entries(obj);
          for (const [, value] of entries) {
            if (Array.isArray(value) && value.every((v) => v && typeof v === 'object')) {
              return value as any[];
            }
          }
          return null;
        };

        const makeRows = (arr: any[]) => {
          const flatRows = arr.map(flattenRow);
          const cols = Array.from(new Set(flatRows.flatMap((r) => Object.keys(r))));
          const rows = flatRows.map((r) => cols.map((c) => r[c] ?? ''));
          return { columns: cols, rows, error: null };
        };

        if (Array.isArray(parsed)) {
          return makeRows(parsed);
        }

        if (parsed && typeof parsed === 'object') {
          const nestedArray = extractArrayFromObject(parsed);
          if (nestedArray) {
            return makeRows(nestedArray);
          }
          return makeRows([parsed]);
        }

        return { columns: [], rows: [], error: 'JSON is not an object or array; cannot render table' };
      }

      return { columns: [], rows: [], error: 'Table view is available for CSV or JSON files' };
    } catch (err: any) {
      return { columns: [], rows: [], error: `Cannot render table: ${err?.message || 'Unknown error'}` };
    }
  }, [activeFile, editorContent]);

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

  // Apply error highlights to editor using character offsets for precise highlighting
  const applyErrorHighlights = () => {
    if (!editorRef.current || !monacoRef.current) return;

    const editor = editorRef.current;
    const monaco = monacoRef.current;

    // Clear previous decorations
    if (decorationsRef.current.length > 0) {
      decorationsRef.current = editor.deltaDecorations(decorationsRef.current, []);
    }

    // Create new decorations for each error using precise offset ranges
    const newDecorations = errors
      .filter(error => error.startOffset !== undefined && error.endOffset !== undefined)
      .map((error) => {
        const isError = error.type === 'error';
        
        // Convert character offsets to Monaco editor positions
        const startPosition = editor.getModel()?.getPositionAt(error.startOffset || 0) || { lineNumber: error.line, column: 1 };
        const endPosition = editor.getModel()?.getPositionAt(error.endOffset || error.startOffset || 0) || { lineNumber: error.line, column: 2 };

        // Ensure we have a valid range (minimum 1 character)
        const range = new monaco.Range(
          startPosition.lineNumber,
          startPosition.column,
          endPosition.lineNumber,
          Math.max(endPosition.column, startPosition.column + 1)
        );

        return {
          range,
          options: {
            className: isError ? 'error-line-highlight' : 'warning-line-highlight',
            glyphMarginClassName: isError ? 'error-line-glyph' : 'warning-line-glyph',
            minimap: {
              color: isError ? '#FF4D4D' : '#EAB308',
              position: monaco.editor.MinimapPosition.Inline
            },
            overviewRuler: {
              color: isError ? '#FF4D4D' : '#EAB308',
              position: monaco.editor.OverviewRulerLane.Full
            },
            inlineClassName: isError ? 'error-range-highlight' : 'warning-range-highlight'
          }
        };
      });

    // Fallback decorations for errors without offset information (use whole line)
    const fallbackDecorations = errors
      .filter(error => error.startOffset === undefined || error.endOffset === undefined)
      .map((error) => {
        const isError = error.type === 'error';
        
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

    // Apply all decorations (precise + fallback)
    decorationsRef.current = editor.deltaDecorations([], [...newDecorations, ...fallbackDecorations]);
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

    // --- Instrumentation: log cursor and selection events to help debug cursor jumps ---
    try {
      editor.onDidChangeCursorPosition((e: any) => {
        console.debug('[DetectiveD] Cursor position changed', e.position);
      });

      editor.onDidChangeCursorSelection((e: any) => {
        console.debug('[DetectiveD] Cursor selection changed', e.selection);
      });

      editor.onDidChangeModelContent((e: any) => {
        console.debug('[DetectiveD] Model content changed', { isFlush: e.isFlush, changes: e.changes?.length });
      });
    } catch (err) {
      // Non-fatal - instrumentation optional
      console.warn('[DetectiveD] Failed to attach editor instrumentation', err);
    }
  };

  // Apply highlights when errors change
  useEffect(() => {
    if (editorRef.current && monacoRef.current) {
      applyErrorHighlights();
    }
  }, [errors]);

  // Reset to text view when switching files
  useEffect(() => {
    setViewMode('text');
  }, [activeFileId]);

  // Scroll to error with precise positioning when error is selected
  useEffect(() => {
    if (editorRef.current && selectedErrorId) {
      const selectedError = errors.find(e => e.id === selectedErrorId);
      if (selectedError) {
        const editor = editorRef.current;
        
        // Use precise offset positioning if available
        if (selectedError.startOffset !== undefined) {
          try {
            const position = editor.getModel()?.getPositionAt(selectedError.startOffset);
            if (position) {
              editor.revealPositionInCenter(position);
              editor.setPosition(position);
              
              // Select the error range if end offset is also available
              if (selectedError.endOffset !== undefined) {
                const endPosition = editor.getModel()?.getPositionAt(selectedError.endOffset);
                if (endPosition) {
                  editor.setSelection({
                    startLineNumber: position.lineNumber,
                    startColumn: position.column,
                    endLineNumber: endPosition.lineNumber,
                    endColumn: endPosition.column
                  });
                }
              }
              return;
            }
          } catch (error) {
            console.warn('Failed to use offset positioning, falling back to line positioning:', error);
          }
        }
        
        // Fallback to line-based positioning
        editor.revealLineInCenter(selectedError.line);
        editor.setPosition({ lineNumber: selectedError.line, column: selectedError.column || 1 });
      }
    }
  }, [selectedErrorId]);

  return (
    <div className="fixed inset-0 bg-[#0d0f13] text-slate-200 flex flex-col overflow-hidden detective-d-slide-in">
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
            {/* Detective D Logo with Beta Badge and Version */}
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
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <h1 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                    Detective D
                    <span className="ml-1 text-xs text-slate-400 font-normal flex items-center">
                      v0.1
                        <span className="text-xs text-slate-400 ml-0.5">(Beta)</span>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button className="ml-1 p-0.5 rounded text-slate-400 hover:text-slate-200 transition-colors" aria-label="Beta info">
                              <Info className="h-3 w-3" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="bottom">
                            <p className="max-w-xs">Detective D is in Beta. While it detects most structural and logical issues accurately, some edge cases or complex scenarios may be missed or misinterpreted. We're actively improving its logic and accuracy.</p>
                          </TooltipContent>
                        </Tooltip>
                    </span>
                  </h1>
                </div>
              </div>
            </div>
          </div>

          {/* Right Side - Utility Buttons */}
          <div className="flex items-center gap-2">
            {/* Edit Mode: Cancel and Confirm buttons */}
            {activeFile && isEditMode && (
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={handleCancelEdit}
                      size="sm"
                      variant="ghost"
                      className="gap-2 text-red-500 hover:text-red-600 hover:bg-transparent bg-transparent border-0 shadow-none transition-colors px-3 py-2 font-medium"
                    >
                      <X className="h-4 w-4" />
                      <span className="text-xs font-medium">Cancel</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Cancel changes and revert to analyzed content</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={handleConfirmEdit}
                      size="sm"
                      variant="ghost"
                      className="gap-2 text-green-500 hover:text-green-600 hover:bg-transparent bg-transparent border-0 shadow-none transition-colors px-3 py-2 font-medium"
                    >
                      <Check className="h-4 w-4" />
                      <span className="text-xs font-medium">Confirm</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Confirm changes and re-analyze automatically</TooltipContent>
                </Tooltip>
              </>
            )}

            {/* Normal Mode: Analyze Data Button - show when not in edit mode */}
            {activeFile && !isEditMode && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={runAnalysis}
                    disabled={isAnalyzing || !editorContent || editorContent.trim().length === 0}
                    size="sm"
                    className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm transition-all px-4 py-2 font-medium"
                  >
                    {isAnalyzing ? (
                      <>
                        <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span className="text-xs font-medium">Analyzing...</span>
                      </>
                    ) : (
                      <>
                        <span className="text-xs font-medium">Analyze</span>
                      </>
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  {hasStructureErrors 
                    ? "Analyze data (will attempt analysis despite structural issues)" 
                    : "Run comprehensive data analysis with Detective D"}
                </TooltipContent>
              </Tooltip>
            )}

            {/* Upload File Button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleFileUpload}
                  className="text-slate-400 hover:text-slate-200 hover:bg-slate-800 gap-1 px-2"
                >
                  <Upload className="h-4 w-4" />
                  <span className="text-xs font-medium">Upload</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Upload File</TooltipContent>
            </Tooltip>

            {/* Real-time Analysis Status */}
            {activeFile && isAnalyzing && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 rounded-md">
                <div className="h-2 w-2 rounded-full bg-blue-400 animate-pulse"></div>
                <span>Analyzing...</span>
              </div>
            )}

            {/* Real-time Validation Status */}
            {activeFile && isRealTimeValidating && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-orange-300 bg-orange-900/20 border border-orange-500/30 rounded-md">
                <div className="h-2 w-2 rounded-full bg-orange-400 animate-pulse"></div>
                <span>Validating...</span>
              </div>
            )}

            {/* Structure Status Indicator moved to footer */}

            {/* Reset/Clear Button */}
            
            


            {/* Reset/Clear Button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleReset}
                  className="text-slate-400 hover:text-slate-200 hover:bg-slate-800 gap-1 px-2"
                >
                  <RotateCcw className="h-4 w-4" />
                  <span className="text-xs font-medium">Reset</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Reset / Clear</TooltipContent>
            </Tooltip>

            {/* Feedback Button - Top Bar (Help style) */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setFeedbackModalOpen(true)}
                  className="p-2 rounded-full border border-slate-700 hover:border-slate-600 hover:bg-slate-800/50 transition-all text-slate-400 hover:text-slate-200 flex items-center justify-center min-w-[44px] h-9 gap-2"
                  style={{ minWidth: '110px' }}
                >
                  <MessageSquare className="h-4 w-4" />
                  <span className="text-xs font-semibold">Feedback</span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Send Feedback</TooltipContent>
            </Tooltip>

            {/* Stay Connected Button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setStayConnectedModalOpen(true)}
                  className="p-2 rounded-full border border-slate-700 hover:border-slate-600 hover:bg-slate-800/50 transition-all text-slate-400 hover:text-slate-200 flex items-center justify-center w-9 h-9"
                >
                  <Bell className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Stay Connected</TooltipContent>
            </Tooltip>

            {/* Help Center Button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setHelpCenterOpen(true)}
                  className="p-2 rounded-full border border-slate-700 hover:border-slate-600 hover:bg-slate-800/50 transition-all text-slate-400 hover:text-slate-200 flex items-center justify-center w-9 h-9"
                >
                  <HelpCircle className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Help & Documentation</TooltipContent>
            </Tooltip>
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
                flex items-center gap-2 px-3 py-1.5 text-sm border-r border-slate-800 whitespace-nowrap !rounded-none
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
                className="opacity-0 group-hover:opacity-100 hover:bg-slate-700 rounded-none p-0.5 transition-opacity"
              >
                <X className="h-3 w-3" />
              </button>
            </button>
          ))}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={handleFileUpload}
                className="flex items-center gap-1 px-3 py-1.5 text-slate-400 hover:text-slate-200 transition-colors !rounded-none"
              >
                <Plus className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">Upload another file</TooltipContent>
          </Tooltip>
        </div>
      )}

      {/* Main Content Area - 3 Column Grid */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-[280px_1fr_350px] gap-0 overflow-hidden">
        {/* Left Panel - Error List Sidebar */}
        <div className="border-r border-[#1C1F22] bg-[#111315] overflow-y-auto">
          {/* Header */}
          <div className="px-3 py-3 border-b border-[#1C1F22]">
            <h2 className="text-sm font-semibold text-[#E6E7E9]">
              Issues ({structureIssues.length + errors.length})
            </h2>
          </div>
          
          {/* Error Items */}
          {isAnalyzing ? (
            <div className="px-3 py-16 text-center space-y-4">
              <div className="flex justify-center">
                <div className="h-12 w-12 rounded-full border-4 border-[#1C1F22] border-t-primary animate-spin"></div>
              </div>
              <div className="space-y-2">
                <div className="text-sm font-semibold text-[#E6E7E9]">Analyzing your data...</div>
                <div className="text-xs text-[#7A7F86]">Detective D is scanning for issues</div>
              </div>
            </div>
          ) : (activeFile && (structureIssues.length > 0 || errors.length > 0)) ? (
            <div className="py-1">
              {/* Structure Issues with debugging */}
              {structureIssues.map((issue) => {
                // Add debugging for issue display
                console.log('Rendering structure issue:', {
                  id: issue.id,
                  type: issue.type,
                  line: issue.line,
                  column: issue.column,
                  message: issue.message,
                  pattern: issue.pattern
                });
                
                // Fallback message if issue.message is corrupted
                const displayMessage = issue.message || 'Structure issue detected';
                
                return (
                  <button
                    key={issue.id}
                    onClick={() => {
                      console.log('Selected structure issue:', issue);
                      setSelectedStructureIssue(issue);
                      setSelectedErrorId(null);
                      if (editorRef.current) {
                        editorRef.current.revealLineInCenter(issue.line);
                        editorRef.current.setPosition({ lineNumber: issue.line, column: issue.column || 1 });
                      }
                    }}
                    className={`
                      w-full px-3 py-2.5 text-left transition-all
                      border-b border-[#1C1F22] !rounded-none group
                      ${
                        selectedStructureIssue?.id === issue.id 
                          ? 'border-l-4 border-l-red-500' 
                          : 'border-l-4 border-l-red-500/40 hover:border-l-red-500'
                      }
                    `}
                  >
                    <div className="flex items-start gap-2">
                      {issue.type === 'error' ? (
                        <CircleAlert className="h-3.5 w-3.5 text-[#E6E7E9] mt-0.5 flex-shrink-0" strokeWidth={2} />
                      ) : (
                        <TriangleAlert className="h-3.5 w-3.5 text-[#E6E7E9] mt-0.5 flex-shrink-0" strokeWidth={2} />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-[#E6E7E9] leading-tight">
                          {displayMessage}
                        </div>
                        <div className="text-xs text-[#7A7F86] mt-1">
                          <span>Structure</span>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
              
              {/* Semantic Errors (analysis findings) */}
              {errors.length > 0 && errors.map((error) => (
                <button
                  key={error.id}
                  onClick={() => {
                    setSelectedErrorId(error.id);
                    setSelectedStructureIssue(null);
                  }}
                  className={`
                    w-full px-3 py-2.5 text-left transition-all
                    border-b border-[#1C1F22] !rounded-none group
                    ${
                      selectedErrorId === error.id 
                        ? 'border-l-4 ' + (error.severity === 'error' ? 'border-l-orange-500' : error.severity === 'warning' ? 'border-l-yellow-500' : 'border-l-blue-500')
                        : 'border-l-4 ' + (error.severity === 'error' ? 'border-l-orange-500/40 hover:border-l-orange-500' : error.severity === 'warning' ? 'border-l-yellow-500/40 hover:border-l-yellow-500' : 'border-l-blue-500/40 hover:border-l-blue-500')
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
                      <div className="text-sm font-medium text-[#E6E7E9] leading-tight">
                        {error.message}
                      </div>
                      <div className="text-xs text-[#7A7F86] mt-1">
                        <span>{error.category}</span>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : activeFile ? (
            <div className="px-3 py-8 text-center space-y-3">
              <div className="flex justify-center mb-3">
                <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center">
                  <svg className="h-5 w-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>
              <div className="text-sm font-semibold text-[#E6E7E9]">✓ No issues found</div>
              <div className="text-xs text-[#7A7F86]">Your data looks clean and valid!</div>
              <div className="pt-4 border-t border-[#1C1F22]">
                <div className="text-xs text-[#5A5F66] font-semibold mb-2">Automatic Analysis:</div>
                <div className="text-xs text-[#5A5F66] leading-relaxed space-y-1">
                  <div>✓ Analysis runs automatically on upload</div>
                  <div>✓ Real-time scanning as you edit</div>
                  <div>✓ No buttons needed - it just works!</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="px-4 py-8 text-center text-sm text-[#9CA0A6]">
              No file uploaded yet. 
              <div className="pt-8">Upload or paste a file to run 
              </div>
                <div>structure validation and analysis.
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
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => setViewMode('table')}
                        className={`rounded px-2.5 py-1 text-xs flex items-center gap-1.5 transition-colors ${viewMode === 'table' ? 'bg-[#1A1D20] text-[#D0D3D8]' : 'text-[#D0D3D8] hover:bg-[#1A1D20]'}`}
                      >
                        <Table className="h-3 w-3" strokeWidth={2} />
                        Table
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">Table view</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => setViewMode('text')}
                        className={`rounded px-2.5 py-1 text-xs flex items-center gap-1.5 transition-colors ${viewMode === 'text' ? 'bg-[#1A1D20] text-[#D0D3D8]' : 'text-[#D0D3D8] hover:bg-[#1A1D20]'}`}
                      >
                        <AlignLeft className="h-3 w-3" strokeWidth={2} />
                        Text
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">Text view</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={handleBeautify}
                        className="rounded px-2.5 py-1 text-xs text-[#D0D3D8] hover:bg-[#1A1D20] transition-colors flex items-center gap-1.5"
                      >
                        <Wand2 className="h-3 w-3" strokeWidth={2} />
                        Pretty Print
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">Format / Beautify</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={handleMinify}
                        className="rounded px-2.5 py-1 text-xs text-[#D0D3D8] hover:bg-[#1A1D20] transition-colors flex items-center gap-1.5"
                      >
                        <Minimize2 className="h-3 w-3" strokeWidth={2} />
                        Minify
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">Minify</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={handleDownload}
                        className="rounded px-2.5 py-1 text-xs text-[#D0D3D8] hover:bg-[#1A1D20] transition-colors flex items-center gap-1.5"
                      >
                        <Download className="h-3 w-3" strokeWidth={2} />
                        Download
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">Download</TooltipContent>
                  </Tooltip>
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
                      <span className="text-slate-300">
                        Deterministic Validation
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

              {/* Editor / Table View */}
              <div className="flex-1 overflow-hidden relative">
                {viewMode === 'table' ? (
                  <div className="absolute inset-0 overflow-auto bg-[#0F1113] text-[#D0D3D8]">
                    {tableView.error ? (
                      <div className="p-4 text-sm text-[#EAB308]">{tableView.error}</div>
                    ) : tableView.columns.length === 0 ? (
                      <div className="p-4 text-sm text-[#7A7F86]">No tabular data to display.</div>
                    ) : (
                      <table className="text-sm border-collapse">
                        <thead className="bg-[#111418] sticky top-0 z-10">
                          <tr>
                            {tableView.columns.map((col, colIdx) => (
                              <th key={col || `col-${colIdx}`} className="border border-[#1C1F22] px-3 py-2 text-left font-semibold text-[#9CA3AF] whitespace-nowrap">
                                {col || 'Column'}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {tableView.rows.map((row, idx) => (
                            <tr key={idx} className="odd:bg-[#0F1113] even:bg-[#0C0E12]">
                              {row.map((cell: string, cIdx: number) => (
                                <td key={`${idx}-${cIdx}`} className="border border-[#1C1F22] px-3 py-2 text-[#D0D3D8] whitespace-nowrap">
                                  {cell}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                ) : (
                  <Editor
                    key={activeFile.id}
                    height="100%"
                    language={getLanguage(activeFile.name)}
                    value={editorContent}
                    onChange={handleEditorChange}
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
                      cursorSmoothCaretAnimation: 'off',
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
                      formatOnPaste: false,
                      formatOnType: false,
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
                )}
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
                <div className="pt-3 border-t border-[#1C1F22] text-xs text-[#5A5F66]">
                  <div>Supported: JSON, CSV, XML, YAML</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Panel - Error Details Analysis */}
        <div className="right-panel border-l border-[#1C1F22] bg-[#101113] overflow-y-auto">
          {(selectedErrorId || selectedStructureIssue) && activeFile ? (
            (() => {
              // Handle structure issues
              if (selectedStructureIssue) {
                return (
                  <div className="h-full flex flex-col">
                    <div className="px-4 py-3 border-b border-[#1C1F22]">
                      <h2 className="text-sm font-semibold text-[#E6E7E9]">Structure Issue Details</h2>
                    </div>
                    
                    <div className="px-4 py-4 space-y-5 overflow-y-auto flex-1">
                      <div>
                        <h3 className="text-base font-semibold text-[#E6E7E9] leading-snug">
                          {selectedStructureIssue.message.replace(/at position \d+\s*\(line \d+,\s*column \d+\)/i, '').trim()}
                        </h3>
                      </div>

                      <div className="space-y-1.5">
                        <div className="text-xs font-semibold text-[#7A7F86] uppercase tracking-wide">
                          Location
                        </div>
                        <div className="text-sm space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[#D0D3D8]">Line <span className="font-mono font-semibold text-[#E6E7E9]">{selectedStructureIssue.line}</span></span>
                            {selectedStructureIssue.column && (
                              <>
                                <span className="text-[#7A7F86]">•</span>
                                <span className="text-[#D0D3D8]">Column <span className="font-mono font-semibold text-[#E6E7E9]">{selectedStructureIssue.column}</span></span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div>
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold border bg-orange-900/30 border-orange-500/30 text-orange-400">
                          Structure Issue
                        </span>
                      </div>

                      <div className="space-y-1.5">
                        <div className="text-xs font-semibold text-[#7A7F86] uppercase tracking-wide">
                          Why This Matters
                        </div>
                        <p className="text-sm text-[#D0D3D8] leading-relaxed">
                          Structure issues prevent proper data processing and can cause errors when importing or validating your data.
                          <strong className="text-orange-300 block mt-2">⚠️ Please fix these structural issues before running data analysis.</strong>
                        </p>
                      </div>

                      <div className="space-y-1.5">
                        <div className="text-xs font-semibold text-[#7A7F86] uppercase tracking-wide">
                          How to Fix
                        </div>
                        <div className="space-y-3">
                          <div className="bg-[#0F1113] border border-[#1C1F22] rounded-md p-3">
                            <div className="text-sm text-[#D0D3D8] leading-relaxed space-y-2">
                              <div className="font-medium text-orange-300">
                                Manual Fix Required
                              </div>
                              <div>
                                {selectedStructureIssue.suggestedFix && selectedStructureIssue.suggestedFix !== 'Manual review required' 
                                  ? selectedStructureIssue.suggestedFix
                                  : `Review line ${selectedStructureIssue.line} and correct the ${selectedStructureIssue.pattern.toLowerCase().replace('_', ' ')} issue.`
                                }
                              </div>
                            </div>
                          </div>
                          
                          {selectedStructureIssue.evidence && (
                            <div className="bg-blue-500/5 border border-blue-500/20 rounded-md p-3">
                              <div className="text-xs font-medium text-blue-400 mb-2">Technical Details</div>
                              <div className="text-xs text-blue-300 space-y-1">
                                <div><strong>Context:</strong> {selectedStructureIssue.evidence.context}</div>
                                <div><strong>Rule Violated:</strong> {selectedStructureIssue.evidence.ruleViolated}</div>
                                {selectedStructureIssue.evidence.observed && (
                                  <div><strong>Found:</strong> <code className="bg-blue-500/20 px-1">{selectedStructureIssue.evidence.observed}</code></div>
                                )}
                              </div>
                            </div>
                          )}
                          
                          <div className="bg-orange-500/5 border border-orange-500/20 rounded-md p-3">
                            <div className="text-xs font-medium text-orange-400 mb-1">
                              🚫 Analysis Blocked
                            </div>
                            <div className="text-xs text-orange-300">
                              Fix these structural issues first, then you can run Detective D analysis. Structure errors must be resolved before semantic analysis can proceed.
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }

              // Handle semantic errors
              const selectedError = errors.find(e => e.id === selectedErrorId);
              if (!selectedError) return null;

              const context = getErrorContext(selectedError, editorContent, activeFile.name);
              const categoryInfo = getCategoryInfo(selectedError.category);

              return (
                <div className="h-full flex flex-col">
                  {/* Header */}
                  <div className="px-4 py-3 border-b border-[#1C1F22]">
                    <h2 className="text-sm font-semibold text-[#E6E7E9]">Error Details</h2>
                  </div>

                  {/* Content */}
                  <div className="px-4 py-4 space-y-5 overflow-y-auto flex-1">
                    
                    {/* 1. What is wrong - Error Title */}
                    <div>
                      <h3 className="text-base font-semibold text-[#E6E7E9] leading-snug">
                        {selectedError.message.replace(/at position \d+\s*\(line \d+,\s*column \d+\)/i, '').trim()}
                      </h3>
                    </div>

                    {/* 2. Where - Location */}
                    <div className="space-y-1.5">
                      <div className="text-xs font-semibold text-[#7A7F86] uppercase tracking-wide">
                        Location
                      </div>
                      <div className="text-sm space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[#D0D3D8]">Line <span className="font-mono font-semibold text-[#E6E7E9]">{selectedError.line}</span></span>
                          {selectedError.column && (
                            <>
                              <span className="text-[#7A7F86]">•</span>
                              <span className="text-[#D0D3D8]">Column <span className="font-mono font-semibold text-[#E6E7E9]">{selectedError.column}</span></span>
                            </>
                          )}
                        </div>
                        {context && typeof context === 'object' && 'fieldPath' in context && (context as any).fieldPath && (
                          <div className="text-[#D0D3D8]">
                            Path: <span className="font-mono text-[#E6E7E9]">{(context as any).fieldPath}</span>
                          </div>
                        )}

                      </div>
                    </div>

                    {/* Category Badge */}
                    <div>
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold border ${categoryInfo.color}`}>
                        {categoryInfo.label}
                      </span>
                    </div>

                    {/* Found vs Expected (if we have context) */}
                    {context && typeof context === 'object' && ('actualValue' in context || 'expectedType' in context) && ((context as any).actualValue || (context as any).expectedType) && (
                      <div className="space-y-1.5">
                        <div className="text-xs font-semibold text-[#7A7F86] uppercase tracking-wide">
                          Value Comparison
                        </div>
                        <div className="bg-[#0F1113] border border-[#1C1F22] rounded-md p-3 space-y-2 text-sm">
                          {(context as any).actualValue && (
                            <div>
                              <span className="text-[#7A7F86]">Found:</span>{' '}
                              <span className="font-mono text-red-400">{(context as any).actualValue}</span>
                            </div>
                          )}
                          {(context as any).expectedType && (
                            <div>
                              <span className="text-[#7A7F86]">Expected:</span>{' '}
                              <span className="font-mono text-green-400">{(context as any).expectedType}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* 3. Why this matters */}
                    {context && typeof context === 'object' && 'whyMatters' in context && context.whyMatters && (
                      <div className="space-y-1.5">
                        <div className="text-xs font-semibold text-[#7A7F86] uppercase tracking-wide">
                          Why This Matters
                        </div>
                        <p className="text-sm text-[#D0D3D8] leading-relaxed">
                          {context.whyMatters}
                        </p>
                      </div>
                    )}

                    {/* 4. How to fix */}
                    <div className="space-y-1.5">
                      <div className="text-xs font-semibold text-[#7A7F86] uppercase tracking-wide">
                        Suggested Fix
                      </div>
                      <div className="bg-[#0F1113] border border-[#1C1F22] rounded-md p-3">
                        <p className="text-sm text-[#D0D3D8] leading-relaxed">
                          {selectedError.suggestions && selectedError.suggestions.length > 0
                            ? selectedError.suggestions[0]
                            : (context && typeof context === 'object' && 'suggestion' in context ? context.suggestion : '')}
                        </p>
                      </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="pt-2">
                      <button
                        onClick={() => {
                          if (editorRef.current) {
                            editorRef.current.revealLineInCenter(selectedError.line);
                            editorRef.current.setPosition({ 
                              lineNumber: selectedError.line, 
                              column: selectedError.column || 1 
                            });
                            editorRef.current.focus();
                          }
                        }}
                        className="w-full px-3 py-2 bg-primary hover:bg-primary/80 text-white text-sm font-medium rounded transition-colors"
                      >
                        Go to Line
                      </button>
                    </div>

                    {/* Detection Source Badge */}
                    <div className="pt-2 border-t border-[#1C1F22]">
                      <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20">
                        <Zap className="h-3 w-3" />
                        Deterministic
                      </span>
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


      {/* Footer */}
      {activeFile && (
        <footer className="relative border-t border-[#1C1F22] bg-[#0d0f13] px-4 py-3 flex items-center justify-between text-xs">
          <div className="flex-1 flex items-center gap-2 text-slate-400">
            <FileCode className="h-3.5 w-3.5" />
            <span className="font-medium text-slate-300">{activeFile.name}</span>
            <span className="text-slate-600">•</span>
            <span>{structureIssues.length + errors.length} issue{(structureIssues.length + errors.length) !== 1 ? 's' : ''}</span>
            {/* Structure OK badge moved to appear after the issues count */}
            { !isRealTimeValidating && structureIssues.length === 0 && (
              <div className="flex items-center gap-2 ml-2">
                <div className="h-2 w-2 rounded-full bg-green-400" />
                <span className="text-xs font-medium text-green-300 bg-green-900/20 border border-green-500/30 px-2 py-0.5 rounded-md">Structure OK</span>
              </div>
            )}
          </div>
          {/* Center text: Actively improving */}
          <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 text-slate-500 text-xs flex items-center gap-1 pointer-events-none">
            <AlertCircle className="h-3 w-3" />
            <span>Actively improving. Results may vary.</span>
          </div>

          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setStayConnectedModalOpen(true)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-slate-300 hover:text-slate-100 hover:bg-slate-800/50 transition-colors"
                >
                  <FileDown className="h-3.5 w-3.5" />
                  <span className="font-medium">Export</span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">Export error report</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setStayConnectedModalOpen(true)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-slate-300 hover:text-slate-100 hover:bg-slate-800/50 transition-colors"
                >
                  <Share2 className="h-3.5 w-3.5" />
                  <span className="font-medium">Share</span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">Share results</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setStayConnectedModalOpen(true)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-slate-300 hover:text-slate-100 hover:bg-slate-800/50 transition-colors"
                >
                  <Shield className="h-3.5 w-3.5" />
                  <span className="font-medium">Audit</span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">Generate audit log</TooltipContent>
            </Tooltip>
          </div>
        </footer>
      )}

      {/* Help Center Modal */}
      <HelpCenterModal
        open={helpCenterOpen}
        onOpenChange={setHelpCenterOpen}
      />

      {/* Stay Connected Modal - Simple Light Mode */}
      {stayConnectedModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-gray-50 border border-gray-200 rounded-lg shadow-lg max-w-md w-full mx-4 overflow-hidden">
            {/* Header */}
            <div className="px-6 py-5 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Stay in the loop</h2>
                <p className="text-sm text-gray-600 mt-1">Get product updates and improvements</p>
              </div>
              <button
                onClick={() => setStayConnectedModalOpen(false)}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            {/* Content */}
            <div className="px-6 py-5 space-y-4">
              {/* Email Input */}
              <div>
                <input
                  type="email"
                  placeholder="your@email.com"
                  value={stayConnectedEmail}
                  onChange={(e) => setStayConnectedEmail(e.target.value)}
                  className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded text-gray-900 placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                />
              </div>

              {/* Consent Checkbox */}
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={stayConnectedOptIn}
                  onChange={(e) => setStayConnectedOptIn(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-gray-300 bg-white accent-blue-600 cursor-pointer"
                />
                <span className="text-sm text-gray-700">I'd like to receive product updates and improvements</span>
              </label>
              <p className="text-xs text-gray-500">No spam. Unsubscribe anytime.</p>
            </div>

            {/* Actions */}
            <div className="px-6 py-4 border-t border-gray-200 flex gap-3 justify-end">
              <button
                onClick={() => setStayConnectedModalOpen(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 font-medium rounded transition-colors text-sm"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!stayConnectedEmail.trim()) {
                    toast.error('Please enter your email', { duration: 3000 });
                    return;
                  }
                  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                  if (!emailRegex.test(stayConnectedEmail.toLowerCase().trim())) {
                    toast.error('Please enter a valid email', { duration: 3000 });
                    return;
                  }
                  try {
                    const { error } = await supabase
                      .from('notification_subscriptions')
                      .insert([{ email: stayConnectedEmail.toLowerCase().trim(), subscribed_at: new Date().toISOString() }])
                      .select();
                    if (error && error.code === '23505') {
                      toast.success('Already subscribed!', { description: 'You\'re already on our list.', duration: 3000 });
                    } else if (error) {
                      throw error;
                    } else {
                      toast.success('You\'re subscribed!', { description: 'Watch for updates from DatumInt.', duration: 3000 });
                      setStayConnectedModalOpen(false);
                      setStayConnectedEmail('');
                      setStayConnectedOptIn(false);
                    }
                  } catch (err) {
                    console.error('Subscription error:', err);
                    toast.error('Failed to subscribe', { duration: 3000 });
                  }
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded transition-colors text-sm"
              >
                Subscribe
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Feedback Modal - Simple Light Mode */}
      {feedbackModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-gray-50 border border-gray-200 rounded-lg shadow-lg max-w-md w-full mx-4 overflow-hidden">
            {/* Header */}
            <div className="px-6 py-5 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Tell us what you think</h2>
                <p className="text-sm text-gray-600 mt-1">Help us improve Detective D</p>
              </div>
              <button
                onClick={() => {
                  setFeedbackModalOpen(false);
                  setFeedbackText("");
                  setFeedbackEmail("");
                  setFeedbackOptIn(false);
                }}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            {/* Content */}
            <div className="px-6 py-5 space-y-4">
              {/* Feedback Textarea */}
              <textarea
                placeholder="What do you think? Any issues or suggestions?..."
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded text-gray-900 placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none h-20 transition-all"
              />

              {/* Email Input */}
              <input
                type="email"
                placeholder="your@email.com (optional)"
                value={feedbackEmail}
                onChange={(e) => setFeedbackEmail(e.target.value)}
                className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded text-gray-900 placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
              />

              {/* Consent Checkbox */}
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={feedbackOptIn}
                  onChange={(e) => setFeedbackOptIn(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-gray-300 bg-white accent-blue-600 cursor-pointer"
                />
                <span className="text-sm text-gray-700">Follow up with me about my feedback</span>
              </label>
            </div>

            {/* Actions */}
            <div className="px-6 py-4 border-t border-gray-200 flex gap-3 justify-end">
              <button
                onClick={() => {
                  setFeedbackModalOpen(false);
                  setFeedbackText("");
                  setFeedbackEmail("");
                  setFeedbackOptIn(false);
                }}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 font-medium rounded transition-colors text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (!feedbackText.trim()) {
                    toast.error('Please share your feedback', { duration: 3000 });
                    return;
                  }
                  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                  if (feedbackEmail && !emailRegex.test(feedbackEmail.toLowerCase().trim())) {
                    toast.error('Please enter a valid email', { duration: 3000 });
                    return;
                  }
                  toast.success("Thank you for your feedback!", { description: 'We appreciate your input.', duration: 3000 });
                  setFeedbackModalOpen(false);
                  setFeedbackText("");
                  setFeedbackEmail("");
                  setFeedbackOptIn(false);
                }}
                disabled={!feedbackText.trim()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded transition-colors text-sm"
              >
                Send Feedback
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Help Center Modal */}
      <HelpCenterModal open={helpCenterOpen} onOpenChange={setHelpCenterOpen} />

      {/* Detective D Explainer Modal - shows on first visit */}
      <DetectiveDExplainerModal open={showExplainerModal} onOpenChange={setShowExplainerModal} />

      {/* Footer Action Modals */}
      {activeFile && (
        <>
          <ShareModal
            open={shareModalOpen}
            onOpenChange={setShareModalOpen}
            fileName={activeFile.name}
            issueCount={structureIssues.length + errors.length}
          />
          <AuditLogModal
            open={auditModalOpen}
            onOpenChange={setAuditModalOpen}
            fileName={activeFile.name}
            issueCount={structureIssues.length + errors.length}
            errorCount={errors.filter(e => e.severity === 'error').length}
            warningCount={errors.filter(e => e.severity === 'warning').length}
            structureIssues={structureIssues}
            errors={errors}
          />
          <ExportModal
            open={exportModalOpen}
            onOpenChange={setExportModalOpen}
            fileName={activeFile.name}
            content={editorContent}
            issues={[...structureIssues, ...errors]}
            analysisResult={{
              timestamp: new Date().toISOString(),
              structureValidation: {
                totalIssues: structureIssues.length,
                issues: structureIssues
              },
              semanticAnalysis: {
                totalIssues: errors.length,
                byCategory: errors.reduce((acc: any, e: any) => {
                  acc[e.category] = (acc[e.category] || 0) + 1;
                  return acc;
                }, {}),
                issues: errors
              }
            }}
          />
        </>
      )}

      {/* File Limit Modal */}
      {showFileLimitModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-900 rounded-lg p-6 max-w-md w-full mx-4 shadow-xl border border-slate-700">
            <h2 className="text-xl font-semibold text-white mb-3">Maximum Files Limit Reached</h2>
            <p className="text-slate-300 mb-6">
              You can only have 2 files open at a time. Please close a file first to open another.
            </p>
            <div className="flex justify-end">
              <button
                onClick={() => setShowFileLimitModal(false)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DetectiveD;
