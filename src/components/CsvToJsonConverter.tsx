import { useState, useCallback, memo } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight, Loader2, Minimize2, RotateCcw } from "lucide-react";
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
  const [originalOutput, setOriginalOutput] = useState("");
  const [isMinified, setIsMinified] = useState(false);

  const handleConvert = useCallback(async () => {
    if (!input.trim() || isConverting) return;
    
    setIsConverting(true);
    
    try {
      // Simulate loading for better UX
      await new Promise(resolve => setTimeout(resolve, 300));

      const result = csvToJson(input);

      if (result.success && result.data) {
        setOutput(result.data);
        setOriginalOutput(result.data);
        setIsMinified(false);
        toast.success("Conversion successful!");
        
        // Log conversion to Supabase (non-blocking)
        if (result.itemCount) {
          logConversion("CSV", "JSON", result.itemCount);
        }
      } else {
        toast.error(result.error || "Conversion failed");
        setOutput("");
        setOriginalOutput("");
      }
    } catch (error) {
      toast.error("An unexpected error occurred");
      console.error("Conversion error:", error);
      setOutput("");
      setOriginalOutput("");
    } finally {
      setIsConverting(false);
    }
  }, [input, isConverting]);

  const handleDownload = useCallback(() => {
    if (!output) return;
    downloadFile(output, "converted.json");
    toast.success("File downloaded!");
  }, [output]);

  const handleMinify = useCallback(() => {
    if (output) {
      try {
        const parsed = JSON.parse(output);
        const minified = JSON.stringify(parsed);
        setOutput(minified);
        setIsMinified(true);
        toast.success("JSON minified!");
      } catch (error) {
        toast.error("Failed to minify JSON");
      }
    }
  }, [output]);

  const handleReset = useCallback(() => {
    setOutput(originalOutput);
    setIsMinified(false);
    toast.success("Reset to original format");
  }, [originalOutput]);

  return (
    <div className="space-y-4">
      <div className="text-center mb-4 sm:mb-6 min-h-[60px] sm:min-h-[80px] flex flex-col items-center justify-center px-2">
        <h2 className="text-lg sm:text-xl font-semibold mb-2">CSV to JSON Converter</h2>
        <p className="text-xs sm:text-sm text-muted-foreground">
          Transform your CSV data into JSON format
        </p>
      </div>

      <div className="flex flex-col lg:grid lg:grid-cols-[1fr_auto_1fr] gap-4 min-h-[400px] lg:h-[calc(100vh-320px)] max-w-full overflow-hidden">
        <ConverterPanel
          label="Input CSV"
          value={input}
          onChange={setInput}
          placeholder={CSV_EXAMPLE}
          allowFileUpload={true}
          acceptedFileTypes=".csv,text/csv"
          isCsvOutput={false}
        />

      <div className="flex items-center justify-center order-last lg:order-none py-2 lg:py-0">
        <Button
          onClick={handleConvert}
          disabled={!input.trim() || isConverting}
          className="gap-2 w-full sm:w-auto"
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
        showMinify={output && !isMinified}
        showReset={output && isMinified}
        onMinify={handleMinify}
        onReset={handleReset}
      />
      </div>
    </div>
  );
});

CsvToJsonConverter.displayName = "CsvToJsonConverter";