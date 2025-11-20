import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight, Loader2, Sparkles } from "lucide-react";
import { ConverterPanel } from "./ConverterPanel";
import { csvToJson, jsonToCsv, detectFormat, downloadFile } from "@/lib/converters";
import { logConversion } from "@/lib/supabaseLogger";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

export const AutoDetectConverter = () => {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [isConverting, setIsConverting] = useState(false);
  const [detectedFormat, setDetectedFormat] = useState<string>("");
  const [outputFormat, setOutputFormat] = useState<string>("");

  const handleConvert = async () => {
    setIsConverting(true);
    
    // Simulate loading for better UX
    await new Promise(resolve => setTimeout(resolve, 300));

    const format = detectFormat(input);
    setDetectedFormat(format.toUpperCase());

    if (format === 'json') {
      // Convert JSON to CSV
      const result = jsonToCsv(input);
      if (result.success && result.data) {
        setOutput(result.data);
        setOutputFormat("CSV");
        toast.success("Detected JSON! Converted to CSV");
        if (result.itemCount) {
          await logConversion("JSON", "CSV", result.itemCount);
        }
      } else {
        toast.error(result.error || "Conversion failed");
        setOutput("");
      }
    } else if (format === 'csv') {
      // Convert CSV to JSON
      const result = csvToJson(input);
      if (result.success && result.data) {
        setOutput(result.data);
        setOutputFormat("JSON");
        toast.success("Detected CSV! Converted to JSON");
        if (result.itemCount) {
          await logConversion("CSV", "JSON", result.itemCount);
        }
      } else {
        toast.error(result.error || "Conversion failed");
        setOutput("");
      }
    } else {
      toast.error("Unable to detect format. Please use specific converters.");
      setOutput("");
    }

    setIsConverting(false);
  };

  const handleDownload = () => {
    const extension = outputFormat.toLowerCase();
    downloadFile(output, `converted.${extension}`);
    toast.success("File downloaded!");
  };

  const handleInputChange = (value: string) => {
    setInput(value);
    // Reset detection when input changes
    if (!value.trim()) {
      setDetectedFormat("");
      setOutputFormat("");
    }
  };

  return (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold">Smart Auto-Detect</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Paste your data and we'll automatically detect the format and convert it
        </p>
      </div>

      <div className="grid md:grid-cols-[1fr_auto_1fr] gap-4 h-[calc(100vh-320px)]">
        <ConverterPanel
          label={detectedFormat ? `Input (${detectedFormat})` : "Input Data"}
          value={input}
          onChange={handleInputChange}
          placeholder="Paste CSV or JSON data here..."
          allowFileUpload={true}
          acceptedFileTypes=".csv,.json,text/csv,application/json"
        />

        <div className="flex items-center justify-center flex-col gap-3">
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
            Auto Convert
          </Button>
          {detectedFormat && (
            <Badge variant="secondary" className="text-xs">
              {detectedFormat} → {outputFormat}
            </Badge>
          )}
        </div>

        <ConverterPanel
          label={outputFormat ? `Output (${outputFormat})` : "Output Data"}
          value={output}
          readOnly
          placeholder="Converted output will appear here..."
          onDownload={handleDownload}
        />
      </div>
    </div>
  );
};
