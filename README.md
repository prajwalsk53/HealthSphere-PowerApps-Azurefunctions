# HealthSphere — NHS Healthcare Platform

A full-featured, multi-role NHS healthcare platform built as a **Power Apps Code App**, backed by **Microsoft Dataverse** and a custom **Azure Functions** bridge for secret-bearing integrations (AI, email, payments, file storage). Originally an Express/Prisma/PostgreSQL application, fully re-architected onto the Power Platform.

> 🔗 **Live app:** runs inside the Power Apps player (Microsoft Entra-authenticated environment)
>  **Architecture:** React SPA (Code App) → Dataverse (data) + Azure Functions (secrets/3rd-party APIs)

---

## Why this project is interesting

This isn't a CRUD demo — it's a real migration of a 5-role, 40+ page healthcare application from a traditional Node/Postgres stack onto Microsoft's low-code data platform, while keeping a 100% custom React frontend. That migration surfaced (and required solving) problems that don't show up in tutorials:

- **Dataverse as the only datastore, with zero server of your own** — every CRUD operation goes directly from the browser to Dataverse via the platform's typed `@microsoft/power-apps/data` client. No custom backend for normal app data.
- **A minimal Azure Functions "bridge"** for the handful of operations that genuinely need a secret or a server (SMTP, Gemini AI, Stripe, Spoonacular, file storage) — designed so the bridge knows nothing about Dataverse internals; it just accepts/returns plain JSON.
- **Power Apps Code App Content-Security-Policy enforcement** — Microsoft began strictly enforcing `connect-src`/`script-src`/`style-src`/`font-src`/`img-src` for code apps, which silently blocks *any* unlisted external call (fonts, map tiles, AI APIs, payment iframes) with no error thrown in code — only a browser console violation. Diagnosing and allowlisting this was a recurring theme of the build.
- **Client-side-only architecture decisions**: gamification engine, health-score calculator, OpenFDA drug lookup, NHS condition lookup, and OpenStreetMap facility search all run entirely in the browser — no server round-trip needed.
- **Dataverse lookup-field quirks**: writing a lookup needs `"hs_Field@odata.bind": "/hs_table(guid)"`, reading it back needs `_hs_field_value`, and several tables carry typo'd schema columns (e.g. `hs_ilename` instead of `hs_filename`) preserved from the original Copilot-generated schema.

---

## Architecture

```
┌─────────────────────────┐
│   React 19 SPA (Vite)   │   Power Apps Code App
│  src/pages, src/lib      │   (deployed via `pac code push`)
└─────────┬───────┬────────┘
          │       │
          │       └──────────────────────────────┐
          ▼                                       ▼
┌──────────────────────┐                ┌──────────────────────────┐
│  Microsoft Dataverse  │                │   Azure Functions bridge  │
│  (32 generated tables)│                │   (Node.js v4 model)      │
│  via typed Hs_*Service│                │   azure-bridge/           │
│  clients (auto-gen)   │                │                           │
└──────────────────────┘                │ • Gemini AI chat          │
                                          │ • SMTP email              │
                                          │ • Stripe payments         │
                                          │ • Spoonacular food search  │
                                          │ • Azure Blob doc storage   │
                                          │ • Google Drive wearable    │
                                          │   sync (Takeout CSV)       │
                                          └──────────────────────────┘
```

**Everything else** (OpenFDA drug lookup, Wikipedia/NHS condition lookup, OpenStreetMap facility search, gamification scoring, health analytics) runs as **pure client-side libraries** in `src/lib/` — no backend involved.

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend framework | React 19, React Router 6, Vite 7 |
| Platform | Power Apps Code Apps (`@microsoft/power-apps`), Power Platform CLI (`pac`) |
| Data | Microsoft Dataverse (32 tables), typed auto-generated service/model clients |
| Bridge/serverless | Azure Functions v4 (Node.js, programming-model v4, Consumption plan) |
| File storage | Azure Blob Storage |
| AI | Google Gemini API (with a rule-based fallback engine if unavailable) |
| Payments | Stripe (Elements + PaymentIntents) |
| Email | Nodemailer (SMTP) |
| Maps | Leaflet + OpenStreetMap + marker clustering + heatmap |
| Charts | Chart.js / react-chartjs-2 |
| Calendar | FullCalendar |
| External data | OpenFDA, Wikipedia/NHS condition data, Spoonacular, NCBI |

---

## Roles & features

The app serves **five distinct roles**, each with its own dashboard and permission scope:

### 🧑‍⚕️ Patient
Dashboard with gamified health score · Appointments (booking + calendar view) · Medical Records · Prescriptions · Diet Tracker (with live food search) · Safe Appetite (ingredient/allergy scanner) · Wearable Sync (Google Fit/Takeout import) · Health Insights & Analysis · Documents (secure upload/view) · Messages · **AI Health Assistant** (Gemini-powered, with patient context + FDA drug lookup + NHS condition lookup) · Find a Clinic (live NHS facility map) · Health Questionnaire · Notifications · Profile

### 👨‍⚕️ Doctor
Dashboard (priority patient queue, risk scoring, today's schedule) · Appointments · Patients (with clinical notes) · Prescriptions & Prescription Orders · Lab Results · Schedule/availability management · Alerts · Messages · Profile

### 💊 Medical Team / Pharmacy
Dashboard · Medicine Queue (prescription fulfillment workflow) · Profile

### 🛡️ Admin
Dashboard · Users · Doctors · Approvals · Food Database (with online search/import) · Diseases (genetic disease reference, NLM-backed) · Access Logs · Analytics · Settings · Test Email utility

### 🏛️ Government / Public Health
Dashboard · Regional health trend map (choropleth + heatmap) · Analytics · Trends · Reports · Alerts

---

## The Azure Functions bridge

A deliberately thin Node.js Azure Functions app (`azure-bridge/`) that exists *only* because these operations need a secret the browser can't hold, or a server-side capability the browser doesn't have:

| Function | Purpose |
|---|---|
| `aiChat` | Gemini AI chat with patient-context system prompt + automatic FDA drug context injection; falls back to a rich rule-based response engine if Gemini is unavailable |
| `aiFoodSearch` / `foodDatabaseSearch` | Spoonacular ingredient search with full nutrition lookup |
| `aiNhsMedicine` | NHS medicine information lookup |
| `diseasesNlmSearch` | NCBI/NLM genetic disease reference search |
| `documentsUpload` / `documentsDelete` | Multipart file upload to Azure Blob Storage, public blob URL generation |
| `emailConfig` / `emailSend` | SMTP email sending via Nodemailer |
| `paymentIntent` | Stripe PaymentIntent creation for prescription payments |
| `wearableSync` | Downloads & parses Google Takeout health-data ZIPs from a shared Drive folder |
| `dataverseLabResultWebhook` | **True Dataverse Webhook** — called by Dataverse itself (not the frontend) via the plugin pipeline when a lab result is saved with Critical status; resolves the patient's email via S2S Dataverse Web API call and sends `mailCriticalLabResult` automatically |

All routes are unauthenticated at the HTTP layer (matching the original Stripe-route precedent) since the real auth boundary is the user's Microsoft Entra session inside the Power Apps player — the bridge never touches Dataverse directly; it only receives/returns plain JSON context.

> The webhook endpoint is the exception — it is called by **Dataverse itself**, registered via the Plugin Registration Tool as a Service Endpoint step on `hs_medicalrecord` (Create + Update). It authenticates using a shared secret header (`x-webhook-key`) and calls back into Dataverse using an **Azure AD Application User** (client credentials / S2S OAuth) to resolve patient details. Full setup guide: [azure-bridge/docs/DATAVERSE-WEBHOOK.md](azure-bridge/docs/DATAVERSE-WEBHOOK.md)

📄 **[Full Azure Functions implementation guide](azure-bridge/README.md)** — step-by-step build/deploy log covering project setup, the route map, why each function is built the way it is, and the full Azure deployment process.

---

## Project structure

```
Healthsphere/
├── src/
│   ├── pages/
│   │   ├── patient/        # 16 pages
│   │   ├── doctor/          # 10 pages
│   │   ├── admin/           # 10 pages
│   │   ├── government/      # 7 pages
│   │   └── medical-team/    # 3 pages
│   ├── lib/                 # client-side engines (gamification, health analytics,
│   │                         #   drug lookup, NHS lookup, OSM search, messaging)
│   ├── generated/            # auto-generated Dataverse models + typed service clients
│   ├── components/           # shared components (FamilyTree, etc.)
│   └── context/              # AuthContext
├── azure-bridge/             # standalone Azure Functions app (deployed separately)
│   └── src/
│       ├── functions/        # one file per HTTP-triggered function
│       └── lib/               # mailer, AI assistant prompt/fallback engine
├── .power/                   # Power Platform Code App schema/config
└── power.config.json         # Code App manifest (`pac code push` reads this)
```

---

## Local development

```bash
# Frontend (Power Apps Code App)
npm install
npm run dev          # local Vite dev server
npm run build        # production build → dist/
pac code push        # deploy to the Power Apps environment

# Azure Functions bridge (separate deploy, own workspace root)
cd azure-bridge
npm install
func start            # local Functions runtime
# Deploy via VS Code Azure Functions extension → Deploy to Function App
```

### Required environment variables

**Frontend (`.env`):**
```
VITE_STRIPE_PUBLISHABLE_KEY=pk_...
VITE_API_URL=https://<your-function-app>.azurewebsites.net/api
```

**Azure Function App (Application settings):**
```
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.0-flash
SPOONACULAR_API_KEY=
STRIPE_SECRET_KEY=
SMTP_HOST= / SMTP_USER= / SMTP_PASS=
GOOGLE_DRIVE_API_KEY= / GOOGLE_DRIVE_TAKEOUT_FOLDER_ID=
AzureWebJobsStorage=<storage account connection string>
DOCUMENTS_CONTAINER=documents
```

### Power Apps Code App CSP allowlist

Because Power Apps Code Apps enforce a strict Content-Security-Policy, the following external origins must be allowlisted at the environment level (Power Platform admin center → Environment → Settings → Privacy + Security → Content security policy):

| Directive | Required additions |
|---|---|
| `connect-src` | your Azure Function App domain, `api.fda.gov`, `en.wikipedia.org` |
| `script-src` / `style-src` | `js.stripe.com`, `cdnjs.cloudflare.com` (FontAwesome), `fonts.googleapis.com` |
| `font-src` | `cdnjs.cloudflare.com`, `fonts.gstatic.com` |
| `frame-src` | `js.stripe.com`, `hooks.stripe.com` |
| `img-src` | `*.tile.openstreetmap.org` |

---

## Key engineering decisions

- **No custom auth backend** — Dataverse access rides on the signed-in Power Platform user's own Microsoft Entra session; an in-app login screen (`Login.jsx`) provides demo-account role switching for evaluation purposes.
- **Typed data access everywhere** — every Dataverse table has a generated `Hs_<table>Model.ts` + `Hs_<table>Service.ts`, so all CRUD calls are type-checked against the live schema.
- **Graceful AI degradation** — if the Gemini API key is missing/expired/rate-limited, `aiChat` transparently falls back to a comprehensive rule-based medical-guidance engine instead of failing, so the assistant is never fully "down."
- **One-off idempotent demo-data seeding** (`/dev-seed` route) — populates a freshly-provisioned Dataverse environment with realistic demo accounts, appointments, prescriptions, and health metrics; safe to re-run.
- **True Dataverse Webhook (not Power Automate)** — a `dataverseLabResultWebhook` Azure Function is registered in the Dataverse plugin execution pipeline via the Plugin Registration Tool as a Service Endpoint step. It fires synchronously/asynchronously on `hs_medicalrecord` Create/Update when `hs_status = Critical`, guaranteed regardless of which client wrote the row. The Function authenticates back into Dataverse via an **Azure AD App Registration + Application User** (S2S client credentials OAuth) to resolve the patient's email — the standard Dynamics 365 server-to-server integration pattern.
- **C# Dataverse Plugin for prescription safety** — `PrescriptionAllergyCheck` is a signed .NET Framework 4.6.2 class library implementing `IPlugin`, registered via the Plugin Registration Tool on `hs_prescription` Create at the **Pre-validation stage (synchronous)**. It queries the patient's full allergy list and throws `InvalidPluginExecutionException` to block and roll back the save if the medication name matches a known allergen (case-insensitive, partial match). This runs inside Dataverse's transaction — no client-side workaround can bypass it. The `IOperationResult` pattern used by the Power Apps data SDK means plugin errors are returned as structured results rather than thrown, requiring explicit `result.success` checks in the frontend.

---

## License

This project is provided as a portfolio/demonstration piece.
