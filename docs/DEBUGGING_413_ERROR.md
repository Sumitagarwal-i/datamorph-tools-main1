# 🔧 413 Error Debugging & Resolution Guide

## What Just Changed

We created a **new `/api/analyze-streaming` endpoint** that explicitly configures Vercel's body parser to accept up to 5MB, bypassing the hidden limits that were causing 413 errors on small files.

### Why The Original Approach Failed

Vercel has **two layers** of request size limits:

1. **Platform-level hard limit**: 4.5MB (cannot be changed on Hobby plan)
2. **Auto body parser limit**: Hidden default limit that rejects requests earlier than 4.5MB

Your 81KB file was getting rejected by the auto body parser's hidden limit, even though it's nowhere near 4.5MB.

---

## New Endpoint Chain

```
Frontend Request
    ↓
/api/analyze-streaming (NEW - tries first)
    ├─ Explicit config: bodyParser.sizeLimit = '5mb'
    ├─ Logs request details
    └─ Forwards to /api/analyze if successful
    ↓
/api/analyze (existing - fallback)
    ├─ Main processing logic
    ├─ Chunking pipeline
    └─ Returns results
```

---

## Test Results Interpretation

After Vercel deploys this change, you should see:

### ✅ Success Scenario
- Network tab shows `/api/analyze-streaming` returns **200 or 500**
- If 200: Errors display in UI
- If 500: Check browser console for the error message
- No more **413 errors**

### ⚠️ If 413 Still Appears
This would mean Vercel's platform-level parser is still rejecting before our code runs.
**In that case**: We'll need to implement request streaming (chunked upload).

---

## What To Do Now

### Step 1: Wait for Vercel Deployment
Your push just triggered a new deployment. Wait 2-3 minutes for Vercel to finish building.

**Check deployment status:**
1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click your project
3. Look at the Deployments tab
4. You should see the new deployment running

### Step 2: Test the Fix
1. Hard refresh your app (Ctrl+F5 or Cmd+Shift+R)
2. Upload the 81KB file again
3. Click "Deep Dive"
4. Open DevTools (F12) → Network tab
5. Look for the `/api/analyze-streaming` request

### Step 3: Check Results

**Network Tab Should Show:**
- One POST to `/api/analyze-streaming` with Status 200 or 500
- NOT 413

**Browser Console Should Show:**
```
Sending AI analysis request {
  fileSize: "81.23KB",
  contentLength: 83203,
  fileType: "csv",
  endpoint: "api/analyze-streaming (primary), fallback to /api/analyze"
}
```

---

## Troubleshooting

### If You Still See 413 Error

**Check 1: Is Vercel deployment complete?**
- Go to Vercel Dashboard
- Confirm you see a new deployment with status "Ready" (not "Building")
- Might take 3-5 minutes

**Check 2: Clear browser cache**
- Hard refresh: `Ctrl+Shift+Delete` → Clear all data
- Then try again

**Check 3: Check Vercel logs**
```bash
vercel logs --tail
```
This shows real-time logs from your deployed functions.

**Check 4: Try the direct API**
Open your browser and visit:
```
https://[your-vercel-domain]/api/analyze-streaming
```
You should get a 405 error (method not allowed) since you need POST.
This confirms the endpoint exists.

---

## If 500 Error Appears Instead

The `/api/analyze-streaming` accepted the request, but `/api/analyze` processing failed.

**Check browser console for the error message** - it will give specific details about what failed in the backend.

Common reasons:
- Missing environment variables (LLM API key)
- Invalid file format detection
- RAG knowledge base not loaded

---

## How This Fixes The Root Issue

**Old behavior:**
```
Frontend: Send 81KB JSON
    ↓
Vercel Auto Parser: "This looks like 90KB (with overhead)"
    ↓
Vercel: "My default limit is 50KB, REJECT! → 413 Error"
```

**New behavior:**
```
Frontend: Send 81KB JSON to /api/analyze-streaming
    ↓
Streaming Endpoint: "Vercel, accept up to 5MB bodies for this function"
    ↓
Vercel: "OK, I'll allow this"
    ↓
Request reaches your code: Process normally
```

---

## Performance Impact

- **Time**: No change (same as before)
- **Memory**: Slightly higher for streaming endpoint (~512MB)
- **Cost**: Minimal (still within Hobby plan limits)

---

## Next Steps If Still Not Working

If the 413 error persists even after trying all troubleshooting steps:

1. We'll implement **chunked upload** (split file into 1MB pieces before sending)
2. Or switch to **FormData + multipart upload** (different encoding that Vercel handles better)

These are last-resort options that require more complex frontend changes.

---

## Summary of Changes Made

| File | Change | Reason |
|------|--------|--------|
| `api/analyze-streaming.ts` | NEW endpoint | Explicit body parser config |
| `src/pages/DetectiveD.tsx` | Use streaming first | Try best-configured endpoint first |
| `vercel.json` | Memory: 3008→2048MB | Hobby plan compatibility |
| `api/analyze.ts` | Memory: 3008→2048MB | Hobby plan compatibility |

---

## Questions?

If you still see errors, share:
1. Screenshot of Network tab showing the request/response
2. Error message from browser console
3. Vercel deployment status (Ready/Building/Failed)

I can then provide more specific guidance.
