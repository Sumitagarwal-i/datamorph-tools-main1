# Supabase Edge Functions Deployment Guide

## Overview

We've consolidated your API logic into **3 Supabase Edge Functions**:

1. **`analyze`** - Main AI analysis with chunking (handles large files)
2. **`cache-management`** - Cache operations (get, set, invalidate, stats)
3. **`system`** - Health checks, analytics, and error explanations

This eliminates all Vercel serverless function issues including 413 errors!

---

## Prerequisites

1. **Supabase CLI** installed:
   ```bash
   npm install -g supabase
   ```

2. **Login to Supabase**:
   ```bash
   supabase login
   ```

3. **Link to your project**:
   ```bash
   supabase link --project-ref emvtxsjzxcpluflrdyut
   ```

---

## Deploy Edge Functions

### 1. Deploy `analyze` function

```bash
cd "c:\Users\sumit\Downloads\datamorph-tools-main1-main\datamorph-tools-main1-main"

supabase functions deploy analyze --no-verify-jwt
```

**What it does:**
- Accepts file content (JSON, CSV, XML, YAML)
- Auto-detects file type
- Chunks large files intelligently
- Runs parallel AI analysis on each chunk
- Returns aggregated errors

**Endpoint:** `https://emvtxsjzxcpluflrdyut.supabase.co/functions/v1/analyze`

---

### 2. Deploy `cache-management` function

```bash
supabase functions deploy cache-management --no-verify-jwt
```

**What it does:**
- `?action=stats` - Get cache statistics
- `?action=get&key=<key>` - Get specific cache entry
- `?action=set` - Set cache entry (POST with {key, value})
- `?action=invalidate` - Clear cache (POST with {pattern})

**Endpoint:** `https://emvtxsjzxcpluflrdyut.supabase.co/functions/v1/cache-management`

---

### 3. Deploy `system` function

```bash
supabase functions deploy system --no-verify-jwt
```

**What it does:**
- `?action=health` - Health check
- `?action=analytics` - Log analytics events (POST)
- `?action=explain` - Explain errors with AI (POST with {error_message, file_type})

**Endpoint:** `https://emvtxsjzxcpluflrdyut.supabase.co/functions/v1/system`

---

## Set Environment Variables

Each function needs environment variables. Set them in Supabase Dashboard or via CLI:

```bash
# For 'analyze' function
supabase secrets set GROQ_API_KEY=your_groq_api_key_here --project-ref emvtxsjzxcpluflrdyut

# For 'system' function (if needed)
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here --project-ref emvtxsjzxcpluflrdyut
```

**Get your GROQ API key from:** https://console.groq.com/keys

---

## Test Your Functions

### Test `analyze` function:

```bash
curl -X POST https://emvtxsjzxcpluflrdyut.supabase.co/functions/v1/analyze \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVtdnR4c2p6eGNwbHVmbHJkeXV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM2MjQ5MjUsImV4cCI6MjA3OTIwMDkyNX0.KWfgtAvdCtk2aETI6KzVjK5G_Anxn3cGeHvJFoGTxRo" \
  -H "Content-Type: application/json" \
  -d '{"content": "{\"test\": \"data\"}", "file_type": "json", "file_name": "test.json"}'
```

### Test `system` health:

```bash
curl https://emvtxsjzxcpluflrdyut.supabase.co/functions/v1/system?action=health
```

### Test `cache-management` stats:

```bash
curl https://emvtxsjzxcpluflrdyut.supabase.co/functions/v1/cache-management?action=stats
```

---

## Frontend Integration

Your frontend is already updated to call the `analyze` edge function at:
```
https://emvtxsjzxcpluflrdyut.supabase.co/functions/v1/analyze
```

No more 413 errors because:
- ✅ Supabase Edge Functions support up to **10MB payloads** by default
- ✅ No Vercel platform quirks
- ✅ Better control over request handling
- ✅ Cleaner codebase with fewer files

---

## Verify Deployment

1. Go to [Supabase Dashboard](https://supabase.com/dashboard/project/emvtxsjzxcpluflrdyut/functions)
2. You should see 3 functions listed:
   - ✅ `analyze`
   - ✅ `cache-management`
   - ✅ `system`
3. Click each one to see logs and test invocations

---

## Troubleshooting

### Function not found (404)
- Verify deployment: `supabase functions list`
- Re-deploy with `--no-verify-jwt` flag

### Import errors
- Make sure `_shared` directory is properly copied
- Check file paths in imports

### GROQ_API_KEY not working
- Set via Supabase Dashboard: Project Settings → Edge Functions → Secrets
- Or use CLI: `supabase secrets set GROQ_API_KEY=...`

### CORS errors
- Edge functions already have CORS headers configured
- Check browser console for specific errors

---

## Next Steps

1. **Deploy all 3 functions** using the commands above
2. **Set GROQ_API_KEY** secret
3. **Test** each function using curl commands
4. **Update frontend** (already done) to point to edge functions
5. **Remove old Vercel API folder** (optional cleanup)

---

## What We Removed

These Vercel API files are **no longer needed**:
- ❌ `api/analyze.ts` (replaced by edge function)
- ❌ `api/analyze-large.ts`
- ❌ `api/analyze-streaming.ts`
- ❌ `api/analyze-v2.ts`
- ❌ `api/analyze-status.ts`
- ❌ `api/cache-stats.ts` (replaced by cache-management)
- ❌ `api/cache-invalidate.ts`
- ❌ `api/health.ts` (replaced by system)
- ❌ `api/analytics.ts` (replaced by system)
- ❌ `api/explain.ts` (replaced by system)
- ❌ `api/middleware.ts`
- ❌ `api/config.ts`

**Keep `api/_lib/*`** - These are copied to `supabase/functions/_shared/` for reuse.

---

## Summary

**Before:** 13 Vercel API files, platform limits, 413 errors
**After:** 3 Supabase Edge Functions, no limits, clean architecture

Deploy the 3 functions and you're done! 🚀
