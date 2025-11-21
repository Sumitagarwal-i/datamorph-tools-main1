import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, Download, Upload, Minimize2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { useRef, useState } from "react";

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
}: ConverterPanelProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    toast.success("Copied to clipboard!");
    onCopy?.();
  };

  const processFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      onChange?.(text);
      toast.success("File loaded successfully!");
    };
    reader.onerror = () => {
      toast.error("Failed to read file");
    };
    reader.readAsText(file);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
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
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-2">
        <label className="text-sm font-medium text-foreground">{label}</label>
        <div className="flex gap-2">
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
                className="gap-2"
              >
                <Upload className="h-4 w-4" />
                Upload
              </Button>
            </>
          )}
          {readOnly && value && (
            <>
              {showMinify && onMinify && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onMinify}
                  className="gap-2"
                >
                  <Minimize2 className="h-4 w-4" />
                  Minify
                </Button>
              )}
              {showReset && onReset && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onReset}
                  className="gap-2"
                >
                  <RotateCcw className="h-4 w-4" />
                  Reset
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={handleCopy}
                className="gap-2"
              >
                <Copy className="h-4 w-4" />
                Copy
              </Button>
              {onDownload && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onDownload}
                  className="gap-2"
                >
                  <Download className="h-4 w-4" />
                  Download
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
        className={`flex-1 relative ${
          isDragging ? "ring-2 ring-primary ring-offset-2 rounded-md" : ""
        }`}
      >
        <Textarea
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          placeholder={placeholder}
          readOnly={readOnly}
          className="h-full font-mono text-sm resize-none"
        />
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