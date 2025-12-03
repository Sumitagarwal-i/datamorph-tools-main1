import { useState, useCallback, memo } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight, Loader2, Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ConverterPanel } from "./ConverterPanel";
import { jsonToCsv, downloadFile, repairJson } from "@/lib/converters";
import { logConversion } from "@/lib/supabaseLogger";
import { toast } from "sonner";

const JSON_EXAMPLE = `[
  {
    "name": "John Doe",
    "email": "john@example.com",
    "age": 30
  },
  {
    "name": "Jane Smith",
    "email": "jane@example.com",
    "age": 25
  }
]`;

export const JsonToCsvConverter = memo(() => {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [isConverting, setIsConverting] = useState(false);

  const handleConvert = useCallback(async () => {
    if (!input.trim() || isConverting) return;
    
    setIsConverting(true);
    
    try {
      await new Promise(resolve => setTimeout(resolve, 300));

      const result = jsonToCsv(input);

      if (result.success && result.data) {
        setOutput(result.data);
        toast.success("Conversion successful!");
        
        if (result.itemCount) {
          logConversion("JSON", "CSV", result.itemCount);
        }
      } else {
        toast.error(result.error || "Conversion failed");
        setOutput("");
      }
    } catch (error) {
      toast.error("An unexpected error occurred");
      console.error("Conversion error:", error);
      setOutput("");
    } finally {
      setIsConverting(false);
    }
  }, [input, isConverting]);

  const handleDownload = () => {
    downloadFile(output, "converted.csv");
    toast.success("File downloaded!");
  };

  const handleRepair = useCallback(() => {
    const result = repairJson(input);
    if (result.success && result.data) {
      setInput(result.data);
      toast.success("JSON repaired successfully!");
    } else {
      toast.error(result.error || "Failed to repair JSON");
    }
  }, [input]);

  const isJsonInput = useCallback(() => {
    if (!input.trim()) return false;
    const trimmed = input.trim();
    return (trimmed.startsWith('{') || trimmed.startsWith('['));
  }, [input]);

  return (
    <div className="space-y-4">
      <div className="text-center mb-4 sm:mb-6 min-h-[60px] sm:min-h-[80px] flex flex-col items-center justify-center px-2">
        <h2 className="text-lg sm:text-xl font-semibold mb-2">JSON to CSV Converter</h2>
        <p className="text-xs sm:text-sm text-muted-foreground">
          Convert JSON data into CSV format with intelligent flattening
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-[500px] lg:h-[600px] max-w-full">
        <ConverterPanel
          label="Input JSON"
          value={input}
          onChange={setInput}
          placeholder={JSON_EXAMPLE}
          showRepair={true}
          repairEnabled={isJsonInput()}
          onRepair={handleRepair}
          customAction={
            <Button
              onClick={handleConvert}
              disabled={!input.trim() || isConverting}
              size="sm"
              className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm transition-all h-9 px-4"
            >
              {isConverting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowRight className="h-4 w-4" />
              )}
              <span className="text-xs font-medium">Convert</span>
            </Button>
          }
        />

        <ConverterPanel
          label="Output CSV"
          value={output}
          readOnly
          placeholder="CSV output will appear here..."
          onDownload={handleDownload}
          isCsvOutput={true}
          showInfoTooltip={true}
        />
      </div>
    </div>
  );
});

JsonToCsvConverter.displayName = "JsonToCsvConverter";