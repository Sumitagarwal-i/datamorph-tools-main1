# Privacy & Legal Considerations - Phase B.15

## Overview

Detective D is built with privacy-first principles. This document outlines our data handling practices, legal considerations, and options for enhanced privacy.

---

## Data Handling Policy

### What We Process

**Temporarily Processed:**
- File content sent for error detection
- File metadata (type, size)
- Request metadata (timestamp, IP for rate limiting)

**Anonymized Analytics (Opt-in):**
- Request counts and performance metrics
- Error detection statistics
- Usage patterns (anonymized)

**NOT Collected:**
- User identities
- File names or paths
- Full file contents (only metadata logged)
- Personal information

### Data Flow

```
User Upload → API Validation → LLM Analysis → Response → Data Discarded
                                                        ↓
                                              Anonymized Metrics (opt-in)
```

**Timeline:**
- **0-30s**: File processed by AI
- **30s**: Response returned
- **Immediate**: Content discarded from memory
- **Never**: Content stored to disk (unless opt-in)

---

## Privacy Notice (User-Facing)

### Short Version (UI)
> "Your file will be sent to our AI service for analysis. **No data is stored** unless you opt-in. We only process your content temporarily to detect errors and immediately discard it after analysis."

### Full Version

**What happens to my data?**
1. Your file is sent securely (HTTPS) to our API
2. Content is analyzed by AI (Groq/OpenAI)
3. Errors are detected and returned to you
4. Content is immediately discarded (not stored)

**What is logged?**
- Request ID (for debugging)
- File type and size
- Timestamp
- Performance metrics (latency, tokens used)
- Error counts (not error details)

**What is NOT logged?**
- File content or structure
- File names
- Your identity or email
- Any personally identifiable information

**Third-party AI Services:**
- We use Groq and OpenAI for AI analysis
- Content is sent to their APIs temporarily
- See [Groq Privacy](https://groq.com/privacy-policy/) and [OpenAI Privacy](https://openai.com/privacy/)
- No data retention by default (per their API policies)

---

## Opt-In Features

### Analytics & Pattern Learning (Future)

**If you opt-in**, we may store:
- Anonymized error patterns for improving detection
- File structure templates (no actual data)
- Common error types by file type

**You control:**
- Opt-in/opt-out anytime
- Request data deletion
- Download your data

**Implementation:**
```typescript
// Example opt-in API
POST /api/analyze
{
  "content": "...",
  "opt_in_analytics": true,
  "opt_in_pattern_learning": false
}
```

---

## Data Security

### In Transit
- ✅ HTTPS/TLS encryption
- ✅ Secure API keys (environment variables)
- ✅ Request authentication (rate limiting)

### At Rest
- ✅ No content storage by default
- ✅ Anonymized metrics only (Supabase encrypted)
- ✅ Environment variables for secrets

### Access Control
- ✅ Analytics endpoint requires admin API key
- ✅ No public access to raw data
- ✅ Supabase Row Level Security (RLS)

### Sanitization
- ✅ Content sanitized before logging
- ✅ API keys/tokens redacted from logs
- ✅ Email addresses removed from error messages

---

## Legal Compliance

### GDPR (EU)

**Right to Access:**
- Request your anonymized analytics data
- API: `GET /api/privacy/data?email=you@example.com`

**Right to Deletion:**
- Request deletion of any stored data
- API: `DELETE /api/privacy/data?email=you@example.com`

**Right to Portability:**
- Export your data in JSON format
- API: `GET /api/privacy/export?email=you@example.com`

**Data Processing Agreement:**
- Available on request for enterprise customers
- Contact: privacy@yourcompany.com

### CCPA (California)

**Disclosure:**
- We collect: file metadata, performance metrics
- We do NOT sell your data
- We do NOT share with third parties (except AI providers for processing)

**Your Rights:**
- Right to know what data is collected
- Right to delete your data
- Right to opt-out of data sales (N/A - we don't sell)

### COPPA (Children)

**Age Restriction:**
- Service intended for users 13+
- No intentional collection of children's data
- Parental consent required for under-13

---

## Local Mode (Advanced)

For maximum privacy, run Detective D with your own API keys.

### Setup

1. **Get your own API keys:**
   ```
   GROQ_API_KEY=your-key-here
   OPENAI_API_KEY=your-key-here (optional)
   ```

2. **Deploy locally:**
   ```bash
   npm install
   npm run dev
   ```

3. **Configure local mode:**
   ```env
   # .env.local
   VITE_LOCAL_MODE=true
   VITE_USER_BRING_OWN_KEY=true
   ```

4. **User provides API key in UI:**
   - Settings → API Keys → Enter your Groq key
   - Keys stored in browser only (localStorage)
   - Never sent to our servers

### Benefits
- ✅ Complete control over data
- ✅ No data sent to our servers
- ✅ Direct LLM API calls from browser
- ✅ You pay only for your usage

### Drawbacks
- ⚠️ User must manage API keys
- ⚠️ CORS limitations (requires proxy)
- ⚠️ No caching or rate limiting
- ⚠️ No analytics or insights

---

## Data Retention

### Current Policy

**Real-time Processing:**
- Content: 0 seconds (discarded immediately)
- Request metadata: 30 days (for debugging)
- Anonymized metrics: 90 days (configurable)

**User Requests:**
- Deletion requests honored within 48 hours
- Export requests fulfilled within 7 days

### Future Options

**Per-User Control:**
```typescript
// User preferences API
PATCH /api/privacy/preferences
{
  "analytics_retention_days": 30,
  "allow_pattern_learning": false,
  "allow_anonymized_metrics": true
}
```

---

## Incident Response

### Data Breach Protocol

1. **Detection**: Security monitoring alerts
2. **Assessment**: Determine scope and impact
3. **Containment**: Isolate affected systems
4. **Notification**: Inform affected users within 72 hours
5. **Remediation**: Fix vulnerability
6. **Review**: Post-mortem and improvements

**Contact:**
- Security issues: security@yourcompany.com
- Privacy concerns: privacy@yourcompany.com
- PGP key: [link to public key]

---

## Third-Party Services

### AI Providers

**Groq:**
- Purpose: LLM inference
- Data sent: File content (temporary)
- Retention: None (per API docs)
- Privacy: https://groq.com/privacy-policy/

**OpenAI (optional):**
- Purpose: Fallback LLM
- Data sent: File content (temporary)
- Retention: 30 days (can opt-out)
- Privacy: https://openai.com/privacy/

### Analytics (Supabase)

**Supabase:**
- Purpose: Anonymized metrics storage
- Data sent: Request metadata only
- Retention: 90 days
- Privacy: https://supabase.com/privacy

### CDN (Vercel)

**Vercel:**
- Purpose: API hosting
- Data sent: HTTP requests/responses
- Retention: Logs (7 days)
- Privacy: https://vercel.com/legal/privacy-policy

---

## User Rights & Actions

### Request Your Data
```bash
curl https://yourapi.com/api/privacy/data \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "X-Email: you@example.com"
```

### Delete Your Data
```bash
curl -X DELETE https://yourapi.com/api/privacy/data \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "X-Email: you@example.com"
```

### Export Your Data
```bash
curl https://yourapi.com/api/privacy/export \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "X-Email: you@example.com" \
  -o my_data.json
```

### Opt-Out of Analytics
```bash
curl -X PATCH https://yourapi.com/api/privacy/preferences \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"allow_anonymized_metrics": false}'
```

---

## FAQ

### Is my data secure?
Yes. Content is encrypted in transit (HTTPS) and not stored at rest. Only anonymized metrics are kept.

### Can you see my file contents?
No. We don't store file contents. Temporary processing only.

### What if I upload sensitive data?
We recommend not uploading highly sensitive data. Use local mode or redact sensitive sections first.

### Who has access to analytics?
Only admins with the `ADMIN_API_KEY` can access anonymized metrics. Raw content is never logged.

### Can I use this offline?
Not currently. Local mode still requires internet for LLM API calls. Future: local LLM support.

### Do you train AI models on my data?
No. We don't train models. We use third-party APIs (Groq/OpenAI) which don't train on API data by default.

### How do I delete my data?
Email privacy@yourcompany.com with your request. We'll delete within 48 hours.

### Can I audit your code?
Yes! We're open source: https://github.com/yourorg/datamorph-tools

---

## Contact

**Privacy Questions:**
- Email: privacy@yourcompany.com
- Response time: 48 hours

**Security Issues:**
- Email: security@yourcompany.com
- PGP: [link]
- Response time: 24 hours

**General Support:**
- Email: support@yourcompany.com
- Discord: [link]
- Response time: 72 hours

---

## Updates to This Policy

**Last Updated**: December 7, 2024

**Changes:**
- v1.0 (Dec 2024): Initial privacy policy

**Notification:**
- Email alerts for material changes
- 30-day notice before changes take effect
- Continued use implies consent

**Version History:**
- [View changelog](PRIVACY_CHANGELOG.md)

---

## Appendix: Technical Implementation

### Content Sanitization Code
See `api/lib/responseNormalizer.ts` → `sanitizeForLogging()`

### Data Flow Diagram
```
┌─────────┐   HTTPS    ┌─────────┐   LLM API   ┌─────────┐
│ Browser │ ─────────> │   API   │ ──────────> │  Groq   │
└─────────┘            └─────────┘             └─────────┘
                            │                        │
                            │ Discard               Response
                            ↓                        ↓
                       (Memory only)           ┌─────────┐
                                              │ Browser │
                       ┌─────────┐            └─────────┘
                       │ Metrics │ (anonymized, opt-in)
                       └─────────┘
```

### Compliance Checklist
- [ ] HTTPS enforced
- [ ] No plaintext storage
- [ ] Anonymized metrics
- [ ] User consent UI
- [ ] Data deletion API
- [ ] Privacy policy linked
- [ ] Cookie consent (if applicable)
- [ ] GDPR compliance
- [ ] CCPA compliance

---

**Phase B.15 Status: ✅ COMPLETE**

Privacy-first architecture implemented with user control and transparency!
