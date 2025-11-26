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

// Helper function to flatten nested JSON into rows
const flattenNestedJSON = (data: unknown, parentKey: string = ''): Record<string, unknown>[] => {
  const rows: Record<string, unknown>[] = [];

  if (Array.isArray(data)) {
    // If it's an array of objects, flatten each item
    data.forEach(item => {
      if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
        // Add parent key as a column if exists
        const flatItem = parentKey ? { category: parentKey, ...item } : item;
        rows.push(flatItem);
      }
    });
  } else if (typeof data === 'object' && data !== null) {
    // If it's an object with nested arrays, flatten recursively
    Object.keys(data).forEach(key => {
      const value = data[key];
      if (Array.isArray(value)) {
        // Recursively flatten with the key as parent category
        const nestedRows = flattenNestedJSON(value, key);
        rows.push(...nestedRows);
      } else if (typeof value === 'object' && value !== null) {
        // Handle nested objects
        const nestedRows = flattenNestedJSON(value, key);
        rows.push(...nestedRows);
      }
    });
  }

  return rows;
};

export const jsonToCsv = (jsonText: string): ConversionResult => {
  try {
    if (!jsonText.trim()) {
      return { success: false, error: "Please enter JSON data" };
    }

    const jsonData: unknown = JSON.parse(jsonText);
    let flattenedData: Record<string, unknown>[] = [];

    // Try to intelligently flatten the JSON structure
    if (Array.isArray(jsonData)) {
      // If it's already an array of objects, use it directly
      flattenedData = jsonData.map(item => {
        if (typeof item === 'object' && item !== null) {
          // Flatten any nested objects within the array items
          const flatItem: Record<string, unknown> = {};
          Object.keys(item).forEach(key => {
            const value = item[key];
            if (Array.isArray(value)) {
              flatItem[key] = JSON.stringify(value);
            } else if (typeof value === 'object' && value !== null) {
              flatItem[key] = JSON.stringify(value);
            } else {
              flatItem[key] = value;
            }
          });
          return flatItem;
        }
        return item;
      });
    } else if (typeof jsonData === 'object' && jsonData !== null) {
      // Try to flatten nested structure intelligently
      flattenedData = flattenNestedJSON(jsonData);
      
      // If no rows were created (flat object), wrap in array
      if (flattenedData.length === 0) {
        flattenedData = [jsonData];
      }
    } else {
      return {
        success: false,
        error: "JSON must be an object or array of objects. Example: [{\"name\":\"John\",\"age\":30}]",
      };
    }

    if (flattenedData.length === 0) {
      return { success: false, error: "No data to convert" };
    }

    // Ensure all objects have consistent keys
    const allKeys = new Set<string>();
    flattenedData.forEach(item => {
      if (typeof item === 'object' && item !== null) {
        Object.keys(item).forEach(key => allKeys.add(key));
      }
    });

    // Normalize all rows to have the same keys
    const normalizedData = flattenedData.map(item => {
      const normalized: Record<string, unknown> = {};
      allKeys.forEach(key => {
        normalized[key] = item && typeof item === 'object' && key in item ? item[key] : '';
      });
      return normalized;
    });

    const csv = Papa.unparse(normalizedData, {
      quotes: false,
      quoteChar: '"',
      escapeChar: '"',
      header: true,
    });

    return {
      success: true,
      data: csv,
      itemCount: flattenedData.length,
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

export const repairJson = (jsonText: string): ConversionResult => {
  try {
    if (!jsonText.trim()) {
      return { success: false, error: "Please enter JSON data" };
    }

    let text = jsonText.trim();

    // First, try parsing as-is
    try {
      const parsed = JSON.parse(text);
      return {
        success: true,
        data: JSON.stringify(parsed, null, 2),
      };
    } catch {
      // Continue with repair attempts
    }

    // Remove BOM and invisible characters
    text = text.replace(/^\uFEFF/, '').replace(/[\u200B-\u200D\uFEFF]/g, '');

    // Fix common quote issues
    // Replace smart quotes with regular quotes
    text = text.replace(/[\u201C\u201D]/g, '"').replace(/[\u2018\u2019]/g, "'");
    
    // Fix single quotes to double quotes for keys and string values
    text = text.replace(/(\w+):\s*'([^']*)'/g, '"$1": "$2"');
    text = text.replace(/:\s*'([^']*)'/g, ': "$1"');
    
    // Add quotes to unquoted keys
    text = text.replace(/([{,]\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:/g, '$1"$2":');

    // Fix trailing commas before closing brackets/braces
    text = text.replace(/,(\s*[}\]])/g, '$1');

    // Fix missing commas between elements
    text = text.replace(/"\s*\n\s*"/g, '",\n"');
    text = text.replace(/}(\s*){/g, '},\n{');
    text = text.replace(/](\s*)\[/g, '],\n[');
    text = text.replace(/}(\s*)\[/g, '},\n[');
    text = text.replace(/](\s*){/g, '],\n{');
    
    // Fix missing commas after values
    text = text.replace(/(\d+|true|false|null)(\s+)"([^"]+)":/g, '$1,\n"$3":');
    text = text.replace(/"([^"]*)"(\s+)"([^"]+)":/g, '"$1",\n"$3":');

    // Fix concatenated values without commas
    text = text.replace(/"([^"]*)"(\s*)"([^"]*)"/g, '"$1", "$3"');

    // Balance brackets and braces
    const openBraces = (text.match(/{/g) || []).length;
    const closeBraces = (text.match(/}/g) || []).length;
    const openBrackets = (text.match(/\[/g) || []).length;
    const closeBrackets = (text.match(/]/g) || []).length;

    // Add missing closing brackets/braces
    if (openBraces > closeBraces) {
      text += '\n' + '}'.repeat(openBraces - closeBraces);
    }
    if (openBrackets > closeBrackets) {
      text += '\n' + ']'.repeat(openBrackets - closeBrackets);
    }

    // Remove extra closing brackets/braces
    if (closeBraces > openBraces) {
      let count = closeBraces - openBraces;
      text = text.replace(/}/g, (match) => {
        if (count > 0) {
          count--;
          return '';
        }
        return match;
      });
    }
    if (closeBrackets > openBrackets) {
      let count = closeBrackets - openBrackets;
      text = text.replace(/]/g, (match) => {
        if (count > 0) {
          count--;
          return '';
        }
        return match;
      });
    }

    // Fix escape sequences
    text = text.replace(/\\(?!["\\/bfnrtu])/g, '\\\\');

    // Remove trailing commas (again, after all modifications)
    text = text.replace(/,(\s*[}\]])/g, '$1');

    // Try parsing after repairs
    try {
      const parsed = JSON.parse(text);
      return {
        success: true,
        data: JSON.stringify(parsed, null, 2),
      };
    } catch (finalError) {
      // If still failing, try one more aggressive repair
      // Wrap in array if it looks like multiple objects
      if (text.includes('}{')) {
        text = '[' + text.replace(/}\s*{/g, '},\n{') + ']';
        try {
          const parsed = JSON.parse(text);
          return {
            success: true,
            data: JSON.stringify(parsed, null, 2),
          };
        } catch {
          // Fall through to error
        }
      }

      return {
        success: false,
        error: finalError instanceof Error ? `Could not repair JSON: ${finalError.message}` : "Unable to repair JSON",
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
};

// CSV Manipulation Functions

// Beautify CSV - adds consistent spacing and formatting
export const beautifyCsv = (csvText: string): ConversionResult => {
  try {
    if (!csvText.trim()) {
      return { success: false, error: "Please enter CSV data" };
    }

    const result = Papa.parse(csvText, {
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: (header) => header.trim(),
    });

    if (result.errors && result.errors.length > 0) {
      return {
        success: false,
        error: `CSV Parse Error: ${result.errors[0].message}`,
      };
    }

    const beautified = Papa.unparse(result.data, {
      header: true,
      quotes: true, // Add quotes for better readability
      quoteChar: '"',
    });

    return {
      success: true,
      data: beautified,
      itemCount: result.data.length,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
};

// Minify CSV - removes extra spaces and unnecessary quotes
export const minifyCsv = (csvText: string): ConversionResult => {
  try {
    if (!csvText.trim()) {
      return { success: false, error: "Please enter CSV data" };
    }

    const result = Papa.parse(csvText, {
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: (header) => header.trim(),
    });

    if (result.errors && result.errors.length > 0) {
      return {
        success: false,
        error: `CSV Parse Error: ${result.errors[0].message}`,
      };
    }

    const minified = Papa.unparse(result.data, {
      header: true,
      quotes: false, // Remove unnecessary quotes
      quoteChar: '"',
    });

    return {
      success: true,
      data: minified,
      itemCount: result.data.length,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
};

// Sort CSV by first column
export const sortCsv = (csvText: string): ConversionResult => {
  try {
    if (!csvText.trim()) {
      return { success: false, error: "Please enter CSV data" };
    }

    const result = Papa.parse<Record<string, unknown>>(csvText, {
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: (header) => header.trim(),
      dynamicTyping: true,
    });

    if (result.errors && result.errors.length > 0) {
      return {
        success: false,
        error: `CSV Parse Error: ${result.errors[0].message}`,
      };
    }

    const data = result.data;
    if (data.length === 0) {
      return { success: false, error: "No data to sort" };
    }

    // Get the first column name
    const firstColumn = Object.keys(data[0])[0];
    
    // Sort by first column
    const sorted = [...data].sort((a, b) => {
      const valA = a[firstColumn];
      const valB = b[firstColumn];
      
      if (typeof valA === 'number' && typeof valB === 'number') {
        return valA - valB;
      }
      
      return String(valA).localeCompare(String(valB));
    });

    const sortedCsv = Papa.unparse(sorted, {
      header: true,
      quotes: false,
    });

    return {
      success: true,
      data: sortedCsv,
      itemCount: sorted.length,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
};

// Validate CSV
export const validateCsv = (csvText: string): ConversionResult => {
  try {
    if (!csvText.trim()) {
      return { success: false, error: "Please enter CSV data" };
    }

    const result = Papa.parse(csvText, {
      header: true,
      skipEmptyLines: 'greedy',
    });

    if (result.errors && result.errors.length > 0) {
      const errorDetails = result.errors.map(err => 
        `Line ${err.row || 'unknown'}: ${err.message}`
      ).join('\n');
      
      return {
        success: false,
        error: `CSV Validation Failed:\n${errorDetails}`,
      };
    }

    const rowCount = result.data.length;
    const colCount = result.meta.fields?.length || 0;

    return {
      success: true,
      data: `Valid CSV\n${rowCount} rows, ${colCount} columns\nHeaders: ${result.meta.fields?.join(', ') || 'none'}`,
      itemCount: rowCount,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
};

// Repair CSV - fixes common issues
export const repairCsv = (csvText: string): ConversionResult => {
  try {
    if (!csvText.trim()) {
      return { success: false, error: "Please enter CSV data" };
    }

    let text = csvText.trim();

    // Remove BOM
    text = text.replace(/^\uFEFF/, '');

    // Fix line endings
    text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // Remove empty lines
    const lines = text.split('\n').filter(line => line.trim());
    
    if (lines.length === 0) {
      return { success: false, error: "No data found" };
    }

    // Parse with error recovery
    const result = Papa.parse(lines.join('\n'), {
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: (header) => header.trim().replace(/[^\w\s-]/g, '_'),
      transform: (value) => value.trim(),
    });

    // Remove rows with all empty values
    const cleanData = result.data.filter((row: Record<string, unknown>) => {
      return Object.values(row).some(val => val !== null && val !== '');
    });

    if (cleanData.length === 0) {
      return { success: false, error: "No valid data after repair" };
    }

    const repaired = Papa.unparse(cleanData, {
      header: true,
      quotes: false,
    });

    return {
      success: true,
      data: repaired,
      itemCount: cleanData.length,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
};