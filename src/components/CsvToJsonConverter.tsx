import { useState, useCallback, memo } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight, Loader2 } from "lucide-react";
import { ConverterPanel } from "./ConverterPanel";
import { csvToJson, downloadFile } from "@/lib/converters";
import { logConversion } from "@/lib/supabaseLogger";
import { toast } from "sonner";

const CSV_EXAMPLE = `name,email,age
John Doe,john@example.com,30
Jane Smith,jane@example.com,25
Bob Johnson,bob@example.com,35`;

export const CsvToJsonConverter = memo(() => {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [isConverting, setIsConverting] = useState(false);

  const handleConvert = useCallback(async () => {
    if (!input.trim() || isConverting) return;
    
    setIsConverting(true);
    
    try {
      // Simulate loading for better UX
      await new Promise(resolve => setTimeout(resolve, 300));

      const result = csvToJson(input);

      if (result.success && result.data) {
        setOutput(result.data);
        toast.success("Conversion successful!");
        
        // Log conversion to Supabase (non-blocking)
        if (result.itemCount) {
          logConversion("CSV", "JSON", result.itemCount);
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

  const handleDownload = useCallback(() => {
    if (!output) return;
    downloadFile(output, "converted.json");
    toast.success("File downloaded!");
  }, [output]);

  return (
    <div className="grid md:grid-cols-[1fr_auto_1fr] gap-4 h-[calc(100vh-240px)]">
      <ConverterPanel
        label="Input CSV"
        value={input}
        onChange={setInput}
        placeholder={CSV_EXAMPLE}
        allowFileUpload={true}
        acceptedFileTypes=".csv,text/csv"
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
        label="Output JSON"
        value={output}
        readOnly
        placeholder="JSON output will appear here..."
        onDownload={handleDownload}
      />
    </div>
  );
});

CsvToJsonConverter.displayName = "CsvToJsonConverter";