import { useState, useCallback, memo } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight, Loader2 } from "lucide-react";
import { ConverterPanel } from "./ConverterPanel";
import { jsonToCsv, downloadFile } from "@/lib/converters";
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

  return (
    <div className="grid md:grid-cols-[1fr_auto_1fr] gap-4 h-[calc(100vh-240px)]">
      <ConverterPanel
        label="Input JSON"
        value={input}
        onChange={setInput}
        placeholder={JSON_EXAMPLE}
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
  );
});

JsonToCsvConverter.displayName = "JsonToCsvConverter";