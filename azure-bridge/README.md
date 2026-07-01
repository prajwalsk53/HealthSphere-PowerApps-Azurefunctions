# HealthSphere Azure Functions Bridge

This folder is a **standalone Azure Functions app** that exists for one reason: a Power Apps Code App runs entirely in the browser and can never hold a secret (API key, SMTP password, Stripe secret key). Anything that needs a secret, or a server-side capability the browser doesn't have, is implemented here as a small HTTP-triggered function and called from the React app over `fetch`/`axios`.

It is **not** a general backend — it never talks to Dataverse, has no auth/session logic of its own, and has no database beyond the one Blob container it manages for file uploads. It only receives JSON/form-data and returns JSON.

This document is the complete, step-by-step record of how it was built and deployed.

---

## 1. Why a separate Functions app (and not Power Automate / a plugin)

| Option considered | Why it was rejected |
|---|---|
| Power Automate Cloud Flow | Too slow for synchronous request/response calls (AI chat, payment intents need sub-second round trips), and clunky for binary file uploads. |
| Dataverse Plugin (C#) | Plugins run *inside* Dataverse transactions — wrong place for calling 3rd-party HTTP APIs (Gemini, Stripe, Spoonacular) which have nothing to do with Dataverse data. |
| Azure Functions HTTP trigger | Free Consumption tier, deploys independently of the Code App, scales to zero, and is just plain Node.js — the same mental model as any REST API. **Chosen.** |

---

## 2. Local project setup

```bash
mkdir azure-bridge && cd azure-bridge
npm init -y
npm install @azure/functions @azure/storage-blob axios nodemailer stripe adm-zip
```

`package.json` ended up as:

```json
{
  "name": "healthsphere-bridge",
  "version": "1.0.0",
  "private": true,
  "main": "src/functions/*.js",
  "scripts": { "start": "func start" },
  "dependencies": {
    "@azure/functions": "^4.5.0",
    "@azure/storage-blob": "^12.24.0",
    "adm-zip": "^0.5.10",
    "axios": "^1.6.0",
    "nodemailer": "^6.9.0",
    "stripe": "^14.0.0"
  }
}
```

`@azure/functions` v4 uses the **new programming model**: no `function.json` bindings file per function — everything (route, method, auth level, handler) is declared in code via `app.http(name, options)`. That's why `main` is a glob (`src/functions/*.js`) instead of a single entry point: every file that calls `app.http(...)` self-registers when required.

### `host.json` — the Functions host config

```json
{
  "version": "2.0",
  "logging": {
    "applicationInsights": { "samplingSettings": { "isEnabled": true, "excludedTypes": "Request" } }
  },
  "extensionBundle": {
    "id": "Microsoft.Azure.Functions.ExtensionBundle",
    "version": "[4.*, 5.0.0)"
  }
}
```

### `local.settings.json` — local-only secrets (never committed)

```json
{
  "IsEncrypted": false,
  "Values": {
    "AzureWebJobsStorage": "UseDevelopmentStorage=true",
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "SMTP_HOST": "smtp.gmail.com",
    "SMTP_PORT": "587",
    "SMTP_USER": "",
    "SMTP_PASS": "",
    "EMAIL_FROM": "",
    "MAIL_ADMIN": "",
    "CLIENT_URL": "http://localhost:3000",
    "GEMINI_API_KEY": "",
    "GEMINI_MODEL": "gemini-2.0-flash",
    "SPOONACULAR_API_KEY": "",
    "GOOGLE_DRIVE_API_KEY": "",
    "GOOGLE_DRIVE_TAKEOUT_FOLDER_ID": "",
    "STRIPE_SECRET_KEY": "",
    "DOCUMENTS_CONTAINER": "documents"
  },
  "Host": { "CORS": "*" }
}
```

`local.settings.json` is git-ignored (`.gitignore` lists it explicitly) — every value above has to be re-entered as an **Application Setting** in the deployed Function App (step 6), since this file never leaves the local machine.

`.funcignore` keeps `.git*`, `.vscode`, `local.settings.json`, `test`, and `README.md` out of the deployment package:

```
*.git*
.vscode
local.settings.json
test
.gitignore
README.md
```

---

## 3. Folder structure

```
azure-bridge/
├── host.json
├── local.settings.json      (gitignored)
├── package.json
└── src/
    ├── functions/             # one file per HTTP route, each self-registers via app.http(...)
    │   ├── aiChat.js
    │   ├── aiFoodSearch.js
    │   ├── aiNhsMedicine.js
    │   ├── diseasesNlmSearch.js
    │   ├── documentsDelete.js
    │   ├── documentsUpload.js
    │   ├── emailConfig.js
    │   ├── emailSend.js
    │   ├── foodDatabaseSearch.js
    │   ├── paymentIntent.js
    │   ├── wearableSync.js
    │   └── dataverseLabResultWebhook.js  # receives a true Dataverse webhook (not called by the frontend)
    └── lib/                   # shared helpers imported by the functions above
        ├── aiAssistant.js      # Gemini prompt builder + FDA context fetch + rule-based fallback
        ├── mailer.js           # nodemailer transport factory
        └── dataverseClient.js  # service-principal OAuth client for calling back into Dataverse
```

Every function follows the same shape — register a route, do the work, return `{ status, jsonBody }`, never throw past the handler boundary:

```js
const { app } = require('@azure/functions');

app.http('functionName', {
  methods: ['GET' | 'POST' | 'DELETE'],
  authLevel: 'anonymous',
  route: 'bridge/...',
  handler: async (request) => {
    try {
      // ...
      return { status: 200, jsonBody: { /* ... */ } };
    } catch (err) {
      return { status: 500, jsonBody: { error: err.message } };
    }
  },
});
```

`authLevel: 'anonymous'` is used everywhere because the real auth boundary is the user's Microsoft Entra session inside the Power Apps player — the bridge is a stateless utility layer, not a protected resource of its own.

### Route map

| Function | Method | Route | Purpose |
|---|---|---|---|
| `aiChat` | POST | `bridge/ai/chat` | Gemini chat with patient context, FDA drug lookup injection, rule-based fallback |
| `aiFoodSearch` | GET | `bridge/ai/food-search` | Spoonacular ingredient search with nutrition data |
| `aiNhsMedicine` | GET | `bridge/ai/nhs-medicine` | NHS medicine info lookup |
| `diseasesNlmSearch` | GET | `bridge/diseases/nlm-search` | NCBI/NLM genetic disease search |
| `documentsUpload` | POST | `bridge/documents/upload` | Multipart upload → Azure Blob Storage |
| `documentsDelete` | DELETE | `bridge/documents/upload/{filename}` | Deletes a blob by name |
| `emailConfig` | GET | `bridge/email/config` | Reports whether SMTP is configured |
| `emailSend` | POST | `bridge/email/send` | Sends transactional email via Nodemailer |
| `foodDatabaseSearch` | GET | `bridge/food-database/search-api` | Admin-side food database search/import |
| `paymentIntent` | POST | `bridge/prescriptions/payment-intent` | Creates a Stripe PaymentIntent |
| `wearableSync` | POST | `bridge/wearable/sync` | Downloads/parses a Google Takeout health-data export |
| `dataverseLabResultWebhook` | POST | `bridge/webhooks/lab-result-critical` | **Called by Dataverse itself**, not the frontend — see below |

All routes are prefixed with `bridge/` deliberately, so the Function App's base URL plus `/api/bridge/...` reads as "the bridge, doing X" from the frontend code.

`dataverseLabResultWebhook` is the one exception to "called from the React app" — it's a true **Dataverse webhook**, registered via the Plugin Registration Tool to fire automatically whenever a lab result row is saved with a critical status, regardless of which client wrote it. Full setup (Azure AD App Registration, Application User, Plugin Registration Tool steps) is documented separately in **[docs/DATAVERSE-WEBHOOK.md](docs/DATAVERSE-WEBHOOK.md)**.

---

## 4. Implementing each capability

### 4.1 File uploads → Azure Blob Storage (`documentsUpload.js` / `documentsDelete.js`)

```js
const { BlobServiceClient } = require('@azure/storage-blob');

async function getContainerClient() {
  const serviceClient = BlobServiceClient.fromConnectionString(process.env.AzureWebJobsStorage);
  const containerClient = serviceClient.getContainerClient(process.env.DOCUMENTS_CONTAINER || 'documents');
  await containerClient.createIfNotExists({ access: 'blob' });
  return containerClient;
}
```

- Reuses `AzureWebJobsStorage` (the storage account the Function App already needs for its own runtime state) instead of provisioning a second storage account.
- `request.formData()` (native to the v4 programming model) extracts the uploaded file directly — no extra multipart-parsing library needed.
- The blob name is timestamp-prefixed (`${Date.now()}-${file.name}`) to avoid collisions, and the **full public blob URL** (`blockBlobClient.url`) is returned to the caller, which is what gets stored back in Dataverse — not just the bare filename. (A real bug here: an earlier version stored only the filename and reconstructed a broken URL pointing at the Function App's own domain, which has no static file route on Consumption hosting — fixed by returning/storing `fileUrl` directly.)
- `access: 'blob'` requires **"Allow Blob anonymous access"** to be enabled on the Storage Account (Configuration blade) — without it, every upload fails with *"Public access is not permitted on this storage account."*

### 4.2 AI chat with graceful degradation (`aiChat.js` + `lib/aiAssistant.js`)

- Builds a system prompt from the patient's real context (medications, allergies, latest vitals, assigned GP name).
- If the user's message mentions one of their own medications, fetches live drug-label data from `api.fda.gov` and injects it into the prompt before calling Gemini — grounding answers in real data instead of letting the model guess.
- Calls Gemini (`generativelanguage.googleapis.com`) with the API key from an environment variable, never from the frontend.
- **Critical fallback design**: if `GEMINI_API_KEY` is missing, expired, or the call otherwise fails, the function does not return an error to the user — it falls back to a rule-based response engine (`getRuleBasedResponse`) so the assistant is never fully down. The actual failure reason is still surfaced in the response body (`geminiError`) for debugging, just not shown as a hard error in the UI.

### 4.3 Nutrition/food search (`aiFoodSearch.js`, `foodDatabaseSearch.js`)

- Calls Spoonacular's ingredient search, then for each result makes a second call to the ingredient-information endpoint to pull real `calories/protein/carbs/fat/fiber` per 100g — the search endpoint alone doesn't return nutrition, so a naive single-call implementation silently returns nutrition-less rows that the frontend then filters out as invalid.
- Uses `Promise.allSettled` so one failed nutrition lookup doesn't fail the whole search.

### 4.4 Payments (`paymentIntent.js`)

- Server-side Stripe secret key creates a `PaymentIntent`; only the resulting `client_secret` goes back to the browser, which is the only thing Stripe's client-side Elements library needs to collect card details and confirm payment. The secret key itself never reaches the client.

### 4.5 Email (`emailSend.js`, `emailConfig.js`, `lib/mailer.js`)

- `lib/mailer.js` builds a single reusable Nodemailer transport from `SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASS`.
- `emailConfig` is a cheap GET the frontend can call first to check `{ configured: true/false }` before attempting a real send, so the UI can show a clear "email not configured" state instead of a generic failure.

### 4.6 Wearable sync (`wearableSync.js`)

- Downloads a Google Takeout export (a `.zip` of health data) from a shared Drive folder via the Google Drive API, unpacks it in-memory with `adm-zip`, and parses the relevant CSV/JSON files into health metric records — avoiding the need for a real OAuth wearable integration for a portfolio/demo build.

---

## 5. Connecting the frontend

The React app never hardcodes the bridge's hostname — it reads it from Vite env config:

```bash
# .env (frontend root)
VITE_API_URL=https://<your-function-app>.azurewebsites.net/api
```

Every bridge call in the frontend is a plain `fetch`/`axios` call to `` `${import.meta.env.VITE_API_URL}/bridge/...` `` — there is no SDK, no generated client, just REST.

---

## 6. Local testing

```bash
cd azure-bridge
npm install
func start
```

This starts the Azure Functions Core Tools runtime locally (default `http://localhost:7071/api/...`), reading secrets from `local.settings.json`. Point the frontend's `VITE_API_URL` at `http://localhost:7071/api` to test end-to-end before deploying.

> Note: `func`/`az` CLI was not available in this project's environment — all of the steps below were done through the **Azure Functions extension for VS Code** instead of the CLI.

---

## 7. Deploying to Azure

### 7.1 Create the Function App (one-time, via Azure Portal or VS Code extension)

1. Resource: **Function App** → Runtime stack: **Node.js**, Version **20 LTS**, OS: **Linux**, Plan: **Consumption (Serverless)**.
2. A Storage Account is auto-provisioned alongside it (or pick an existing one) — this becomes the value of `AzureWebJobsStorage` and is also reused for the Documents blob container (section 4.1).
3. Enable **Application Insights** for logging (already wired up via `host.json`'s `applicationInsights` sampling config).

### 7.2 Deploy the code (VS Code Azure Functions extension)

1. Open `azure-bridge/` as its **own standalone VS Code workspace root** — opening it as a subfolder of the main Power Apps project causes the extension to zip the wrong directory tree and deploy a broken/nested package.
2. Install the **Azure Functions** extension (and sign in to the Azure account).
3. Azure panel → Function App → right-click your Function App → **Deploy to Function App...** → confirm overwrite.
4. The extension reads `.funcignore` to exclude `local.settings.json`, `.vscode`, and git/test files from the deployment zip.

### 7.3 Configure Application Settings (the real secrets)

In the Function App → **Configuration** → **Application settings**, add every key that was in `local.settings.json` (except `AzureWebJobsStorage`, which Azure manages itself once the app is created against a real storage account):

```
FUNCTIONS_WORKER_RUNTIME=node
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=
EMAIL_FROM=
MAIL_ADMIN=
CLIENT_URL=
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.0-flash
SPOONACULAR_API_KEY=
GOOGLE_DRIVE_API_KEY=
GOOGLE_DRIVE_TAKEOUT_FOLDER_ID=
STRIPE_SECRET_KEY=
DOCUMENTS_CONTAINER=documents
```

Save → the Function App restarts automatically to pick up new settings.

### 7.4 Enable Blob anonymous access (for document upload/view)

Storage account → **Configuration** → **Allow Blob anonymous access** → **Enabled** → **Save**. Without this, `containerClient.createIfNotExists({ access: 'blob' })` fails at runtime with *"Public access is not permitted on this storage account."*

### 7.5 Configure CORS

Function App → **CORS** → **Allowed Origins**: add `*` only, **by itself**. Azure's CORS implementation does not support mixing `*` with specific origins (e.g. leaving `https://portal.azure.com` from the default list alongside `*`) — combining them silently breaks every preflight request with *"No 'Access-Control-Allow-Origin' header is present."* Remove every other entry so `*` is the only one.

### 7.6 Point the Power Apps Code App's CSP at the bridge domain

Because Power Apps Code Apps enforce a strict Content-Security-Policy, the bridge's own domain has to be explicitly allowlisted in the Power Platform admin center (Environment → Settings → Privacy + Security → Content security policy → `connect-src`), otherwise the browser blocks every call to it before it even leaves the page — with no JavaScript-visible error, only a console CSP violation.

---

## 8. Verifying the deployment

```bash
curl https://<your-function-app>.azurewebsites.net/api/bridge/email/config
```

A `200` with `{ "configured": false }` (before settings are filled in) confirms the deployment, routing, and CORS are all working — only the missing secret values remain to be filled in via section 7.3.

---

## 9. Debugging in production

- **Application Insights → Logs**: query `traces`/`requests` tables for any function by name.
- Every handler returns its real error message in `jsonBody.error` (or `geminiError` for the AI route) rather than swallowing it — when the frontend reports a feature "silently doing nothing," the fix is almost always to read the actual HTTP response body (via browser DevTools Network tab, or a HAR export) rather than guessing, since these functions are written to always explain *why* a fallback path was taken.
