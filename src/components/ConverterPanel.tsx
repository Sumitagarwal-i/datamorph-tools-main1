import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, Download, Upload, Minimize2, RotateCcw, Wrench, Sparkles, Table2, Info, MoreVertical, FileCode, FileText } from "lucide-react";
import { toast } from "sonner";
import { useRef, useState } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface ConverterPanelProps {
  label: string;
  value: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  onCopy?: () => void;
  onDownload?: () => void;
  allowFileUpload?: boolean;
  acceptedFileTypes?: string;
  showMinify?: boolean;
  showReset?: boolean;
  onMinify?: () => void;
  onReset?: () => void;
  showRepair?: boolean;
  repairEnabled?: boolean;
  onRepair?: () => void;
  showDemoButton?: boolean;
  onDemoLoad?: () => void;
  isCsvOutput?: boolean;
  showInfoTooltip?: boolean;
  customAction?: React.ReactNode;
}

export const ConverterPanel = ({
  label,
  value,
  onChange,
  placeholder,
  readOnly = false,
  onCopy,
  onDownload,
  allowFileUpload = false,
  acceptedFileTypes = "*",
  showMinify = false,
  showReset = false,
  onMinify,
  onReset,
  showRepair = false,
  repairEnabled = true,
  onRepair,
  showDemoButton = false,
  onDemoLoad,
  isCsvOutput = false,
  showInfoTooltip = false,
  customAction,
}: ConverterPanelProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [viewMode, setViewMode] = useState<'text' | 'table'>('text');
  
  // Calculate number of lines in the textarea, with minimum to fill visible area
  const actualLineCount = value ? value.split('\n').length : 1;
  const lineCount = Math.max(actualLineCount, 25); // Show minimum 25 lines to fill the frame
  
  // Sync scroll between textarea and line numbers
  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    if (lineNumbersRef.current && e.currentTarget) {
      lineNumbersRef.current.scrollTop = e.currentTarget.scrollTop;
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    toast.success("Copied to clipboard!");
    onCopy?.();
  };

  const processFile = (file: File) => {
    try {
      // Validate file size (max 10MB)
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (file.size > maxSize) {
        toast.error("File too large. Maximum size is 10MB");
        return;
      }

      // Validate file type
      const validExtensions = ['.json', '.csv', '.txt'];
      const fileExtension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
      if (!validExtensions.includes(fileExtension)) {
        toast.error("Invalid file type. Please upload .json, .csv, or .txt files");
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const text = event.target?.result as string;
          if (!text || text.trim().length === 0) {
            toast.error("File is empty");
            return;
          }
          onChange?.(text);
          toast.success("File loaded successfully!");
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "Failed to process file content");
        }
      };
      reader.onerror = () => {
        toast.error("Failed to read file");
      };
      reader.readAsText(file);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to process file");
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  // Parse CSV text into table data
  const parseCsvForTable = (csvText: string): { headers: string[]; rows: string[][] } => {
    if (!csvText.trim()) return { headers: [], rows: [] };
    
    const lines = csvText.trim().split('\n');
    if (lines.length === 0) return { headers: [], rows: [] };
    
    // Simple CSV parsing (handles quoted fields)
    const parseLine = (line: string): string[] => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    };
    
    const headers = parseLine(lines[0]);
    const rows = lines.slice(1).map(line => parseLine(line));
    
    return { headers, rows };
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!readOnly && allowFileUpload) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (readOnly || !allowFileUpload) return;

    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  return (
    <div className="flex flex-col h-full max-w-full overflow-hidden">
      <div className="flex flex-col h-full bg-card border border-border rounded-lg shadow-lg overflow-hidden">
        {/* Header Bar */}
        <div className="flex items-center justify-between px-4 py-3 bg-muted/50 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-6 h-6 rounded-md bg-primary/10 text-primary">
              {isCsvOutput ? <FileText className="h-3.5 w-3.5" /> : <FileCode className="h-3.5 w-3.5" />}
            </div>
            <span className="text-sm font-semibold text-foreground">{label}</span>
            {showInfoTooltip && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button className="inline-flex">
                      <Info className="h-3.5 w-3.5 text-muted-foreground hover:text-primary cursor-help transition-colors" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs">
                    <p className="text-sm">
                      <span className="font-medium">ℹ️</span> Complex nested JSON structures may produce some inaccuracies. We're actively working on improvements.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </div>

        {/* Editor Area */}
        <div 
          className="flex-1 relative min-h-[300px] bg-muted/5"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {/* Dynamic Line Numbers */}
          <div 
            ref={lineNumbersRef}
            className="absolute left-0 top-0 bottom-0 w-12 bg-muted/20 border-r border-border overflow-hidden select-none pointer-events-none z-10"
          >
            <div className="py-3 px-2 text-right leading-relaxed text-[13px] text-muted-foreground/50 font-mono">
              {Array.from({ length: lineCount }).map((_, i) => (
                <div key={i} style={{ height: '1.5rem' }}>
                  {i + 1}
                </div>
              ))}
            </div>
          </div>

          {isCsvOutput && viewMode === 'table' && value.trim() ? (
            <div className="absolute inset-0 pl-14 overflow-auto">
              <div className="min-w-max p-4">
                {(() => {
                  const { headers, rows } = parseCsvForTable(value);
                  if (headers.length === 0) {
                    return (
                      <div className="text-center text-muted-foreground py-8">
                        No data to display
                      </div>
                    );
                  }
                  return (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {headers.map((header, idx) => (
                            <TableHead key={idx} className="font-semibold whitespace-nowrap text-xs sticky top-0 bg-background z-10">
                              {header}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rows.map((row, rowIdx) => (
                          <TableRow key={rowIdx}>
                            {row.map((cell, cellIdx) => (
                              <TableCell key={cellIdx} className="font-mono text-xs whitespace-nowrap">
                                {cell || <span className="text-muted-foreground italic">null</span>}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  );
                })()}
              </div>
            </div>
          ) : (
            <div className="absolute inset-0 pl-14">
              <Textarea
                ref={textareaRef}
                value={value}
                onChange={(e) => onChange?.(e.target.value)}
                onScroll={handleScroll}
                placeholder={placeholder}
                readOnly={readOnly}
                className={cn(
                  "h-full w-full pl-2 pr-4 py-3 font-mono text-sm bg-transparent border-0 shadow-none outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 focus:border-0 focus:shadow-none resize-none leading-relaxed rounded-none",
                  isCsvOutput && "tracking-wide",
                  readOnly && "cursor-default"
                )}
                spellCheck={false}
              />
            </div>
          )}

          {isDragging && (
            <div className="absolute inset-0 bg-primary/10 backdrop-blur-sm flex items-center justify-center z-20 border-2 border-dashed border-primary m-2 rounded-lg">
              <div className="text-center">
                <Upload className="h-10 w-10 mx-auto mb-3 text-primary animate-bounce" />
                <p className="text-sm font-medium text-primary">Drop file here</p>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-muted/30 border-t border-border">
          {/* Left Actions */}
          <div className="flex items-center gap-2">
            {allowFileUpload && !readOnly && (
              <>
                <Input
                  ref={fileInputRef}
                  type="file"
                  accept={acceptedFileTypes}
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => fileInputRef.current?.click()}
                        className="h-9 px-3 gap-2 hover:bg-primary/10 hover:text-primary transition-colors"
                      >
                        <Upload className="h-4 w-4" />
                        <span className="text-xs">Upload</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Upload File (.json, .csv, .txt)</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </>
            )}

            {showDemoButton && onDemoLoad && !readOnly && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={onDemoLoad}
                      className="h-9 px-3 gap-2 hover:bg-primary/10 hover:text-primary transition-colors"
                    >
                      <Sparkles className="h-4 w-4" />
                      <span className="text-xs">Demo</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Load Demo Data</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            {showRepair && onRepair && !readOnly && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={onRepair}
                      disabled={!repairEnabled}
                      className="h-9 px-3 gap-2 hover:bg-primary/10 hover:text-primary transition-colors disabled:opacity-50"
                    >
                      <Wrench className="h-4 w-4" />
                      <span className="text-xs">Repair</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Fix broken JSON syntax</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            {readOnly && value && (
              <>
                {showMinify && onMinify && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={onMinify}
                          className="h-9 px-3 gap-2 hover:bg-primary/10 hover:text-primary transition-colors"
                        >
                          <Minimize2 className="h-4 w-4" />
                          <span className="text-xs">Minify</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Compress JSON output</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                {showReset && onReset && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={onReset}
                          className="h-9 px-3 gap-2 hover:bg-primary/10 hover:text-primary transition-colors"
                        >
                          <RotateCcw className="h-4 w-4" />
                          <span className="text-xs">Reset</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Restore original format</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                {isCsvOutput && value.trim() && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setViewMode(viewMode === 'text' ? 'table' : 'text')}
                          className="h-9 px-3 gap-2 hover:bg-primary/10 hover:text-primary transition-colors"
                        >
                          <Table2 className="h-4 w-4" />
                          <span className="text-xs">{viewMode === 'text' ? 'Table' : 'Text'}</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Toggle between table and text view</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleCopy}
                        className="h-9 px-3 gap-2 hover:bg-primary/10 hover:text-primary transition-colors"
                      >
                        <Copy className="h-4 w-4" />
                        <span className="text-xs">Copy</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Copy to clipboard</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                {onDownload && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={onDownload}
                          className="h-9 px-3 gap-2 hover:bg-primary/10 hover:text-primary transition-colors"
                        >
                          <Download className="h-4 w-4" />
                          <span className="text-xs">Download</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Download as file</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </>
            )}
          </div>

          {/* Right Actions (Custom Action like Convert) */}
          {customAction && (
            <div className="flex items-center">
              {customAction}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
