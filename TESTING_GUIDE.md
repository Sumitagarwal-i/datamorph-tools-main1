# Large File Chunking - Testing Guide

## Quick Test: Verify Chunking is Working

### 1. Frontend Testing (UI)

Open Detective D and try:

**Test Case 1: Nested JSON (Issue #1 - False Positives)**
```json
{
  "users": [
    {
      "id": 1,
      "name": "John",
      "address": {
        "street": "123 Main St",
        "city": "Springfield",
        "nested": {
          "more": "data"
        }
      }
    }
  ]
}
```
**Expected**: 
- ✅ No false "missing quotes" errors
- ✅ Proper nested structure recognized
- ✅ Any real errors highlighted correctly

**Test Case 2: Large JSON File (Issue #2 - Token Overflow)**
```json
{
  "records": [
    { "id": 1, "name": "User 1", "email": "user1@example.com", ... },
    { "id": 2, "name": "User 2", "email": "user2@example.com", ... },
    // ... many more records (1000+)
  ]
}
```
**Expected**:
- ✅ File uploads successfully (up to 5MB)
- ✅ Deep Dive button appears for files <500KB
- ✅ Analysis completes without "token limit exceeded"
- ✅ Errors properly detected and deduplicated

**Test Case 3: Local Error Grouping (Issue #3)**
```csv
name,age,email
John,30,john@example.com
Jane,25jane@example.com
Bob,28bob@example.com
```
**Expected**:
- ✅ Missing comma on line 3 detected
- ✅ Missing comma on line 4 detected
- ✅ Similar errors grouped together
- ✅ Shows "2 similar errors grouped as 1"

### 2. Backend Testing (API)

#### Test Chunking with Small File (Should use whole file):
```bash
curl -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "content": "{\"name\": \"test\"}",
    "file_type": "json",
    "file_name": "test.json"
  }'
```
**Expected Response**:
- ✅ `errors` array with any detected errors
- ✅ No truncation/chunking mentioned
- ✅ `summary.analysis_time_ms` < 100ms

#### Test Chunking with Large File:
```bash
# Generate 1MB JSON file with intentional error on line 500
cat > test_large.json << 'EOF'
{
  "data": [
EOF

for i in {1..10000}; do
  echo "    {\"id\": $i, \"value\": \"test$i\"}," >> test_large.json
done

# Add a syntax error in middle
sed -i '500s/}//' test_large.json

# Add closing bracket
echo "  ]}" >> test_large.json

# Send to API
curl -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" \
  -d @- << 'CURL'
{
  "content": "$(cat test_large.json | jq -Rs .)",
  "file_type": "json"
}
CURL
```

**Expected Response**:
- ✅ `errors` array with detected syntax error
- ✅ Line number correctly mapped back to original file
- ✅ Response time < 2 seconds (parallel processing)
- ✅ No "token limit exceeded" errors

#### Verify Chunking Happened:
Look for these indicators in logs:
```
Built chunk list for analysis
  chunks_count: 5  ← Multiple chunks processed
  chunk_types: "error_window(...), head(...), tail(...), sample(...), sample(...)"

All chunks analyzed successfully
  chunks_analyzed: 5
  total_errors: 3  ← Combined from all chunks

Analysis completed successfully
  provider: "groq"
  model: "mixtral-8b-7b-instruct"
```

### 3. Deduplication Testing

Create a file where same error appears in multiple chunks:

```json
{
  "records": [
    { "id": 1, "data": "value1" missing_closing_brace,
    { "id": 2, "data": "value2" },
    ... (many records) ...
    { "id": 500, "data": "value500" missing_closing_brace,
    ... (many more records) ...
  ]
}
```

**Expected**:
- ✅ Error detected in chunk 1 (error window around line with error)
- ✅ Same error NOT detected in chunk 2 (head/tail)
- ✅ Final response shows 1 error (not 2)
- ✅ Error sources show: `sources: ["chunk_1"]` (or multiple if truly separate)

### 4. Integration Test Scenarios

#### Scenario A: Small CSV File (No Chunking)
```csv
name,age,city
John,30,NYC
Jane,25,LA
```
**Flow**:
1. Validate file size ✅
2. Run prechecks (Papa Parse) ✅
3. Build chunks (1 chunk = full file)
4. Send to LLM for analysis ✅
5. Return results ✅

**Expected**: `chunks_count: 1`

#### Scenario B: 1MB CSV File (With Chunking)
```csv
(Header + 50,000 rows)
```
**Flow**:
1. Validate file size ✅
2. Run prechecks (Pa Parse, error if syntax error found) ✅
3. Build chunks (5 chunks):
   - Error windows (if any errors found)
   - Head (first 2000 chars)
   - Tail (last 2000 chars)
   - 2 middle samples
4. Analyze in parallel ✅
5. Aggregate & deduplicate ✅
6. Return results ✅

**Expected**: `chunks_count: 5`, latency < 2s

#### Scenario C: Invalid Nested JSON (Test False Positive Fix)
```json
{
  "user": {
    "profile": {
      "name": "John Doe",
      "email": "john@example.com",
      "address": {
        "street": "123 Main",
        "city": "NYC",
        "zip": 10001
      }
    }
  }
}
```
**Expected**:
- ✅ JSON parses successfully (no local errors)
- ✅ AI analysis: 0 errors (valid JSON)
- ✅ No "missing quotes on values" errors
- ✅ Nested objects properly recognized

#### Scenario D: Cached Results
1. Send file A to API ✅
2. Wait for analysis to complete
3. Send exact same file A again
4. API returns from cache (100ms response time)

**Expected headers**:
```
X-Cache-Status: HIT
X-Response-Time: 150ms  ← Much faster
```

### 5. Edge Case Testing

#### Empty File
```
(empty)
```
**Expected**: Error response "content cannot be empty"

#### File at 5MB limit
**Expected**: Upload succeeds, chunking applied if needed

#### File at 5MB + 1 byte
**Expected**: Upload rejected with 413 error

#### File with only spaces/newlines
**Expected**: Error "content cannot be empty"

#### Binary file (image, PDF)
**Expected**: Analysis attempts, likely fails gracefully or detects as unsupported

### 6. Performance Benchmarks

**Target Performance**:
- Small file (< 100KB): < 500ms
- Medium file (100KB-500KB): < 1000ms
- Large file (500KB-5MB): < 3000ms (with parallel chunking)

**To Measure**:
```bash
time curl -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" \
  -d @large_file.json
```

Look for response header:
```
X-Response-Time: 1234ms
```

### 7. Logging Verification

Enable debug logs to verify chunking process:

```
[INFO] Built chunk list for analysis
{
  "chunks_count": 5,
  "chunk_types": [
    "error_window(100-130)",
    "head(1-50)",
    "tail(9950-10000)",
    "sample(3000-3100)",
    "sample(6000-6100)"
  ]
}

[INFO] All chunks analyzed successfully
{
  "chunks_analyzed": 5,
  "total_errors": 8,
  "chunk_errors": {
    "error_window": 6,
    "head": 1,
    "tail": 1
  }
}

[INFO] Errors aggregated and deduplicated
{
  "original_count": 12,
  "after_deduplication": 8,
  "merged_groups": 4
}
```

## Checklist Before Deployment

- [ ] All TypeScript files compile without errors
- [ ] Chunk extraction properly handles all file types (JSON, CSV, XML, YAML)
- [ ] Error window extraction works for various error patterns
- [ ] Line number mapping is accurate (chunk line → original file line)
- [ ] Deduplication merges similar errors across chunks
- [ ] Parallel chunk processing completes without race conditions
- [ ] Fallback to precheck errors works if chunking fails
- [ ] Cache invalidation works correctly
- [ ] Response times are acceptable (< 3s for 5MB file)
- [ ] No token limit exceeded errors for large files
- [ ] Local validation error grouping works consistently
- [ ] Nested JSON false positives are fixed

## Rollback Plan

If issues arise, rollback is simple:

1. **Disable Chunking**: Comment out chunking logic in `analyze.ts`, uncomment truncation
2. **Revert Imports**: Remove chunkProcessor/errorAggregator imports
3. **Use Old Flow**: Falls back to simple truncation + single LLM call

Old `truncateContent()` function still exists in code for fallback.

---

**Ready to test!** 🚀
