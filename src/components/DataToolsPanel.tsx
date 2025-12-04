import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, XCircle, Sparkles } from "lucide-react";
import { ConverterPanel } from "./ConverterPanel";
import { 
  beautifyJson, 
  minifyJson, 
  downloadFile, 
  repairJson,
  beautifyCsv,
  minifyCsv,
  validateCsv,
  repairCsv,
  detectFormat
} from "@/lib/converters";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";

const JSON_EXAMPLE = `{"name":"John","age":30,"city":"New York","hobbies":["reading","coding"]}`;
const CSV_EXAMPLE = `name,age,city\nJohn,30,New York\nJane,25,Boston`;

const DEMO_DATA = `{
  "shoppingList": {
    "groceries": [
      {
        "item": "Apples",
        "quantity": 3,
        "unit": "lbs"
      },
      {
        "item": "Grapes",
        "quantity": 2,
        "unit": "lbs"
      },
      {
        "item": "Bread",
        "quantity": 2,
        "unit": "loaves"
      },
      {
        "item": "Milk",
        "quantity": 1,
        "unit": "gallon"
      },
      {
        "item": "Eggs",
        "quantity": 1,
        "unit": "dozen"
      },
      {
        "item": "Chicken",
        "quantity": 2,
        "unit": "lbs"
      },
      {
        "item": "Meat",
        "quantity": 1,
        "unit": "lbs"
      },
      {
        "item": "Tomato",
        "quantity": 2,
        "unit": "lbs"
      }
    ],
    "personalCare": [
      {
        "item": "Toothpaste",
        "quantity": 2,
        "unit": "packs"
      },
      {
        "item": "Shampoo",
        "quantity": 1,
        "unit": "bottle"
      },
      {
        "item": "Soap",
        "quantity": 3,
        "unit": "bars"
      },
      {
        "item": "Toilet Paper",
        "quantity": 1,
        "unit": "pack"
      }
    ],
    "householdItems": [
      {
        "item": "Paper Towels",
        "quantity": 4,
        "unit": "rolls"
      },
      {
        "item": "Laundry Detergent",
        "quantity": 1,
        "unit": "container"
      },
      {
        "item": "Trash Bags",
        "quantity": 2,
        "unit": "boxes"
      },
      {
        "item": "Batteries",
        "quantity": 1,
        "unit": "pack"
      }
    ]
  }
}`;

export const DataToolsPanel = () => {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isValid, setIsValid] = useState<boolean | null>(null);
  const [validationMessage, setValidationMessage] = useState("");
  const [detectedFormat, setDetectedFormat] = useState<'json' | 'csv' | 'unknown'>('unknown');
  const [activeAction, setActiveAction] = useState<'beautify' | 'minify' | 'repair' | 'validate' | null>(null);

  useEffect(() => {
    const format = detectFormat(input);
    setDetectedFormat(format);
  }, [input]);

  const validateInput = (text: string) => {
    if (!text.trim()) {
      setIsValid(null);
      setValidationMessage("");
      return;
    }

    const format = detectFormat(text);
    
    if (format === 'json') {
      try {
        JSON.parse(text);
        setIsValid(true);
        setValidationMessage("Valid JSON");
      } catch (error) {
        setIsValid(false);
        if (error instanceof SyntaxError) {
          setValidationMessage(`Invalid JSON: ${error.message}`);
        } else {
          setValidationMessage("Invalid JSON");
        }
      }
    } else if (format === 'csv') {
      // Basic CSV validation
      const lines = text.trim().split('\n').filter(l => l.trim());
      if (lines.length >= 1) {
        setIsValid(true);
        setValidationMessage(`Valid CSV (${lines.length} rows)`);
      } else {
        setIsValid(false);
        setValidationMessage("Invalid CSV: No data found");
      }
    } else {
      setIsValid(false);
      setValidationMessage("Unknown format: Expected JSON or CSV");
    }
  };

  const handleInputChange = (value: string) => {
    setInput(value);
    validateInput(value);
  };

  // JSON Actions
  const handleBeautify = () => {
    setActiveAction('beautify');
    try {
      if (detectedFormat === 'json') {
        const result = beautifyJson(input);
        if (result.success && result.data) {
          setOutput(result.data);
          toast.success("JSON beautified!");
        } else {
          toast.error(result.error || "Beautify failed");
          setOutput("");
        }
      } else if (detectedFormat === 'csv') {
        const result = beautifyCsv(input);
        if (result.success && result.data) {
          setOutput(result.data);
          toast.success("CSV beautified!");
        } else {
          toast.error(result.error || "Beautify failed");
          setOutput("");
        }
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "An unexpected error occurred");
      setOutput("");
    }
  };

  const handleMinify = () => {
    setActiveAction('minify');
    try {
      if (detectedFormat === 'json') {
        const result = minifyJson(input);
        if (result.success && result.data) {
          setOutput(result.data);
          toast.success("JSON minified!");
        } else {
          toast.error(result.error || "Minify failed");
          setOutput("");
        }
      } else if (detectedFormat === 'csv') {
        const result = minifyCsv(input);
        if (result.success && result.data) {
          setOutput(result.data);
          toast.success("CSV minified!");
        } else {
          toast.error(result.error || "Minify failed");
          setOutput("");
        }
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "An unexpected error occurred");
      setOutput("");
    }
  };

  const handleRepair = () => {
    setActiveAction('repair');
    try {
      if (detectedFormat === 'json') {
        const result = repairJson(input);
        if (result.success && result.data) {
          setOutput(result.data);
          toast.success("JSON repaired successfully!");
          setIsValid(true);
          setValidationMessage("Valid JSON (Repaired)");
        } else {
          toast.error(result.error || "Failed to repair JSON");
          setOutput("");
        }
      } else if (detectedFormat === 'csv') {
        const result = repairCsv(input);
        if (result.success && result.data) {
          setOutput(result.data);
          toast.success("CSV repaired successfully!");
          setIsValid(true);
          setValidationMessage("Valid CSV (Repaired)");
        } else {
          toast.error(result.error || "Failed to repair CSV");
          setOutput("");
        }
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "An unexpected error occurred");
      setOutput("");
    }
  };

  const handleValidate = () => {
    setActiveAction('validate');
    try {
      if (detectedFormat === 'csv') {
        const result = validateCsv(input);
        if (result.success && result.data) {
          setOutput(result.data);
          toast.success("CSV validated!");
        } else {
          toast.error(result.error || "Validation failed");
          setOutput(result.error || "Validation failed");
        }
      } else if (detectedFormat === 'json') {
        JSON.parse(input);
        setOutput("Valid JSON - No errors found.");
        toast.success("JSON is valid!");
      }
    } catch (error) {
      if (detectedFormat === 'json') {
        const errorMsg = error instanceof Error ? error.message : "Invalid JSON";
        setOutput(`Invalid JSON\n${errorMsg}`);
        toast.error("JSON validation failed");
      } else {
        toast.error(error instanceof Error ? error.message : "An unexpected error occurred");
        setOutput("");
      }
    }
  };

  const handleDownload = () => {
    try {
      if (!output.trim()) {
        toast.error("No data to download");
        return;
      }
      const extension = detectedFormat === 'json' ? '.json' : '.csv';
      downloadFile(output, `formatted${extension}`);
      toast.success("File downloaded!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Download failed");
    }
  };

  const getPlaceholder = () => {
    if (detectedFormat === 'json') return JSON_EXAMPLE;
    if (detectedFormat === 'csv') return CSV_EXAMPLE;
    return "Paste your JSON or CSV data here...";
  };

  const getFormatBadge = () => {
    if (detectedFormat === 'json') return 'JSON';
    if (detectedFormat === 'csv') return 'CSV';
    return 'Unknown';
  };

  const loadDemoData = () => {
    setInput(DEMO_DATA);
    setOutput("");
    validateInput(DEMO_DATA);
    toast.success("Demo data loaded!");
  };

  return (
    <div className="space-y-4">
      <div className="text-center mb-4 sm:mb-6 min-h-[60px] sm:min-h-[80px] flex flex-col items-center justify-center px-2">
        <h2 className="text-lg sm:text-xl font-semibold mb-2">More Actions - Auto-Detect JSON & CSV</h2>
        <p className="text-xs sm:text-sm text-muted-foreground">
          Format, validate, and manipulate JSON or CSV data instantly
        </p>
        {detectedFormat !== 'unknown' && (
          <div className="mt-2 text-xs font-medium px-3 py-1 rounded-full bg-primary/10 text-primary">
            Detected: {getFormatBadge()}
          </div>
        )}
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-[500px] lg:h-[600px] max-w-full">
        <ConverterPanel
          label={`Input ${detectedFormat === 'unknown' ? 'Data' : detectedFormat.toUpperCase()}`}
          value={input}
          onChange={handleInputChange}
          placeholder={getPlaceholder()}
          allowFileUpload={true}
          acceptedFileTypes=".json,.csv,application/json,text/csv"
          showDemoButton={true}
          onDemoLoad={loadDemoData}
          isCsvOutput={detectedFormat === 'csv'}
          customAction={
            <div className="flex flex-wrap items-center gap-2">
              <Button
                onClick={handleBeautify}
                disabled={!input.trim() || detectedFormat === 'unknown'}
                size="sm"
                variant="outline"
                className={`h-9 px-3 text-xs transition-all ${
                  activeAction === 'beautify' 
                    ? 'bg-primary text-primary-foreground border-primary' 
                    : ''
                }`}
              >
                Beautify
              </Button>
              
              <Button
                onClick={handleMinify}
                disabled={!input.trim() || detectedFormat === 'unknown'}
                size="sm"
                variant="outline"
                className={`h-9 px-3 text-xs transition-all ${
                  activeAction === 'minify' 
                    ? 'bg-primary text-primary-foreground border-primary' 
                    : ''
                }`}
              >
                Minify
              </Button>

              <Button
                onClick={handleRepair}
                disabled={!input.trim() || detectedFormat === 'unknown'}
                size="sm"
                variant="outline"
                className={`h-9 px-3 text-xs transition-all ${
                  activeAction === 'repair' 
                    ? 'bg-primary text-primary-foreground border-primary' 
                    : ''
                }`}
              >
                Repair
              </Button>

              <Button
                onClick={handleValidate}
                disabled={!input.trim() || detectedFormat === 'unknown'}
                size="sm"
                variant="outline"
                className={`h-9 px-3 text-xs transition-all ${
                  activeAction === 'validate' 
                    ? 'bg-primary text-primary-foreground border-primary' 
                    : ''
                }`}
              >
                Validate
              </Button>
            </div>
          }
        />

        <ConverterPanel
          label={`Output ${detectedFormat === 'unknown' ? 'Data' : detectedFormat.toUpperCase()}`}
          value={output}
          readOnly
          placeholder="Formatted data will appear here..."
          onDownload={handleDownload}
          isCsvOutput={detectedFormat === 'csv'}
        />
      </div>
    </div>
  );
};
