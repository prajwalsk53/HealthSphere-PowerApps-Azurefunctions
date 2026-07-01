# True Dataverse Webhook — Critical Lab Result Alert

Everything else in this bridge is **pulled** by the React app: the frontend decides when to call `/bridge/...`. This feature flips that — Dataverse itself **pushes** an event to the bridge the instant a row changes, with no frontend involved at all. It's registered through the **Plugin Registration Tool**, not Power Automate, and it runs as part of Dataverse's own plugin execution pipeline.

**Trigger:** a row in `hs_medicalrecords` (a lab result) is created or updated with `hs_status = Critical`.
**Effect:** the bridge resolves the patient's email via the Dataverse Web API and sends the (already-written but never-wired-up) `mailCriticalLabResult` email template from `lib/mailer.js` — automatically, regardless of which client wrote the row (the doctor's browser, an admin import, anything).

This is meaningfully different from the rest of the bridge in one more way: the bridge now calls **into** Dataverse (to look up the patient's email), not just out to third parties. That requires its own, non-interactive identity — a **Service Principal / Application User** — which is the standard Dynamics 365 pattern for server-to-server integrations.

---

## Architecture

```
Doctor saves a lab result (hs_status = Critical)
        │
        ▼
Dataverse plugin pipeline (Post-operation, on Update/Create of hs_medicalrecord)
        │  registered Webhook step → HTTP POST with security key header
        ▼
Azure Function: dataverseLabResultWebhook  (bridge/webhooks/lab-result-critical)
        │  1. validates x-webhook-key header
        │  2. reads PostEntityImage → hs_status, _hs_patient_value, hs_testtype, hs_result
        │  3. if status == Critical: calls back into Dataverse Web API
        │       (OAuth client-credentials, as an Application User — NOT the doctor's session)
        │       GET hs_users(<patientId>)?$select=hs_emailaddress,hs_fullname
        │  4. sends mailer.mailCriticalLabResult(...)
        ▼
Patient receives an email — no one had to remember to trigger it
```

---

## Part A — Azure AD App Registration (the bridge's own identity in Dataverse)

The Code App authenticates as *whichever user is signed in*. This webhook runs with no user present at all, so it needs its own identity: an **Azure AD App Registration** registered in Dataverse as a non-interactive **Application User**. This is the same mechanism every real Dynamics 365 integration (Azure Data Factory migrations, external systems, etc.) uses.

1. **Entra ID** (portal.azure.com) → **App registrations** → **New registration**.
   - Name: `healthsphere-bridge-s2s`
   - Supported account types: *Accounts in this organizational directory only*
   - No redirect URI needed (this is a client-credentials/daemon app, not interactive)
2. After creation, note down from the **Overview** page:
   - **Application (client) ID** → `DATAVERSE_CLIENT_ID`
   - **Directory (tenant) ID** → `DATAVERSE_TENANT_ID`
3. **Certificates & secrets** → **New client secret** → copy the value immediately (shown once) → `DATAVERSE_CLIENT_SECRET`.
4. No API permissions need to be added here — Dataverse authorizes by *security role*, assigned in Part B, not by Azure AD API permissions.

## Part B — Register it as an Application User in the Dataverse environment

1. **Power Platform admin center** → select your environment → **Settings** → **Users + permissions** → **Application users** → **+ New app user**.
2. **Add an app** → search for `healthsphere-bridge-s2s` (the registration from Part A) → select it.
3. **Business unit**: leave default.
4. **Security roles**: assign a role with at minimum **Read** privilege on the `hs_users` table (the built-in `Reader` minimal-privilege custom role pattern, or create a small custom security role scoped to just this table — don't grant System Administrator to a server-to-server credential you don't have to).
5. Save. This app registration can now authenticate against this environment's Web API using `client_credentials`, with no human login involved.
6. From the environment's **Details** page, copy the **Environment URL** (e.g. `https://orgXXXXXXXX.crm11.dynamics.com`) → `DATAVERSE_RESOURCE`.

## Part C — Add the new settings to the Function App

Locally, in `local.settings.json` (already scaffolded, fill in real values for local testing):

```json
"DATAVERSE_WEBHOOK_KEY": "<any long random string you generate>",
"DATAVERSE_TENANT_ID": "<from Part A>",
"DATAVERSE_CLIENT_ID": "<from Part A>",
"DATAVERSE_CLIENT_SECRET": "<from Part A>",
"DATAVERSE_RESOURCE": "<from Part B, e.g. https://orgXXXXXXXX.crm11.dynamics.com>"
```

Then add the same five keys as **Application Settings** on the deployed Function App (Configuration blade), exactly as done for every other secret in the main [azure-bridge README](../README.md#73-configure-application-settings-the-real-secrets). Redeploy/restart after saving.

`DATAVERSE_WEBHOOK_KEY` is a value **you invent** — it's the shared secret Dataverse will send back on every webhook call so the Function can reject anyone else hitting this URL. Generate something long and random (e.g. `openssl rand -hex 32`), don't reuse another app's key.

## Part D — Install and connect the Plugin Registration Tool

The Plugin Registration Tool (PRT) is a separate desktop tool — it is not part of `pac` CLI and isn't installed yet in this project.

1. Install via NuGet command line (requires the .NET SDK) or download the standalone build:
   ```
   nuget install Microsoft.CrmSdk.XrmTooling.PluginRegistrationTool
   ```
   Or, simpler: install the **XrmToolBox** (`https://www.xrmtoolbox.com/`) and add the **Plugin Registration** plugin from its built-in tool store — this avoids the NuGet/CLI route entirely and is the more common path today.
2. Launch the tool → **Create New Connection** → sign in with the same Microsoft account/credentials you use for this Dataverse environment → select the HealthSphere environment.

## Part E — Register the Webhook (Service Endpoint)

1. In PRT: **Register** → **Register New Webhook**.
2. **Name**: `HealthSphere - Critical Lab Result`
3. **Endpoint URL**: `https://<your-function-app>.azurewebsites.net/api/bridge/webhooks/lab-result-critical`
4. **Authentication**: choose **HttpHeader**
   - **Key**: `x-webhook-key`
   - **Value**: the same string you put in `DATAVERSE_WEBHOOK_KEY`
5. Save. This creates a `ServiceEndpoint` record in Dataverse — it doesn't do anything by itself yet until a step is registered against it.

> A more secure alternative the tool also supports is **WebhookKey (HMAC)**, which signs the request body instead of just attaching a static header — Dataverse computes an HMAC-SHA256 signature over the payload using your secret and sends it in `ms-crm-webhook-authorization`; your function would verify the signature rather than compare a plain string. Static header key is used here because it's simpler to learn the registration flow first; HMAC verification is a natural next step once this works end-to-end.

## Part F — Register the Step (what triggers it)

1. In PRT, with the Webhook selected: **Register New Step**.
2. **Message**: `Update` (add a second step for `Create` if you want new critical results caught immediately too, not just edits).
3. **Primary Entity**: `hs_medicalrecord` (logical name of the Medical Records / lab results table).
4. **Event Pipeline Stage of Execution**: `Post-operation` (the row must already be committed before you read it).
5. **Execution Mode**: this is the decision the whole exercise is about.
   - **Synchronous** — Dataverse holds the doctor's save request open until your Function responds. Lower latency end-to-end, but a slow SMTP server or network hiccup now makes *saving a lab result* feel slow, and a timeout can roll back the save entirely.
   - **Asynchronous** — Dataverse queues it as a System Job and fires it in the background; the doctor's save returns immediately regardless of how long the email takes.
   - **Recommendation**: register **Synchronous** once, just to feel the blocking behavior directly (add an artificial `await new Promise(r => setTimeout(r, 3000))` in the function temporarily and watch the doctor's save visibly hang for 3 seconds) — then switch this specific step to **Asynchronous**, since a notification email is exactly the kind of side-effect that should never block or risk rolling back a clinical save. Reserve Synchronous for validation logic where you need the result before the transaction commits (e.g. blocking the save if something is invalid) — not for "and also send an email."
6. **Filtering Attributes**: tick `hs_status` — this makes the step fire *only* when `hs_status` is part of the changed field set, so editing unrelated fields (notes, file path) doesn't trigger it on every save.
7. **Images** tab → **Add Image**: Image Type = `Post Image`, Alias = `PostImage`, Attributes = `hs_status, hs_patient, hs_testtype, hs_result` (must match what `extractPostImageAttributes` in the function reads). Save.

## Part G — Capture the real payload shape (do this before trusting the parser)

Dataverse serializes the plugin's `RemoteExecutionContext` to JSON in a way that varies slightly by SDK version — rather than guess, the function (`dataverseLabResultWebhook.js`) already logs the full raw body via `console.log` on every call before attempting to parse it.

1. With the step registered, go create/update a `hs_medicalrecords` row in the app (or directly in Dataverse) and set its status to **Critical**.
2. Open the Function App in the Azure Portal → **Application Insights** → **Logs**, or **Monitor** tab on the function itself → find the `traces` entry containing `"Dataverse webhook raw payload:"`.
3. Compare the real JSON against what `extractPostImageAttributes()` expects (`PostEntityImages`, `Attributes` as a `key`/`value` array). If the real shape differs — e.g. PascalCase `Key`/`Value`, or images keyed by name instead of an array — adjust that one function; nothing else needs to change, since it's the single seam between "whatever Dataverse actually sent" and the rest of the handler.
4. Once `dataverseGet('hs_users(...)')` returns the patient's `hs_emailaddress`/`hs_fullname` correctly and an email arrives, switch the step's Execution Mode to Asynchronous (Part F.5) and you're done.

---

## Testing the Function in isolation (without Dataverse at all)

Before wiring up PRT, you can sanity-check the Function on its own with a hand-built payload shaped like what you expect Dataverse to send:

```bash
curl -X POST https://<your-function-app>.azurewebsites.net/api/bridge/webhooks/lab-result-critical \
  -H "Content-Type: application/json" \
  -H "x-webhook-key: <your DATAVERSE_WEBHOOK_KEY>" \
  -d '{
    "PostEntityImages": [
      { "key": "PostImage", "value": { "Attributes": [
        { "key": "hs_status", "value": "critical" },
        { "key": "_hs_patient_value", "value": "<a real hs_users GUID>" },
        { "key": "hs_testtype", "value": "Full Blood Count" },
        { "key": "hs_result", "value": "Hb 6.2 g/dL (critically low)" }
      ] } }
    ]
  }'
```

A `200` with `{ "handled": true, "emailSent": true }` confirms the Dataverse Web API callback (Parts A/B) and the email send both work — only the real Dataverse → webhook wiring (Parts D–G) remains to verify.

---

## Why this matters for the rest of the platform

This is the only place in HealthSphere where the bridge authenticates *as itself* rather than relying entirely on the signed-in user's session — it's the pattern to reuse for any future "fire automatically when data changes, no matter who changed it" requirement (e.g. notifying a doctor the instant a patient's wearable sync logs an abnormal heart rate, instead of waiting for the patient to open the app).
