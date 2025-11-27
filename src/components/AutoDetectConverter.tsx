import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight, Loader2, Sparkles, Minimize2, RotateCcw } from "lucide-react";
import { ConverterPanel } from "./ConverterPanel";
import { csvToJson, jsonToCsv, detectFormat, downloadFile, repairJson } from "@/lib/converters";
import { logConversion } from "@/lib/supabaseLogger";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

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

export const AutoDetectConverter = () => {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [isConverting, setIsConverting] = useState(false);
  const [detectedFormat, setDetectedFormat] = useState<string>("");
  const [outputFormat, setOutputFormat] = useState<string>("");
  const [originalOutput, setOriginalOutput] = useState("");
  const [isMinified, setIsMinified] = useState(false);

  const handleConvert = async () => {
    try {
      setIsConverting(true);
      
      if (!input.trim()) {
        toast.error("Please enter some data to convert");
        return;
      }
      
      // Simulate loading for better UX
      await new Promise(resolve => setTimeout(resolve, 300));

      const format = detectFormat(input);
      setDetectedFormat(format.toUpperCase());

      if (format === 'json') {
        // Convert JSON to CSV
        const result = jsonToCsv(input);
        if (result.success && result.data) {
          setOutput(result.data);
          setOriginalOutput(result.data);
          setOutputFormat("CSV");
          setIsMinified(false);
          toast.success("Detected JSON! Converted to CSV");
          if (result.itemCount) {
            await logConversion("JSON", "CSV", result.itemCount);
          }
        } else {
          toast.error(result.error || "Conversion failed");
          setOutput("");
          setOriginalOutput("");
        }
      } else if (format === 'csv') {
        // Convert CSV to JSON
        const result = csvToJson(input);
        if (result.success && result.data) {
          setOutput(result.data);
          setOriginalOutput(result.data);
          setOutputFormat("JSON");
          setIsMinified(false);
          toast.success("Detected CSV! Converted to JSON");
          if (result.itemCount) {
            await logConversion("CSV", "JSON", result.itemCount);
          }
        } else {
          toast.error(result.error || "Conversion failed");
          setOutput("");
          setOriginalOutput("");
        }
      } else {
        toast.error("Unable to detect format. Please use specific converters.");
        setOutput("");
        setOriginalOutput("");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "An unexpected error occurred");
      setOutput("");
      setOriginalOutput("");
    } finally {
      setIsConverting(false);
    }
  };

  const handleDownload = () => {
    try {
      if (!output.trim()) {
        toast.error("No data to download");
        return;
      }
      const extension = outputFormat.toLowerCase();
      downloadFile(output, `converted.${extension}`);
      toast.success("File downloaded!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Download failed");
    }
  };

  const handleInputChange = (value: string) => {
    setInput(value);
    // Reset detection when input changes
    if (!value.trim()) {
      setDetectedFormat("");
      setOutputFormat("");
    }
  };

  const handleMinify = () => {
    try {
      if (outputFormat === "JSON" && output) {
        const parsed = JSON.parse(output);
        const minified = JSON.stringify(parsed);
        setOutput(minified);
        setIsMinified(true);
        toast.success("JSON minified!");
      } else {
        toast.error("Minify is only available for JSON output");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to minify JSON");
    }
  };

  const handleReset = () => {
    try {
      if (!originalOutput) {
        toast.error("No original output to restore");
        return;
      }
      setOutput(originalOutput);
      setIsMinified(false);
      toast.success("Reset to original format");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Reset failed");
    }
  };

  const handleRepair = () => {
    try {
      if (!input.trim()) {
        toast.error("Please enter some data to repair");
        return;
      }
      const result = repairJson(input);
      if (result.success && result.data) {
        setInput(result.data);
        toast.success("JSON repaired successfully!");
      } else {
        toast.error(result.error || "Failed to repair JSON");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "An unexpected error occurred");
    }
  };

  const isJsonInput = () => {
    if (!input.trim()) return false;
    const trimmed = input.trim();
    return (trimmed.startsWith('{') || trimmed.startsWith('['));
  };

  const loadDemoData = () => {
    setInput(DEMO_DATA);
    setDetectedFormat("");
    setOutputFormat("");
    setOutput("");
    toast.success("Demo data loaded!");
  };

  return (
    <div className="space-y-4">
      <div className="text-center mb-4 sm:mb-6 min-h-[60px] sm:min-h-[80px] flex flex-col items-center justify-center px-2">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Sparkles className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
          <h2 className="text-lg sm:text-xl font-semibold">Smart Auto-Detect</h2>
        </div>
        <p className="text-xs sm:text-sm text-muted-foreground">
          Paste your data and we'll automatically detect the format and convert it
        </p>
      </div>

      <div className="flex flex-col lg:grid lg:grid-cols-[1fr_auto_1fr] gap-4 min-h-[400px] lg:h-[calc(100vh-320px)] max-w-full overflow-hidden">
        <ConverterPanel
          label={detectedFormat ? `Input (${detectedFormat})` : "Input Data"}
          value={input}
          onChange={handleInputChange}
          placeholder="Paste CSV or JSON data here..."
          allowFileUpload={true}
          acceptedFileTypes=".csv,.json,text/csv,application/json"
          showRepair={true}
          repairEnabled={isJsonInput()}
          onRepair={handleRepair}
          showDemoButton={true}
          onDemoLoad={loadDemoData}
        />

        <div className="flex lg:flex-col items-center justify-center gap-3 order-last lg:order-none py-2 lg:py-0">
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
          showMinify={outputFormat === "JSON" && output && !isMinified}
          showReset={outputFormat === "JSON" && output && isMinified}
          onMinify={handleMinify}
          onReset={handleReset}
          isCsvOutput={outputFormat === "CSV"}
        />
      </div>
    </div>
  );
};
