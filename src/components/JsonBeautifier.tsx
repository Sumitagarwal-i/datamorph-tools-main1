import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { ConverterPanel } from "./ConverterPanel";
import { beautifyJson, minifyJson, downloadFile, repairJson } from "@/lib/converters";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";

const JSON_EXAMPLE = `{"name":"John","age":30,"city":"New York","hobbies":["reading","coding"]}`;

export const JsonBeautifier = () => {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isValid, setIsValid] = useState<boolean | null>(null);
  const [validationMessage, setValidationMessage] = useState("");

  const validateJson = (jsonText: string) => {
    if (!jsonText.trim()) {
      setIsValid(null);
      setValidationMessage("");
      return;
    }

    try {
      JSON.parse(jsonText);
      setIsValid(true);
      setValidationMessage("Valid JSON ✓");
    } catch (error) {
      setIsValid(false);
      if (error instanceof SyntaxError) {
        setValidationMessage(`Invalid JSON: ${error.message}`);
      } else {
        setValidationMessage("Invalid JSON");
      }
    }
  };

  const handleInputChange = (value: string) => {
    setInput(value);
    validateJson(value);
  };

  const handleBeautify = async () => {
    setIsProcessing(true);
    await new Promise(resolve => setTimeout(resolve, 200));

    const result = beautifyJson(input);
    if (result.success && result.data) {
      setOutput(result.data);
      toast.success("JSON beautified!");
    } else {
      toast.error(result.error || "Beautify failed");
      setOutput("");
    }

    setIsProcessing(false);
  };

  const handleMinify = async () => {
    setIsProcessing(true);
    await new Promise(resolve => setTimeout(resolve, 200));

    const result = minifyJson(input);
    if (result.success && result.data) {
      setOutput(result.data);
      toast.success("JSON minified!");
    } else {
      toast.error(result.error || "Minify failed");
      setOutput("");
    }

    setIsProcessing(false);
  };

  const handleRepair = async () => {
    setIsProcessing(true);
    await new Promise(resolve => setTimeout(resolve, 200));

    const result = repairJson(input);
    if (result.success && result.data) {
      setOutput(result.data);
      toast.success("JSON repaired successfully!");
      // Also update validation
      setIsValid(true);
      setValidationMessage("Valid JSON ✓ (Repaired)");
    } else {
      toast.error(result.error || "Failed to repair JSON");
      setOutput("");
    }

    setIsProcessing(false);
  };

  const handleDownload = () => {
    downloadFile(output, "formatted.json");
    toast.success("File downloaded!");
  };

  return (
    <div className="space-y-4">
      <div className="text-center mb-4 sm:mb-6 min-h-[60px] sm:min-h-[80px] flex flex-col items-center justify-center px-2">
        <h2 className="text-lg sm:text-xl font-semibold mb-2">JSON Beautifier & Validator</h2>
        <p className="text-xs sm:text-sm text-muted-foreground">
          Format, validate, and minify JSON data instantly
        </p>
      </div>

      {isValid !== null && (
        <Alert variant={isValid ? "default" : "destructive"} className="py-1 px-3 mb-2">
          <div className="flex items-center gap-2">
            {isValid ? (
              <CheckCircle2 className="h-3 w-3" />
            ) : (
              <XCircle className="h-3 w-3" />
            )}
            <AlertDescription className="text-xs">{validationMessage}</AlertDescription>
          </div>
        </Alert>
      )}

      <div className="flex flex-col lg:grid lg:grid-cols-[1fr_auto_1fr] gap-4 min-h-[400px] lg:h-[calc(100vh-360px)] max-w-full overflow-hidden">
        <ConverterPanel
          label="Input JSON"
          value={input}
          onChange={handleInputChange}
          placeholder={JSON_EXAMPLE}
          allowFileUpload={true}
          acceptedFileTypes=".json,application/json"
        />

        <div className="flex items-center justify-center flex-col gap-2 sm:gap-3 order-last lg:order-none py-2 lg:py-0">
          <Button
            onClick={handleBeautify}
            disabled={!input.trim() || isProcessing || isValid === false}
            className="gap-2 w-full sm:w-32"
            size="lg"
          >
            {isProcessing ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              "Beautify"
            )}
          </Button>
          <Button
            onClick={handleMinify}
            disabled={!input.trim() || isProcessing || isValid === false}
            className="gap-2 w-full sm:w-32"
            variant="outline"
            size="lg"
          >
            {isProcessing ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              "Minify"
            )}
          </Button>
          <Button
            onClick={handleRepair}
            disabled={!input.trim() || isProcessing}
            className="gap-2 w-full sm:w-32"
            variant="secondary"
            size="lg"
          >
            {isProcessing ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              "Repair"
            )}
          </Button>
        </div>

        <ConverterPanel
          label="Output JSON"
          value={output}
          readOnly
          placeholder="Formatted JSON will appear here..."
          onDownload={handleDownload}
        />
      </div>
    </div>
  );
};
