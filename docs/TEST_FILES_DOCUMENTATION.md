# Test Files Documentation

## Overview
Two comprehensive test files have been created to validate Detective D's error detection capabilities across all implemented modules.

## test-all-errors.json

### Record-by-Record Error Analysis

**Record 1-2: Clean Data (Control)**
- Valid baseline records with correct data types and values
- Purpose: Establish normal patterns for comparison

**Record 3: Type Inconsistency (String in Numeric Field)**
```json
"age": "twenty-five"
```
- **Expected Detection**: Schema deviation - string value in numeric field
- **Module**: Module 4 (Schema Deviation Detector)
- **Severity**: Warning

**Record 4: Type Mismatch (String ID)**
```json
"id": "FOUR"
```
- **Expected Detection**: Type inconsistency - ID field should be numeric
- **Module**: Module 4 (Schema Deviation Detector)
- **Severity**: Warning

**Record 5: Multiple Errors**
```json
"age": -5,                    // Negative age (impossible value)
"salary": 999999,             // Extreme outlier (Z-score > 4)
"status": "unknown",          // Unexpected enum value
"hire_date": "2030-01-01",   // Implausible future date
"end_date": "2018-12-31"     // End date before hire date (logic error)
```
- **Expected Detections**:
  - Negative value in age field (Module 6 - Outlier Detector)
  - Statistical outlier in salary (Module 6)
  - Unexpected enum value "unknown" (Module 4)
  - Implausible date (>5 years future) (Module 6)
  - Logical inconsistency: end_date < hire_date (Module 7)
- **Severity**: Multiple warnings and errors

**Record 6: Date and Type Errors**
```json
"id": 5,                           // Duplicate ID (same as record 5)
"salary": "sixty-five thousand",   // String in numeric field
"hire_date": "1850-01-01"         // Implausible date (pre-1900)
```
- **Expected Detections**:
  - Duplicate ID violation (Module 7 - Logical Consistency Checker)
  - Type mismatch in salary field (Module 4)
  - Implausible date before 1900 (Module 6)
- **Severity**: Error (duplicate ID), warnings (others)

**Record 7: Null and Empty Values**
```json
"age": null,
"salary": 0,           // Zero in non-zero-inflated field
"email": "",           // Empty string in important field
"hire_date": "",       // Empty date
"end_date": null
```
- **Expected Detections**:
  - Excessive null values (Module 3 - Schema Inference)
  - Empty strings in required fields (Module 2 semantic checks)
  - Zero inflation pattern (Module 6)
- **Severity**: Info/Warning

**Record 8: Extreme Outliers and Logic Errors**
```json
"age": 150,                  // Extreme outlier (Z-score > 4)
"salary": -50000,            // Negative salary (impossible)
"hire_date": "2022-05-20",
"end_date": "2022-05-19"     // End date before hire date
```
- **Expected Detections**:
  - Extreme age outlier (Module 6)
  - Negative value in positive-only field (Module 6)
  - Logical inconsistency in dates (Module 7)
- **Severity**: Error/Warning

**Record 9-10: Clean Data**
- Valid records for statistical baseline
- Help establish normal distribution patterns

---

## test-all-errors.csv

### Record-by-Record Error Analysis

**Header Row + Records 1-2: Clean Data**
- Valid CSV structure and baseline data

**Record 3: Type Inconsistency**
```csv
3,Bob Johnson,twenty-five,58000,...
```
- **Expected Detection**: String value in numeric age column
- **Module**: Module 4 (Schema Deviation Detector)

**Record 4: ID Type Mismatch**
```csv
FOUR,Alice Williams,29,60000,...
```
- **Expected Detection**: String ID in numeric ID column
- **Module**: Module 4

**Record 5: Multiple Errors**
```csv
5,Charlie Brown,-5,999999,charlie@example.com,unknown,2030-01-01,2018-12-31
```
- Same errors as JSON Record 5 (negative age, outlier salary, unexpected enum, future date, end before start)

**Record 6: Duplicate ID and Type Errors**
```csv
5,David Lee,35,sixty-five thousand,...
```
- Duplicate ID: 5 (same as record 5)
- String value in salary column
- Pre-1900 date (1850-01-01)

**Record 7: Missing Values**
```csv
7,Emma Wilson,,0,,pending,,
```
- Empty age field
- Zero salary
- Empty email
- Empty dates
- **Expected Detection**: Missing critical values, empty fields

**Record 8: Outliers and Logic Errors**
```csv
8,Frank Miller,150,-50000,...,2022-05-20,2022-05-19
```
- Extreme age (150)
- Negative salary
- End date before hire date

**Record 9: CSV Column Count Mismatch**
```csv
9,Grace Davis,30,57000,grace@example.com
```
- **Expected Detection**: Missing columns (only 5 columns instead of 8)
- **Module**: Module 2 (Structure Validator)
- **Severity**: Error
- **Category**: Structure

**Record 10: Clean Data**
```csv
10,Henry Martinez,27,54000,...
```
- Valid baseline record

---

## Error Categories Covered

### Module 2: Structure Validator ✓
- CSV column count mismatch (Record 9 in CSV)
- Empty fields and missing values (Record 7)

### Module 4: Schema Deviation Detector ✓
- Type mismatches (Records 3, 4, 6)
- String values in numeric fields (Records 3, 4, 6)
- Unexpected enum values (Record 5)

### Module 6: Outlier Detector ✓
- Extreme outliers with Z-score > 4 (Records 5, 8)
- Negative values in positive-only fields (Records 5, 8)
- Implausible dates (pre-1900, >5 years future) (Records 5, 6)
- Zero inflation patterns (Record 7)

### Module 7: Logical Consistency Checker ✓
- Duplicate IDs (Record 6)
- Start date > end date violations (Records 5, 8)
- Missing required field values (Record 7)

---

## Testing Instructions

1. **Upload test-all-errors.json to Detective D**
   - Click "Analyze Data"
   - Verify errors are detected for records 3-8
   - Check line numbers match the actual record locations in the file
   - Confirm no false positives for records 1, 2, 9, 10

2. **Upload test-all-errors.csv to Detective D**
   - Click "Analyze Data"
   - Verify structure error for record 9 (column mismatch)
   - Confirm all semantic errors from JSON are also detected in CSV
   - Validate CSV line numbers are accurate

3. **Switch Between Files**
   - Upload both files
   - Switch tabs between them
   - Verify errors persist and don't cross-contaminate
   - Confirm each file's errors remain isolated

4. **Line Number Validation**
   - Click on each error in the error panel
   - Verify the editor jumps to the correct line
   - For JSON: First record should be around line 2, not line 7
   - For CSV: First data row should be line 2 (after header)

---

## Expected Error Count Summary

### JSON File
- **Structure errors**: 0 (valid JSON syntax)
- **Schema errors**: ~8-10 (type mismatches, unexpected enums)
- **Anomaly errors**: ~6-8 (outliers, implausible dates, negatives)
- **Logic errors**: ~3-4 (duplicate IDs, date contradictions)
- **Total**: ~17-22 errors

### CSV File
- **Structure errors**: 1 (column count mismatch on record 9)
- **Schema errors**: ~8-10 (same as JSON)
- **Anomaly errors**: ~6-8 (same as JSON)
- **Logic errors**: ~3-4 (same as JSON)
- **Total**: ~18-23 errors

---

## Notes

- Line numbers should now be accurate after the fix to `calculateJsonLineNumber()`
- Error panel has been simplified (removed colored banners, confidence display, "Copy Fix" button)
- Errors are now isolated per file using `fileErrorsRef` and `fileStructureIssuesRef` Maps
- Both test files contain the same logical errors in different formats for consistency testing
