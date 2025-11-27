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

/**
 * Industry-standard JSON normalization engine
 * Follows pandas, BigQuery, Airbyte, and Databricks conventions
 */

// Check if array contains only objects
const isArrayOfObjects = (arr: unknown[]): boolean => {
  return arr.length > 0 && arr.every(item => 
    typeof item === 'object' && item !== null && !Array.isArray(item)
  );
};

// Check if array contains only scalars
const isArrayOfScalars = (arr: unknown[]): boolean => {
  return arr.length > 0 && arr.every(item => 
    typeof item !== 'object' || item === null
  );
};

/**
 * Flatten a single record using dot-notation for nested objects
 * Arrays are preserved for later processing
 * Empty objects are skipped to reduce noise
 */
const flattenRecord = (
  record: Record<string, unknown>,
  parentKey: string = '',
  result: Record<string, unknown> = {},
  maxDepth: number = 10,
  currentDepth: number = 0
): Record<string, unknown> => {
  for (const [key, value] of Object.entries(record)) {
    const newKey = parentKey ? `${parentKey}.${key}` : key;

    if (value === null || value === undefined) {
      result[newKey] = value;
    } else if (Array.isArray(value)) {
      // Preserve arrays - will be handled in normalization step
      result[newKey] = value;
    } else if (typeof value === 'object') {
      const valueObj = value as Record<string, unknown>;
      
      // Skip empty objects to avoid clutter
      if (Object.keys(valueObj).length === 0) {
        // Store empty objects as null instead of creating columns
        continue;
      }
      
      // Prevent excessive nesting (protection against circular refs and huge depth)
      if (currentDepth >= maxDepth) {
        result[newKey] = JSON.stringify(value);
        continue;
      }
      
      // Recursively flatten nested objects with dot notation
      flattenRecord(valueObj, newKey, result, maxDepth, currentDepth + 1);
    } else {
      // Scalar values (string, number, boolean)
      result[newKey] = value;
    }
  }

  return result;
};

/**
 * Get depth of a dot-notation key (e.g., "user.address.city" = 3)
 */
const getKeyDepth = (key: string): number => {
  return key.split('.').length;
};

/**
 * Intelligently prioritize fields based on common patterns
 * Returns a score (higher = more important)
 */
const getFieldPriority = (key: string, value: unknown): number => {
  let score = 100; // Base score
  
  const depth = getKeyDepth(key);
  const lowerKey = key.toLowerCase();
  
  // Penalty for deep nesting (exponential)
  score -= (depth - 1) * 15;
  
  // Boost common important fields
  if (lowerKey.includes('id') || lowerKey.includes('name') || lowerKey.includes('type')) {
    score += 30;
  }
  
  // Boost top-level fields
  if (depth === 1) {
    score += 20;
  }
  
  // Penalty for overly specific nested paths
  if (depth > 4) {
    score -= 30;
  }
  
  // Boost fields with actual values (not null/empty)
  if (value !== null && value !== undefined && value !== '') {
    score += 10;
  }
  
  // Penalty for very long key names (likely over-nested)
  if (key.length > 50) {
    score -= 20;
  }
  
  return score;
};

/**
 * Extract all possible key paths from an array of records
 * Preserves original key order from JSON
 * Optionally filters out low-priority deeply nested fields
 * This ensures consistent CSV columns across all rows
 */
const extractAllKeys = (
  records: Record<string, unknown>[],
  prioritizeFields: boolean = true
): string[] => {
  const keyOrderMap = new Map<string, number>();
  const keyPriorityMap = new Map<string, number>();
  let order = 0;
  
  for (const record of records) {
    const flattened = flattenRecord(record);
    for (const [key, value] of Object.entries(flattened)) {
      // Only add non-array keys (arrays will be handled separately)
      if (!Array.isArray(value) && !keyOrderMap.has(key)) {
        keyOrderMap.set(key, order++);
        
        if (prioritizeFields) {
          // Calculate priority score
          const currentPriority = keyPriorityMap.get(key) || 0;
          const newPriority = getFieldPriority(key, value);
          keyPriorityMap.set(key, Math.max(currentPriority, newPriority));
        }
      }
    }
  }
  
  let keys = Array.from(keyOrderMap.keys());
  
  // Filter out very low priority fields if we have too many columns
  if (prioritizeFields && keys.length > 50) {
    const threshold = 40; // Minimum priority score to include
    keys = keys.filter(key => {
      const priority = keyPriorityMap.get(key) || 0;
      return priority >= threshold;
    });
  }
  
  // Return keys in the order they were first encountered
  return keys;
};

/**
 * Normalize a single record: expand arrays of objects into multiple rows
 * This is the ETL standard behavior (similar to pandas explode)
 */
const normalizeRecord = (record: Record<string, unknown>): Record<string, unknown>[] => {
  const flattened = flattenRecord(record);
  const results: Record<string, unknown>[] = [];
  
  // Find arrays that need expansion
  const arrayFields: Array<{ key: string; value: unknown[] }> = [];
  const scalarFields: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(flattened)) {
    if (Array.isArray(value)) {
      if (isArrayOfObjects(value)) {
        // Array of objects - will expand into multiple rows
        arrayFields.push({ key, value });
      } else if (isArrayOfScalars(value)) {
        // Array of scalars - join with semicolons
        scalarFields[key] = value.map(v => String(v ?? '')).join(';');
      } else {
        // Mixed array - serialize as JSON
        scalarFields[key] = JSON.stringify(value);
      }
    } else {
      scalarFields[key] = value;
    }
  }
  
  // If no arrays to expand, return single row
  if (arrayFields.length === 0) {
    return [scalarFields];
  }
  
  // Expand first array of objects
  const firstArray = arrayFields[0];
  for (const arrayItem of firstArray.value) {
    if (typeof arrayItem === 'object' && arrayItem !== null) {
      // Flatten the array item with parent key prefix
      const flattenedItem = flattenRecord(
        arrayItem as Record<string, unknown>,
        firstArray.key
      );
      
      // Merge parent fields with child fields
      const mergedRow = { ...scalarFields, ...flattenedItem };
      results.push(mergedRow);
    }
  }
  
  // If multiple array fields exist, handle remaining arrays
  // For now, serialize them (can be enhanced later for cross-product)
  if (arrayFields.length > 1) {
    for (let i = 1; i < arrayFields.length; i++) {
      const field = arrayFields[i];
      for (const row of results) {
        row[field.key] = JSON.stringify(field.value);
      }
    }
  }
  
  return results.length > 0 ? results : [scalarFields];
};

/**
 * Detect if an object is a collection where each key represents an entity
 * (e.g., { "com": {...}, "net": {...}, "co": {...} })
 */
const isEntityCollection = (obj: Record<string, unknown>): boolean => {
  const values = Object.values(obj);
  
  // Must have at least 2 entries
  if (values.length < 2) return false;
  
  // All values must be objects (not arrays)
  if (!values.every(v => typeof v === 'object' && v !== null && !Array.isArray(v))) {
    return false;
  }
  
  // Check if objects have similar structure (share common keys)
  const firstObj = values[0] as Record<string, unknown>;
  const firstKeys = new Set(Object.keys(firstObj));
  
  // At least 80% of values should have similar structure
  const similarCount = values.filter(v => {
    const vObj = v as Record<string, unknown>;
    const vKeys = Object.keys(vObj);
    const commonKeys = vKeys.filter(k => firstKeys.has(k));
    return commonKeys.length / vKeys.length >= 0.5;
  }).length;
  
  return similarCount / values.length >= 0.8;
};

/**
 * Convert entity collection to array of records with entity key
 * Example: { "com": {type: "gTLD"}, "net": {type: "gTLD"} }
 * Becomes: [{ tld: "com", type: "gTLD" }, { tld: "net", type: "gTLD" }]
 */
const expandEntityCollection = (
  obj: Record<string, unknown>,
  keyName: string = 'id'
): Record<string, unknown>[] => {
  return Object.entries(obj).map(([key, value]) => {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      return {
        [keyName]: key,
        ...(value as Record<string, unknown>)
      };
    }
    return { [keyName]: key, value };
  });
};

/**
 * Professional JSON to CSV converter
 * Industry-standard normalization following pandas, BigQuery, Airbyte conventions
 * 
 * Features:
 * - Dot-notation flattening for nested objects
 * - Array of objects expansion (multiple rows per parent)
 * - Entity collection detection (e.g., {com: {...}, net: {...}})
 * - Consistent schema across all rows
 * - Proper handling of scalar arrays (semicolon-joined)
 * - Mixed arrays serialized as JSON
 */
export const jsonToCsv = (jsonText: string): ConversionResult => {
  try {
    if (!jsonText.trim()) {
      return { success: false, error: "Please enter JSON data" };
    }

    const jsonData: unknown = JSON.parse(jsonText);
    let normalizedRows: Record<string, unknown>[] = [];

    // Step 1: Normalize input to array of records
    let records: Record<string, unknown>[] = [];
    
    if (Array.isArray(jsonData)) {
      // Filter to only objects
      records = jsonData.filter(item => 
        typeof item === 'object' && item !== null && !Array.isArray(item)
      ) as Record<string, unknown>[];
      
      if (records.length === 0) {
        return {
          success: false,
          error: "JSON array must contain objects. Example: [{\"name\":\"John\",\"age\":30}]",
        };
      }
    } else if (typeof jsonData === 'object' && jsonData !== null) {
      const obj = jsonData as Record<string, unknown>;
      
      // Check if it's a nested structure with a wrapper key (e.g., {data: {...}})
      if (Object.keys(obj).length === 1) {
        const singleKey = Object.keys(obj)[0];
        const singleValue = obj[singleKey];
        
        if (typeof singleValue === 'object' && singleValue !== null && !Array.isArray(singleValue)) {
          const innerObj = singleValue as Record<string, unknown>;
          
          // Check if inner object is an entity collection
          if (isEntityCollection(innerObj)) {
            // Expand entity collection (e.g., {data: {com: {...}, net: {...}}})
            records = expandEntityCollection(innerObj, singleKey === 'data' ? 'tld' : 'id');
          } else {
            // Regular nested object
            records = [obj];
          }
        } else {
          records = [obj];
        }
      }
      // Check if root object is an entity collection
      else if (isEntityCollection(obj)) {
        records = expandEntityCollection(obj, 'id');
      }
      // Single object - check if it contains arrays that should be expanded
      else {
        const hasArrays = Object.values(obj).some(v => Array.isArray(v));
        
        if (hasArrays) {
          // Try to expand arrays within the object
          const expanded = normalizeRecord(obj);
          records = expanded.length > 0 ? expanded : [obj];
        } else {
          records = [obj];
        }
      }
    } else {
      return {
        success: false,
        error: "JSON must be an object or array of objects",
      };
    }

    // Step 2: Normalize each record (expand arrays, flatten nested objects)
    for (const record of records) {
      const normalized = normalizeRecord(record);
      normalizedRows.push(...normalized);
    }

    if (normalizedRows.length === 0) {
      return { success: false, error: "No data to convert" };
    }

    // Step 3: Extract unified schema (all possible column names)
    // Keys are in the order they first appeared in the JSON
    const allKeys = extractAllKeys(normalizedRows);
    
    // Step 4: Ensure all rows have consistent columns in original order
    const finalRows = normalizedRows.map(row => {
      const normalized: Record<string, unknown> = {};
      
      // Maintain original key order from JSON
      for (const key of allKeys) {
        // Get value or empty string if missing
        normalized[key] = row[key] !== undefined ? row[key] : '';
      }
      
      return normalized;
    });

    // Step 5: Generate CSV
    const csv = Papa.unparse(finalRows, {
      quotes: false,
      quoteChar: '"',
      escapeChar: '"',
      header: true,
    });

    return {
      success: true,
      data: csv,
      itemCount: finalRows.length,
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