/**
 * Schema Fingerprint - Lightweight schema detection for grounding
 */

export interface SchemaFingerprint {
  fileType: 'json' | 'csv' | 'xml' | 'yaml';
  topLevelKeys?: string[];
  columnHeaders?: string[];
  tagNames?: string[];
  recordCount?: number;
  dataTypes?: Record<string, string[]>;
  issues?: string[];
}

/**
 * Build JSON schema fingerprint
 */
export function jsonFingerprint(
  parsedData: any,
  sampleSize: number = 10
): SchemaFingerprint {
  const fingerprint: SchemaFingerprint = {
    fileType: 'json',
    topLevelKeys: [],
    dataTypes: {},
    issues: [],
  };
  
  try {
    if (Array.isArray(parsedData)) {
      // Array of objects
      const sample = parsedData.slice(0, sampleSize);
      fingerprint.recordCount = parsedData.length;
      
      // Collect all keys
      const allKeys = new Set<string>();
      for (const record of sample) {
        if (typeof record === 'object' && record !== null) {
          Object.keys(record).forEach(k => allKeys.add(k));
        }
      }
      
      fingerprint.topLevelKeys = Array.from(allKeys);
      
      // Detect data types
      for (const key of fingerprint.topLevelKeys) {
        const types = new Set<string>();
        for (const record of sample) {
          if (record && typeof record === 'object' && key in record) {
            const value = record[key];
            const type = typeof value === 'object' ? Array.isArray(value) ? 'array' : 'object' : typeof value;
            types.add(type);
          }
        }
        fingerprint.dataTypes![key] = Array.from(types);
      }
      
      // Check for missing keys
      const keySet = new Set(fingerprint.topLevelKeys);
      for (const record of sample) {
        for (const key of fingerprint.topLevelKeys) {
          if (record && !(key in record)) {
            fingerprint.issues?.push(`Missing key '${key}' in some records`);
            break;
          }
        }
      }
    } else if (typeof parsedData === 'object') {
      // Single object
      fingerprint.topLevelKeys = Object.keys(parsedData);
      fingerprint.recordCount = 1;
    }
  } catch (e) {
    fingerprint.issues?.push('Failed to analyze schema');
  }
  
  return fingerprint;
}

/**
 * Build CSV schema fingerprint
 */
export function csvFingerprint(
  lines: string[],
  sampleSize: number = 10
): SchemaFingerprint {
  const fingerprint: SchemaFingerprint = {
    fileType: 'csv',
    columnHeaders: [],
    dataTypes: {},
    issues: [],
  };
  
  try {
    if (lines.length === 0) return fingerprint;
    
    // Parse header
    const headerLine = lines[0];
    fingerprint.columnHeaders = headerLine.split(',').map(h => h.trim());
    fingerprint.recordCount = lines.length - 1;
    
    // Sample data types
    const sample = lines.slice(1, Math.min(sampleSize + 1, lines.length));
    for (const header of fingerprint.columnHeaders) {
      fingerprint.dataTypes![header] = [];
    }
    
    for (const line of sample) {
      const values = line.split(',');
      for (let i = 0; i < fingerprint.columnHeaders.length; i++) {
        const value = values[i]?.trim() || '';
        let type = 'string';
        if (value === '') type = 'empty';
        else if (!isNaN(Number(value))) type = 'number';
        else if (value.toLowerCase() === 'true' || value.toLowerCase() === 'false') type = 'boolean';
        
        if (!fingerprint.dataTypes![fingerprint.columnHeaders[i]].includes(type)) {
          fingerprint.dataTypes![fingerprint.columnHeaders[i]].push(type);
        }
      }
    }
    
    // Check column count consistency
    for (const line of sample) {
      const colCount = line.split(',').length;
      if (colCount !== fingerprint.columnHeaders.length) {
        fingerprint.issues?.push(
          `Inconsistent column count: expected ${fingerprint.columnHeaders.length}, found ${colCount}`
        );
        break;
      }
    }
  } catch (e) {
    fingerprint.issues?.push('Failed to analyze CSV schema');
  }
  
  return fingerprint;
}

/**
 * Build XML schema fingerprint
 */
export function xmlFingerprint(content: string): SchemaFingerprint {
  const fingerprint: SchemaFingerprint = {
    fileType: 'xml',
    tagNames: [],
    issues: [],
  };
  
  try {
    const tagRegex = /<([a-zA-Z][a-zA-Z0-9:_-]*)/g;
    const tags = new Set<string>();
    let match;
    
    while ((match = tagRegex.exec(content)) !== null) {
      tags.add(match[1]);
    }
    
    fingerprint.tagNames = Array.from(tags);
  } catch (e) {
    fingerprint.issues?.push('Failed to analyze XML schema');
  }
  
  return fingerprint;
}

export default {
  jsonFingerprint,
  csvFingerprint,
  xmlFingerprint,
};
