import { useState, useCallback, memo } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight, Loader2 } from "lucide-react";
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
      <div className="text-center mb-6 min-h-[80px] flex flex-col items-center justify-center">
        <h2 className="text-xl font-semibold mb-2">JSON to CSV Converter</h2>
        <p className="text-sm text-muted-foreground">
          Convert JSON data into CSV format with intelligent flattening
        </p>
      </div>

      <div className="grid md:grid-cols-[1fr_auto_1fr] gap-4 h-[calc(100vh-320px)]">
        <ConverterPanel
          label="Input JSON"
          value={input}
          onChange={setInput}
          placeholder={JSON_EXAMPLE}
          showRepair={true}
          repairEnabled={isJsonInput()}
          onRepair={handleRepair}
        />

      <div className="flex items-center justify-center">
        <Button
          onClick={handleConvert}
          disabled={!input.trim() || isConverting}
          className="gap-2"
          size="lg"
        >
          {isConverting ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <ArrowRight className="h-5 w-5" />
          )}
          Convert
        </Button>
      </div>

      <ConverterPanel
        label="Output CSV"
        value={output}
        readOnly
        placeholder="CSV output will appear here..."
        onDownload={handleDownload}
      />
      </div>
    </div>
  );
});

JsonToCsvConverter.displayName = "JsonToCsvConverter";