import Papa from "papaparse";

export interface ConversionResult {
  success: boolean;
  data?: string;
  error?: string;
  itemCount?: number;
}

export const csvToJson = (csvText: string): ConversionResult => {
  try {
    if (!csvText.trim()) {
      return { success: false, error: "Please enter CSV data" };
    }

    const trimmedText = csvText.trim();
    const lines = trimmedText.split('\n').filter(line => line.trim());
    
    // If only one line, treat it as data without headers
    if (lines.length === 1) {
      const values = lines[0].split(',').map(v => v.trim());
      const jsonData = JSON.stringify(values, null, 2);
      return {
        success: true,
        data: jsonData,
        itemCount: values.length,
      };
    }

    // Enhanced CSV parsing with better handling of edge cases
    const result = Papa.parse<Record<string, string>>(trimmedText, {
      header: true,
      skipEmptyLines: 'greedy', // Remove all empty lines
      transformHeader: (header) => header.trim(), // Clean headers
      transform: (value) => {
        // Handle empty values
        if (value === '' || value === null || value === undefined) {
          return null;
        }
        // Try to preserve numbers
        const num = Number(value);
        if (!isNaN(num) && value.trim() !== '') {
          return num;
        }
        return value;
      },
      dynamicTyping: true, // Auto-detect numbers, booleans
    });

    if (result.errors && result.errors.length > 0) {
      const errorMsg = result.errors[0];
      return {
        success: false,
        error: `CSV Parse Error (Line ${errorMsg.row || "unknown"}): ${errorMsg.message}`,
      };
    }

    // Filter out completely empty objects
    const cleanedData = result.data.filter(row => {
      return Object.values(row).some(val => val !== null && val !== '');
    });

    if (cleanedData.length === 0) {
      return { success: false, error: "No valid data found in CSV" };
    }

    const jsonData = JSON.stringify(cleanedData, null, 2);
    return {
      success: true,
      data: jsonData,
      itemCount: cleanedData.length,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
};

export const jsonToCsv = (jsonText: string): ConversionResult => {
  try {
    if (!jsonText.trim()) {
      return { success: false, error: "Please enter JSON data" };
    }

    const jsonData = JSON.parse(jsonText);

    if (!Array.isArray(jsonData)) {
      return {
        success: false,
        error: "JSON must be an array of objects. Example: [{\"name\":\"John\",\"age\":30}]",
      };
    }

    if (jsonData.length === 0) {
      return { success: false, error: "JSON array is empty" };
    }

    // Collect all unique keys across all objects
    const allKeys = new Set<string>();
    jsonData.forEach(item => {
      if (typeof item === 'object' && item !== null) {
        Object.keys(item).forEach(key => allKeys.add(key));
      }
    });

    // Flatten nested objects and handle missing keys
    const flattenedData = jsonData.map(item => {
      const flatItem: Record<string, any> = {};
      
      allKeys.forEach(key => {
        if (item && typeof item === 'object' && key in item) {
          const value = item[key];
          
          // Handle nested objects by converting to JSON string (best for conversion back)
          if (value && typeof value === 'object' && !Array.isArray(value)) {
            flatItem[key] = JSON.stringify(value);
          } else if (Array.isArray(value)) {
            // Store arrays as JSON strings for proper roundtrip conversion
            flatItem[key] = JSON.stringify(value);
          } else {
            flatItem[key] = value;
          }
        } else {
          flatItem[key] = ''; // Fill missing keys with empty string
        }
      });
      
      return flatItem;
    });

    const csv = Papa.unparse(flattenedData, {
      quotes: false, // Let Papa handle quoting intelligently (only when needed)
      quoteChar: '"',
      escapeChar: '"',
      header: true,
    });

    return {
      success: true,
      data: csv,
      itemCount: jsonData.length,
    };
  } catch (error) {
    if (error instanceof SyntaxError) {
      return {
        success: false,
        error: `Invalid JSON: ${error.message}`,
      };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
};

export const downloadFile = (content: string, filename: string) => {
  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// Auto-detect format: returns 'json', 'csv', or 'unknown'
export const detectFormat = (input: string): 'json' | 'csv' | 'unknown' => {
  const trimmed = input.trim();
  
  if (!trimmed) return 'unknown';
  
  // Check if it's JSON
  if ((trimmed.startsWith('[') && trimmed.endsWith(']')) || 
      (trimmed.startsWith('{') && trimmed.endsWith('}'))) {
    try {
      JSON.parse(trimmed);
      return 'json';
    } catch {
      // Not valid JSON, continue checking
    }
  }
  
  // Check if it's CSV (simple heuristic)
  const lines = trimmed.split('\n').filter(l => l.trim());
  if (lines.length >= 1) {
    const firstLine = lines[0];
    // If it has commas and doesn't look like JSON
    if (firstLine.includes(',') && !firstLine.includes('{') && !firstLine.includes('[')) {
      return 'csv';
    }
  }
  
  return 'unknown';
};

// Beautify JSON
export const beautifyJson = (jsonText: string): ConversionResult => {
  try {
    if (!jsonText.trim()) {
      return { success: false, error: "Please enter JSON data" };
    }

    const parsed = JSON.parse(jsonText);
    const beautified = JSON.stringify(parsed, null, 2);
    
    return {
      success: true,
      data: beautified,
    };
  } catch (error) {
    if (error instanceof SyntaxError) {
      return {
        success: false,
        error: `Invalid JSON: ${error.message}`,
      };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
};

// Minify JSON
export const minifyJson = (jsonText: string): ConversionResult => {
  try {
    if (!jsonText.trim()) {
      return { success: false, error: "Please enter JSON data" };
    }

    const parsed = JSON.parse(jsonText);
    const minified = JSON.stringify(parsed);
    
    return {
      success: true,
      data: minified,
    };
  } catch (error) {
    if (error instanceof SyntaxError) {
      return {
        success: false,
        error: `Invalid JSON: ${error.message}`,
      };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
};