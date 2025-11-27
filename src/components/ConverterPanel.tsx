import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, Download, Upload, Minimize2, RotateCcw, Wrench, Sparkles, Table2 } from "lucide-react";
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
}: ConverterPanelProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [viewMode, setViewMode] = useState<'text' | 'table'>('text');

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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3 max-w-full">
        <label className="text-xs sm:text-sm font-medium text-foreground truncate max-w-full">{label}</label>
        <div className="flex flex-wrap gap-1 sm:gap-1.5">
          {showDemoButton && onDemoLoad && !readOnly && (
            <Button
              size="sm"
              variant="outline"
              onClick={onDemoLoad}
              className="gap-1 text-[10px] sm:text-xs px-2 sm:px-3 min-h-[32px]"
            >
              <Sparkles className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
              <span className="hidden sm:inline">Try Demo Data</span>
              <span className="sm:hidden">Demo</span>
            </Button>
          )}
          {allowFileUpload && !readOnly && (
            <>
              <Input
                ref={fileInputRef}
                type="file"
                accept={acceptedFileTypes}
                onChange={handleFileUpload}
                className="hidden"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="gap-1 text-[10px] sm:text-xs px-2 sm:px-3 min-h-[32px]"
              >
                <Upload className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                <span className="hidden sm:inline">Upload</span>
              </Button>
            </>
          )}
          {showRepair && onRepair && !readOnly && (
            <TooltipProvider>
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <span className="inline-block">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={onRepair}
                      disabled={!repairEnabled}
                      className="gap-1 text-[10px] sm:text-xs px-2 sm:px-3 min-h-[32px]"
                    >
                      <Wrench className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                      <span className="hidden sm:inline">Repair</span>
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">{repairEnabled ? "Fix broken JSON" : "Input JSON required"}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {readOnly && value && (
            <>
              {showMinify && onMinify && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onMinify}
                  className="gap-1 text-[10px] sm:text-xs px-2 sm:px-3 min-h-[32px]"
                >
                  <Minimize2 className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                  <span className="hidden sm:inline">Minify</span>
                </Button>
              )}
              {showReset && onReset && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onReset}
                  className="gap-1 text-[10px] sm:text-xs px-2 sm:px-3 min-h-[32px]"
                >
                  <RotateCcw className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                  <span className="hidden sm:inline">Reset</span>
                </Button>
              )}
              {isCsvOutput && value.trim() && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setViewMode(viewMode === 'text' ? 'table' : 'text')}
                        className="gap-1 text-[10px] sm:text-xs px-2 sm:px-3 min-h-[32px]"
                      >
                        <Table2 className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                        <span className="hidden sm:inline">{viewMode === 'text' ? 'Table' : 'Text'}</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{viewMode === 'text' ? 'View as table' : 'View as text'}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={handleCopy}
                className="gap-1 text-[10px] sm:text-xs px-2 sm:px-3 min-h-[32px]"
              >
                <Copy className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                <span className="hidden sm:inline">Copy</span>
              </Button>
              {onDownload && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onDownload}
                  className="gap-1 text-[10px] sm:text-xs px-2 sm:px-3 min-h-[32px]"
                >
                  <Download className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                  <span className="hidden sm:inline">Download</span>
                </Button>
              )}
            </>
          )}
        </div>
      </div>
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`flex-1 relative overflow-hidden rounded-md ${
          isDragging ? "ring-2 ring-primary ring-offset-2" : ""
        }`}
      >
        {isCsvOutput && viewMode === 'table' && value.trim() ? (
          <div className="h-full w-full border rounded-md bg-background overflow-auto">
            <div className="min-w-max p-2">
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
          <Textarea
            value={value}
            onChange={(e) => onChange?.(e.target.value)}
            placeholder={placeholder}
            readOnly={readOnly}
            className={`h-full w-full font-mono text-sm resize-none overflow-auto ${
              isCsvOutput ? 'leading-relaxed tracking-wide' : ''
            } ${readOnly ? 'hover:border-input hover:shadow-sm' : ''}`}
          />
        )}
        {isDragging && (
          <div className="absolute inset-0 bg-primary/10 backdrop-blur-sm rounded-md flex items-center justify-center pointer-events-none">
            <div className="text-center">
              <Upload className="h-8 w-8 mx-auto mb-2 text-primary" />
              <p className="text-sm font-medium">Drop file here</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};