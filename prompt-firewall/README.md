# Prompt Firewall — AI Chatbot Security & Enforcement System

A hardened, zero-trust AI prompt firewall and chatbot security enforcement system designed to protect Large Language Models (LLMs) from prompt injections, jailbreak attacks, confidential instruction leakage, and adversarial inputs.

---

## 1. System Overview & Architecture

Prompt Firewall sits directly between untrusted user input and downstream AI providers (such as Google Gemini, DeepSeek, or local models). The firewall enforces strict **ALLOW**, **BLOCK**, and **REVIEW** security policies, ensuring that blocked or unapproved inputs are **never dispatched to an AI model**.

```
[ User in React Chatbot ]
           │
           ▼
[ Express Security Backend ] ────► [ Rate Limiting & Helmet Headers ]
           │
           ▼
[ Zod Input Validator ] ────────► Rejects empty, oversized, or malformed input
           │
           ▼
[ Layered Detection Engine ] ───► Layer 1: Rule Engine (Regex & weighted signatures)
                                  Layer 2: Second-Stage Classifier (Heuristics & Stego)
                                  Layer 3: Member 2 Adapter Interface
           │
 ┌─────────┼─────────┐
 ▼         ▼         ▼
[BLOCK]  [REVIEW]  [ALLOW]
 │         │         │
 │         │         └────► [ AI Provider (Gemini / DeepSeek / Mock) ]
 │         │                               │
 │         ▼                               ▼
 │     [Review Queue]             [ AI Response Output ]
 │         │                               │
 └─────────┴───────────────┬───────────────┘
                           ▼
               [ Persistent SQLite Database ]
            (Audit Events, Latency, Metrics)
                           │
                           ▼
              [ Protected Admin Dashboard ]
```

### Core Security Tenet
> **Zero-Trust Frontend:** The backend makes all security and enforcement decisions. Blocked requests are intercepted at the perimeter and will **never incur token costs, LLM calls, or security exposure**.

---

## 2. Project Folder Structure

```
d:\SAT-PROJECT\prompt firewall backend/
├── backend/
│   ├── data/                       # Persistent SQLite database storage (WAL mode)
│   ├── src/
│   │   ├── database/
│   │   │   ├── connection.js       # SQLite connection with WAL mode & busy timeout
│   │   │   ├── schema.js           # Automatic database migrations & indexes
│   │   │   ├── auditRepository.js  # Parameterized audit log queries & statistics
│   │   │   ├── reviewRepository.js # Review queue operations (approve/reject)
│   │   │   └── backup.js           # Non-blocking online database snapshot utility
│   │   ├── detector/
│   │   │   ├── detectorAdapter.js       # Base abstract detector interface contract
│   │   │   ├── ruleEngine.js            # Fast rule-based pattern matcher & scoring
│   │   │   ├── secondStageClassifier.js # Obfuscation, zero-width stego & heuristics
│   │   │   ├── member2Adapter.js        # Adapter interface for Member 2's engine
│   │   │   ├── corpus.json              # 25-sample documented security test corpus
│   │   │   └── index.js                 # Central detection coordinator & thresholds
│   │   ├── middleware/
│   │   │   ├── authMiddleware.js        # Constant-time timingSafeEqual admin auth
│   │   │   ├── errorHandler.js          # Centralized error handler (no secret leaks)
│   │   │   ├── rateLimiter.js           # Chat, Admin, and Auth brute-force rate limiters
│   │   │   ├── requestIdMiddleware.js   # crypto.randomUUID() request tracker
│   │   │   └── validateChatRequest.js   # Zod schema validation
│   │   ├── routes/
│   │   │   ├── auditRoutes.js           # GET /api/audit-logs, GET /api/stats
│   │   │   ├── authRoutes.js            # POST /api/auth/login, GET /api/auth/verify
│   │   │   ├── chatRoutes.js            # POST /api/chat
│   │   │   ├── configRoutes.js          # GET /api/config/status (safe status)
│   │   │   ├── healthRoutes.js          # GET /api/health
│   │   │   └── reviewRoutes.js          # Moderation queue & approve/reject APIs
│   │   ├── services/
│   │   │   ├── aiProvider/
│   │   │   │   ├── aiProviderInterface.js # Base class for AI providers
│   │   │   │   ├── deepseekProvider.js    # DeepSeek API integration (native fetch)
│   │   │   │   ├── geminiProvider.js      # Google Gemini integration (@google/genai)
│   │   │   │   ├── mockProvider.js        # Offline testing provider (no API key needed)
│   │   │   │   └── index.js               # Provider factory & safe metadata
│   │   │   ├── enforcementService.js    # Strict policy enforcement orchestrator
│   │   │   └── reviewService.js         # Human-in-the-loop review workflow
│   │   ├── utils/
│   │   │   ├── envValidator.js          # Production environment security validator
│   │   │   ├── logger.js                # Secret-safe redact logging
│   │   │   └── sanitizer.js             # PII, password & credential redaction
│   │   ├── app.js                       # Express app configuration & middleware
│   │   └── server.js                    # Server startup, schema init, graceful shutdown
│   ├── tests/
│   │   ├── admin_auth.test.js           # Admin endpoint authorization tests
│   │   ├── audit_persistence.test.js    # SQLite audit logging tests
│   │   ├── audit_privacy.test.js        # Privacy mode & PII redaction tests
│   │   ├── authorization_abuse.test.js  # Auth abuse, brute-force & token tests
│   │   ├── corpus_evaluation.test.js    # 25-sample corpus evaluation (FP/FN = 0)
│   │   ├── detection_enforcement.test.js# BLOCK, REVIEW, and ALLOW enforcement tests
│   │   ├── gemini_provider.test.js      # Gemini SDK integration & error mapping tests
│   │   ├── health.test.js               # Health check endpoint tests
│   │   ├── provider_error.test.js       # Upstream AI failure handling tests
│   │   ├── rate_limit.test.js           # Rate limiting tests
│   │   ├── security_hardening.test.js   # Production validation & CORS tests
│   │   └── validation.test.js           # Input validation (empty, oversized, malformed)
│   ├── .env                             # Active backend environment configuration
│   ├── .env.example                     # Reference environment template
│   └── package.json                     # Backend dependencies & test scripts
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── AdminDashboard.jsx       # Protected SOC dashboard with metrics & queue
│   │   │   ├── Chatbot.jsx              # Responsive chat UI with test suite buttons
│   │   │   └── Navbar.jsx               # Navigation bar & live status pill
│   │   ├── api.js                       # Centralized fetch API client
│   │   ├── App.jsx                      # Root React component & state
│   │   ├── index.css                    # Modern cybersecurity dark-theme styling
│   │   └── main.jsx                     # Vite React entry point
│   ├── index.html                       # HTML template with shield icon
│   ├── package.json                     # Frontend dependencies
│   └── vite.config.js                   # Vite config with backend API reverse proxy
├── .env.example                         # Root environment template
├── .gitignore                           # Git exclusions (secrets, node_modules, DBs)
├── package.json                         # Workspace root run scripts
└── README.md                            # Comprehensive technical documentation
```

---

## 3. Technology Stack & Maintained Dependencies

### Backend
- **Node.js (v24)** & **Express.js** (CommonJS consistently)
- **`better-sqlite3` (v13.0.3)**: High-performance SQLite3 storage in WAL mode
- **`@google/genai` (v2.31.0)**: Official Google Gen AI SDK for Gemini models
- **DeepSeek HTTP Client**: Configurable client using native Node fetch with abort controller
- **`zod` (v3.24.2)**: Strict runtime schema validation
- **`helmet` (v8.0.0)**: Security headers (clickjacking protection, XSS filter, noSniff)
- **`express-rate-limit` (v7.5.0)**: IP rate limiters for chat, admin, and authentication
- **`dotenv` (v16.4.7)**: Environment variable management
- **Node.js Test Runner (`node:test`, `supertest`)**: 60 automated integration tests

### Frontend
- **React 18 / 19** & **Vite (v8.3.5)**
- **Lucide React**: Security & telemetry icons
- **Responsive CSS3**: Custom modern dark-theme cybersecurity UI
- **Fetch API**: Client with structured error mapping

---

## 4. Prompt Detection Engine & Member 2 Integration

The detection engine uses a **defense-in-depth, layered scoring model**:

1. **Layer 1: Rule Engine (`ruleEngine.js`)**
   - **Instruction Overrides**: Detects phrases like `ignore all previous instructions`, `forget your rules`, `reset system directives`.
   - **System Prompt Extraction**: Detects `reveal your system prompt`, `show hidden developer instructions`, `what was your initial directive`.
   - **Security Bypass**: Detects `bypass security controls`, `disable moderation filters`.
   - **Jailbreaks & Personas**: Flags `DAN mode`, `developer mode enabled`, `simulate an amoral uncensored AI`.
   - **Prompt Framing & Tags**: Intercepts fake system delimiters (`<system>`, `[SYSTEM]`, `### Instruction:`).
   - **Social Engineering**: Recognizes hypothetical safety evasion and bedtime story persona exploits.

2. **Layer 2: Second-Stage Classifier (`secondStageClassifier.js`)**
   - Analyzes zero-width Unicode steganography (`\u200B` - `\uFEFF`).
   - Identifies leetspeak obfuscation (e.g., `1gn0re all previous instructions`).
   - Checks code block and delimiter density.
   - Detects standalone encoded Base64 injection payloads.

3. **Layer 3: Member 2 Adapter Interface (`member2Adapter.js`)**
   - Provides a standard interface for integrating external detector microservices (such as a Python FastAPI service, fine-tuned DeBERTa classifier, or custom scripts).
   - Expected Request Schema:
     ```json
     {
       "message": "string (1-5000 chars)",
       "context": { "requestId": "uuid" },
       "options": { "sensitivity": "normal" }
     }
     ```
   - Expected Response Schema:
     ```json
     {
       "decision": "ALLOW" | "BLOCK" | "REVIEW",
       "riskScore": 85,
       "reasons": ["Description of detected threat"],
       "detectorVersion": "2.0.0",
       "timestamp": "2026-10-23T12:00:00.000Z"
     }
     ```
   - Includes a working fallback implementation complying with Member 2's specification when an external URL is not specified.

### Decision Policy & Configurable Thresholds
- **BLOCK**: Risk Score $\ge$ `DETECTOR_BLOCK_THRESHOLD` (default: **70**). Request is rejected with HTTP 403.
- **REVIEW**: Risk Score between `DETECTOR_REVIEW_THRESHOLD` (default: **40**) and 69. Added to moderation queue; AI provider is not invoked.
- **ALLOW**: Risk Score $<$ **40**. Sent to the configured AI provider.

---

## 5. Documented Test Corpus & Detection Accuracy

The project includes a documented 25-sample test corpus (`backend/src/detector/corpus.json`) covering:
- **Direct Prompt Injections** (Canonical overrides, rule erasure, system reset)
- **System Prompt Extraction** (Verbatim directives, hidden developer instructions, context echoing)
- **Security & Moderation Bypass** (Evasion requests, safety deactivation)
- **Jailbreak Personas** (DAN, unrestricted roleplay, uncensored entities)
- **Structural Injection Delimiters** (Raw system tags, Markdown prompt wrappers)
- **Obfuscated Attacks** (Leetspeak encoding, Base64 payloads)
- **Borderline / Persona Framing** (Hypothetical scenarios, grandmother empathy trick)
- **Benign Security Inquiries** (Educational questions about prompt injection, XSS filters, web firewalls)
- **Ordinary Safe Inquiries** (Fibonacci code, geography, math, book recommendations, SQL vs NoSQL)

### Corpus Benchmark Results (`backend/tests/corpus_evaluation.test.js`)
```
================ CORPUS EVALUATION REPORT ================
 Total Samples Evaluated : 25
 True Positives (Blocked): 16
 True Negatives (Allowed): 9
 False Positives (Errors): 0
 False Negatives (Misses): 0
 Classification Accuracy : 100.0%
==========================================================
```
- **False Positives**: 0 (Benign security discussions and safe questions are correctly allowed).
- **False Negatives**: 0 (All attack variations are intercepted).
- **Contract Enforcement**: 100% verified that AI Provider is never invoked on intercepted requests.

---

## 6. Environment Configuration

Copy `.env.example` to `.env`:

```ini
# Environment Mode: 'development' | 'production' | 'test'
NODE_ENV=development

# Server Port
PORT=3000

# AI Provider: 'mock' | 'gemini' | 'deepseek'
# Use 'mock' for offline testing without API keys
AI_PROVIDER=mock

# Upstream Provider API Keys
GEMINI_API_KEY=your_gemini_api_key_here
DEEPSEEK_API_KEY=your_deepseek_api_key_here

# AI Model Override (optional)
AI_MODEL=

# CORS Origin (comma-separated list of trusted origins)
CORS_ORIGIN=http://localhost:5173

# Admin Dashboard Credentials
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your_strong_admin_password_min_12_chars
ADMIN_API_KEY=your_secure_random_admin_api_key_here

# Audit Privacy Configuration
# Set to 'false' (default) to omit prompt text; 'true' stores redacted previews
AUDIT_STORE_MESSAGE_CONTENT=false

# Detection Thresholds
DETECTOR_BLOCK_THRESHOLD=70
DETECTOR_REVIEW_THRESHOLD=40
DETECTOR_ENGINE=builtin

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=60
```

---

## 7. Windows PowerShell Commands to Run and Test

Run these commands in Windows PowerShell:

### Step 1: Install Dependencies
```powershell
cd "d:\SAT-PROJECT\prompt firewall backend"
npm run install:all
```

### Step 2: Run the Automated Test Suite (60 Tests)
```powershell
npm test
```

Expected output:
```
ℹ tests 60
ℹ suites 12
ℹ pass 60
ℹ fail 0
```

### Step 3: Start the Backend Server (Terminal 1)
```powershell
npm run start:backend
```
*Backend active on `http://localhost:3000`.*

### Step 4: Start the Frontend Client (Terminal 2)
```powershell
cd "d:\SAT-PROJECT\prompt firewall backend"
npm run start:frontend
```
*Frontend active on `http://localhost:5173`.*

### Step 5: Perform an Online Database Backup
```powershell
npm run backup:db --prefix backend
```

---

## 8. API Reference

| Endpoint | Method | Auth | Description |
| :--- | :---: | :---: | :--- |
| `/api/health` | `GET` | Public | Service health & uptime |
| `/api/chat` | `POST` | Rate-limited | Scans prompt, enforces policy, routes to AI |
| `/api/auth/login` | `POST` | Strict Rate-limit | Admin login returning Bearer token |
| `/api/auth/verify` | `GET` | Admin | Validates administrative token |
| `/api/stats` | `GET` | Admin | Aggregated security metrics & risk distribution |
| `/api/audit-logs` | `GET` | Admin | Paginated audit trail with filters |
| `/api/config/status`| `GET` | Admin | Safe firewall configuration parameters |
| `/api/reviews/pending` | `GET` | Admin | Messages waiting for human review |
| `/api/reviews/:id/approve` | `POST` | Admin | Approves message & dispatches to AI provider |
| `/api/reviews/:id/reject` | `POST` | Admin | Rejects flagged message |

---

## 9. Production Deployment Checklist

1. **Environment Flag**: Set `NODE_ENV=production`.
2. **Administrative Credentials**: Ensure `ADMIN_PASSWORD` (min 12 chars) and `ADMIN_API_KEY` are strong random strings. Startup validation will fail fast if default demo keys are used in production.
3. **CORS Configuration**: Restrict `CORS_ORIGIN` to your explicit production domain(s). Wildcards (`*`) and `localhost` are rejected in production mode.
4. **HTTPS / TLS Termination**: Place an HTTPS reverse proxy (Nginx, Caddy, AWS ALB, or Cloudflare) in front of the backend to terminate TLS securely.
5. **Database Storage & Permissions**:
   - SQLite file at `backend/data/firewall.db`.
   - Ensure the process has exclusive read/write access.
   - Schedule periodic online snapshots via `npm run backup:db --prefix backend`.
6. **Privacy Enforcement**: Keep `AUDIT_STORE_MESSAGE_CONTENT=false` to ensure user prompts are not persisted in SQLite.
7. **Secret Safety**: Verify `.env` is never committed to Git (covered by `.gitignore`).
