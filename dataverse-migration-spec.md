# Dataverse migration spec

Source of truth: `..\React\Healthsphere\backend\prisma\schema.prisma` (32 models, 16 enums). Existing precedent: `hs_users` table (logical name `hs_user`, entity set `hs_users`) — same publisher prefix (`hs_`) and naming convention used below.

## Conventions

- **Logical name**: `hs_<entity, singular, lowercase, no separators>` (e.g. `hs_appointment`).

- **Entity set / display collection name**: plural of the above (e.g. `hs_appointments`).

- **Columns**: `hs_<fieldname, lowercase, no separators>` — mirrors `hs_emailaddress`, `hs_fullname` etc. already used on `hs_users`.

- **Primary key**: Dataverse auto-generates `hs_<entity>id` (GUID) — this replaces the Prisma `Int id`. Don't try to recreate the Postgres integer IDs; all relationships below use GUID lookups instead.

- **Foreign keys → Lookup columns** pointing at the related table's primary key.

- **Enums → Choice (option set) columns.** Create the choice values with these exact labels (Dataverse assigns its own integer codes — that's fine, codegen picks up the actual mapping automatically from whatever you create).

- Create tables via make.powerapps.com → Tables → + New table, same as `hs_users`. After each table is created, run (note: `--api-id dataverse`, not a connector name — this is the native current-environment Dataverse path, no connection ID needed, and is what produces typed per-table model/service files matching `hs_users`. Using `pac code add-data-source` with a `shared_commondataserviceforapps` connector instead produces a generic, untyped connector API — wrong path, avoid it):

  ```
  npx power-apps add-data-source --api-id dataverse --resource-name "hs_<entity>" --org-url "https://org974d4a33.crm8.dynamics.com"
  ```

  This generates `src/generated/models/Hs_<entity>sModel.ts` and `src/generated/services/Hs_<entity>sService.ts`, and registers the table under `databaseReferences.default.cds.dataSources` in `power.config.json` — same shape as the existing `user` entry.

## Known gaps to fix on `hs_users` while you're at it

- `hs_userrole` choice is missing `pharmacy` (Prisma `Role` enum has `patient, doctor, admin, government, pharmacy`). Add it as a 5th choice value.
- `hs_accountstatus` choice only has `active` (Prisma `UserStatus` has `active, inactive, pending, suspended`). Add the other 3.
- `hs_bloodtype` choice currently has duplicate/garbled labels (`AB_`, `O_`, `B_`, `A_` repeated) — worth cleaning up to clean `A+, A-, B+, B-, AB+, AB-, O+, O-` to match `User.bloodType` usage.
- `hs_passwordhash` must contain a real bcrypt hash (see earlier fix), not plaintext.

## Tables

### hs_doctor (Prisma `Doctor`)

1:1 extension of a user with role=doctor.

| Column | Type | Notes |
| --- | --- | --- |
| hs_user | Lookup → hs_user | required, unique (1:1) |
| hs_specialization | Text (100) |  |
| hs_hospital | Text (255) |  |
| hs_hcpcnumber | Text (50) |  |
| hs_hcpcverified | Yes/No | default No |
| hs_rating | Decimal (3,2) | default 0.0 |
| hs_experienceyears | Whole Number |  |
| hs_bio | Multiline text |  |
| hs_availability | Multiline text |  |

### hs_appointment (Prisma `Appointment`)

| Column | Type | Notes |
| --- | --- | --- |
| hs_patient | Lookup → hs_user | required |
| hs_doctor | Lookup → hs_user | required |
| hs_appointmentdate | Date only | required |
| hs_appointmenttime | Date+Time (or Text "HH:mm" if Dataverse time-only is awkward) | required |
| hs_reason | Multiline text |  |
| hs_type | Choice: general, follow_up, emergency, specialist | default general |
| hs_status | Choice: pending, confirmed, arrived, waiting, completed, cancelled, late, no_show | default pending |
| hs_notes | Multiline text |  |

### hs_medicalrecord (Prisma `MedicalRecord`)

| Column | Type | Notes |
| --- | --- | --- |
| hs_patient | Lookup → hs_user | required |
| hs_doctor | Lookup → hs_user | optional |
| hs_testtype | Text (100) | required |
| hs_result | Multiline text |  |
| hs_status | Choice: normal, elevated, low, critical, pending | default pending |
| hs_notes | Multiline text |  |
| hs_testdate | Date only |  |
| hs_filepath | Text (500) | see file-storage note below |

### hs_prescription (Prisma `Prescription`)

### 

### | Column | Type | Notes |

### | --- | --- | --- |

### | hs_patient | Lookup → hs_user | required |

### | hs_doctor | Lookup → hs_user | optional |

### | hs_medicationname | Text (255) | required |

### | hs_dosage | Text (100) | |

### | hs_frequency | Text (100) | |

### | hs_duration | Text (100) | |

### | hs_startdate | Date only | |

### | hs_enddate | Date only | |

### | hs_instructions | Multiline text | |

### | hs_status | Choice: active, completed, cancelled, expired | default active |

### | hs_refillrequested | Yes/No | default No |

### | hs_filepath | Text (500) | |

### 

### hs_prescriptionorder (Prisma `PrescriptionOrder`)

### 

### | Column | Type | Notes |

### | --- | --- | --- |

### | hs_prescription | Lookup → hs_prescription | required |

### | hs_patient | Lookup → hs_user | required |

### | hs_doctor | Lookup → hs_user | required |

### | hs_status | Choice: pending, approved, preparing, dispatched, delivered, rejected, cancelled | default pending |

### | hs_deliverymethod | Choice: collection, delivery | default collection |

### | hs_deliveryaddress | Multiline text | |

### | hs_pharmacyname | Text (150) | |

### | hs_patientnotes | Multiline text | |

### | hs_doctornotes | Multiline text | |

### | hs_estimatedready | Date+Time | |

### | hs_paymentintentid | Text (255) | **Stripe ID — written by server logic only, see gaps doc** |

### 

### hs_allergy (Prisma `Allergy`)

### 

### | Column | Type | Notes |

### | --- | --- | --- |

### | hs_user | Lookup → hs_user | required |

### | hs_allergen | Text (255) | required |

### | hs_reaction | Text (255) | |

### | hs_severity | Choice: mild, moderate, severe | default moderate |

### | hs_notes | Multiline text | |

### | hs_allergytype | Text (50) | default "food" |

### | hs_isactive | Yes/No | default Yes |

### hs_foodintolerance (Prisma `FoodIntolerance`)

| Column | Type | Notes |
| --- | --- | --- |
| hs_user | Lookup → hs_user | required |
| hs_intolerance | Text (255) | required |
| hs_severity | Choice: mild, moderate, severe | default moderate |
| hs_isactive | Yes/No | default Yes |

### hs_dietpreference (Prisma `DietPreference`)

| Column | Type | Notes |
| --- | --- | --- |
| hs_user | Lookup → hs_user | required |
| hs_preference | Text (255) | required |
| hs_isactive | Yes/No | default Yes |

### hs_ingredientdislike (Prisma `IngredientDislike`)

| Column | Type | Notes |
| --- | --- | --- |
| hs_user | Lookup → hs_user | required |
| hs_ingredient | Text (255) | required |
| hs_isactive | Yes/No | default Yes |

### hs_vaccination (Prisma `Vaccination`)

| Column | Type | Notes |
| --- | --- | --- |
| hs_user | Lookup → hs_user | required |
| hs_vaccinename | Text (255) | required |
| hs_dosenumber | Whole Number | default 1 |
| hs_dateadministered | Date only |  |
| hs_nextduedate | Date only |  |
| hs_batchnumber | Text (100) |  |
| hs_administeredby | Text (255) |  |
| hs_notes | Multiline text |  |

### hs_healthmetric (Prisma `HealthMetric`)

| Column | Type | Notes |
| --- | --- | --- |
| hs_user | Lookup → hs_user | required |
| hs_systolic | Whole Number |  |
| hs_diastolic | Whole Number |  |
| hs_heartrate | Whole Number |  |
| hs_oxygensaturation | Decimal (5,2) |  |
| hs_temperature | Decimal (5,2) |  |
| hs_steps | Whole Number |  |
| hs_sleephours | Decimal (4,2) |  |
| hs_weight | Decimal (6,2) |  |
| hs_bmi | Decimal (5,2) |  |
| hs_bloodglucose | Decimal (6,2) |  |
| hs_stresslevel | Whole Number |  |
| hs_caloriesburned | Whole Number |  |
| hs_distancekm | Decimal (6,2) |  |
| hs_source | Text (20) | default "manual" |
| hs_recordedat | Date+Time | default now |

### hs_wearabletoken (Prisma `WearableToken`)

**Holds OAuth tokens — should not be readable/writable client-side. See server-logic gaps doc.**

| Column | Type | Notes |
| --- | --- | --- |
| hs_user | Lookup → hs_user | required |
| hs_provider | Text (20) | default "google_fit" |
| hs_accesstoken | Text (encrypted if available) |  |
| hs_refreshtoken | Text (encrypted if available) |  |
| hs_expiresat | Date+Time |  |
| hs_lastsync | Date+Time |  |

### hs_googlefitdriveimport (Prisma `GoogleFitDriveImport`)

| Column | Type | Notes |
| --- | --- | --- |
| hs_user | Lookup → hs_user | required |
| hs_drivefileid | Text (200) | required |
| hs_filename | Text (255) | required |
| hs_modifiedtime | Text (50) |  |
| hs_importedrows | Whole Number | default 0 |
| hs_latestdate | Date only |  |

### hs_dietlog (Prisma `DietLog`)

| Column | Type | Notes |
| --- | --- | --- |
| hs_user | Lookup → hs_user | required |
| hs_foodname | Text (255) | required |
| hs_mealtype | Choice: breakfast, lunch, dinner, snack | required |
| hs_calories | Whole Number |  |
| hs_protein | Decimal (6,2) |  |
| hs_carbs | Decimal (6,2) |  |
| hs_fat | Decimal (6,2) |  |
| hs_fiber | Decimal (6,2) |  |
| hs_logdate | Date+Time | default now |

### hs_exerciselog (Prisma `ExerciseLog`)

| Column | Type | Notes |
| --- | --- | --- |
| hs_user | Lookup → hs_user | required (maps Prisma `patientId`) |
| hs_logdate | Date only | required |
| hs_exercisetype | Text (100) | required |
| hs_durationminutes | Whole Number | default 0 |
| hs_caloriesburned | Decimal (8,2) | default 0 |
| hs_intensity | Choice: low, moderate, high | default moderate |
| hs_notes | Multiline text |  |

### hs_waterlog (Prisma `WaterLog`)

| Column | Type | Notes |
| --- | --- | --- |
| hs_user | Lookup → hs_user | required |
| hs_glasses | Whole Number | default 0 |
| hs_ml | Whole Number |  |
| hs_logdate | Date+Time | default now |

### hs_payment (Prisma `Payment`)

**Written only by server-side Stripe webhook logic — never directly from the client. See gaps doc.**

| Column | Type | Notes |
| --- | --- | --- |
| hs_user | Lookup → hs_user | required |
| hs_paymenttype | Text (20) |  |
| hs_stripepaymentintentid | Text (100) | required, unique |
| hs_amount | Whole Number | required |
| hs_currency | Text (3) | default "gbp" |
| hs_status | Text (30) | default "succeeded" |
| hs_description | Multiline text |  |

### hs_message (Prisma `Message`)

**Real-time delivery (Socket.io) has no Dataverse equivalent — client will need to poll. See gaps doc.**

| Column | Type | Notes |
| --- | --- | --- |
| hs_sender | Lookup → hs_user | required |
| hs_receiver | Lookup → hs_user | required |
| hs_content | Multiline text | required |
| hs_isread | Yes/No | default No |
| hs_isemergency | Yes/No | default No |

### hs_notification (Prisma `Notification`)

| Column | Type | Notes |
| --- | --- | --- |
| hs_user | Lookup → hs_user | required |
| hs_type | Choice: appointment, medication, lab_result, message, alert, system | default system |
| hs_title | Text (255) | required |
| hs_message | Multiline text |  |
| hs_isread | Yes/No | default No |
| hs_link | Text (500) |  |

### hs_clinicalnote (Prisma `ClinicalNote`)

| Column | Type | Notes |
| --- | --- | --- |
| hs_patient | Lookup → hs_user | required |
| hs_doctor | Lookup → hs_user | required |
| hs_notetype | Choice: general, follow_up, diagnosis, prescription, referral | default general |
| hs_content | Multiline text | required |

### hs_familyhistory (Prisma `FamilyHistory`)

| Column | Type | Notes |
| --- | --- | --- |
| hs_user | Lookup → hs_user | required |
| hs_relation | Text (50) |  |
| hs_relationname | Text (255) |  |
| hs_conditionname | Text (255) | required |
| hs_diagnosisyear | Whole Number |  |
| hs_yeardeceased | Whole Number |  |
| hs_notes | Multiline text |  |

### hs_patientquestionnaire (Prisma `PatientQuestionnaire`)

| Column | Type | Notes |
| --- | --- | --- |
| hs_patient | Lookup → hs_user | required, unique (1:1) |
| hs_completed | Yes/No | default No |
| hs_completedat | Date+Time |  |
| hs_startedat | Date+Time | default now |

### hs_questionnaireanswer (Prisma `QuestionnaireAnswer`)

| Column | Type | Notes |
| --- | --- | --- |
| hs_patient | Lookup → hs_user | required |
| hs_questionkey | Text (100) | required |
| hs_answer | Multiline text |  |

### hs_document (Prisma `Document`)

**File storage model differs entirely from multer/local disk — see gaps doc.**

| Column | Type | Notes |
| --- | --- | --- |
| hs_user | Lookup → hs_user | required |
| hs_title | Text (255) |  |
| hs_description | Multiline text |  |
| hs_doctype | Text (50) | default "other" |
| hs_filepath | Text (500) | or switch to a File column, see gaps doc |
| hs_filename | Text (255) |  |
| hs_filetype | Text (50) |  |
| hs_filesize | Whole Number |  |

### hs_ingredientscan (Prisma `IngredientScan`)

| Column | Type | Notes |
| --- | --- | --- |
| hs_user | Lookup → hs_user | required |
| hs_productname | Text (255) |  |
| hs_ingredients | Multiline text |  |
| hs_result | Choice: safe, warning, danger | default safe |
| hs_alerts | Multiline text |  |
| hs_aisummary | Multiline text | **written by Gemini call — server logic, see gaps doc** |
| hs_tip | Multiline text |  |

### hs_accesslog (Prisma `AccessLog`)

| Column | Type | Notes |
| --- | --- | --- |
| hs_user | Lookup → hs_user | optional (Prisma model has no FK constraint defined, just `userId Int`) |
| hs_accessedpatient | Lookup → hs_user | optional |
| hs_action | Text (255) |  |
| hs_ipaddress | Text (45) |  |

### hs_healthalert (Prisma `HealthAlert`)

| Column | Type | Notes |
| --- | --- | --- |
| hs_patient | Lookup → hs_user | required |
| hs_doctor | Lookup → hs_user | optional |
| hs_alerttype | Text (100) |  |
| hs_message | Multiline text |  |
| hs_priority | Choice: low, medium, high, critical | default medium |
| hs_isresolved | Yes/No | default No |

### hs_publichealthalert (Prisma `PublicHealthAlert`)

No relationships — pure reference/broadcast data.

| Column | Type | Notes |
| --- | --- | --- |
| hs_title | Text (255) | required |
| hs_message | Multiline text |  |
| hs_severity | Choice: info, warning, critical | default info |
| hs_region | Text (100) |  |
| hs_issuedby | Lookup → hs_user | optional |

### hs_fooddatabase (Prisma `FoodDatabase`)

No relationships. **Good first table to migrate — pure reference data, no FKs, no enums except one choice.**

| Column | Type | Notes |
| --- | --- | --- |
| hs_name | Text (255) | required |
| hs_category | Text (100) |  |
| hs_calories | Whole Number |  |
| hs_protein | Decimal (6,2) |  |
| hs_carbs | Decimal (6,2) |  |
| hs_sugar | Decimal (6,2) |  |
| hs_fat | Decimal (6,2) |  |
| hs_fiber | Decimal (6,2) |  |
| hs_sodium | Decimal (7,2) |  |
| hs_allergens | Multiline text |  |
| hs_avoidif | Multiline text |  |
| hs_vitamins | Multiline text |  |
| hs_portionsize | Text (100) |  |
| hs_healthrating | Choice: excellent, good, moderate, poor | default moderate |

### hs_geneticdisease1 (Prisma `GeneticDisease`)

Note: actual logical name in Dataverse ended up as `hs_geneticdisease1` (Dataverse appended `1` to avoid a naming conflict from an earlier attempt). Use this exact name in `add-data-source` and in any generated service references (`Hs_geneticdisease1sService`, etc.).

No relationships. **Also a good first table — pure reference data, no enums at all.**

| Column | Type | Notes |
| --- | --- | --- |
| hs_name | Text (255) | required |
| hs_inheritancetype | Text (100) |  |
| hs_symptoms | Multiline text |  |
| hs_foodtriggers | Multiline text |  |
| hs_exerciseguidance | Multiline text |  |
| hs_careplan | Multiline text |  |

### hs_doctorschedule1 (Prisma `DoctorSchedule`)

Note: actual logical name in Dataverse ended up as `hs_doctorschedule1` (same naming-conflict
auto-suffix as `hs_geneticdisease1`).

| Column | Type | Notes |
| --- | --- | --- |
| hs_doctor | Lookup → hs_doctor | required |
| hs_dayofweek | Whole Number | required (0-6) |
| hs_starttime | Text ("HH:mm") or Date+Time |  |
| hs_endtime | Text ("HH:mm") or Date+Time |  |
| hs_isavailable | Yes/No | default Yes |
| hs_slotduration | Whole Number | default 30 |

## Server-only logic — cannot move to Dataverse alone

These need a Power Automate flow or Azure Function bridge (holding the actual secret), called from the code app instead of Dataverse directly:

| Feature | Current implementation | Bridge needed for |
| --- | --- | --- |
| Stripe payments (`hs_payment`, `hs_prescriptionorder.hs_paymentintentid`) | `backend/src/controllers` + Stripe secret key | Creating PaymentIntents, webhook confirmation |
| Email notifications | Nodemailer + SMTP creds | Sending any email |
| AI Assistant / `hs_ingredientscan.hs_aisummary` | Gemini API key | Any Gemini call |
| Google Fit OAuth (`hs_wearabletoken`) | Google OAuth client secret | Token exchange/refresh |
| File uploads (`hs_document`, `hs_medicalrecord.hs_filepath`, `hs_prescription.hs_filepath`) | multer → local disk | Needs Dataverse file column or SharePoint/Blob storage + upload flow |
| Real-time messaging (`hs_message`) | Socket.io | No Dataverse push equivalent — client must poll `hs_message` on an interval instead |
| Password hashing on write | bcrypt server-side | Registration/change-password — same client-side bcrypt compromise as login, or move to a flow |
| Row-level access (patient sees own data only, doctor sees their patients, admin sees all) | Express middleware checking `req.user.id` | Dataverse security roles/business units, or replicate checks client-side (insecure) |

## Suggested order of attack

1. `hs_fooddatabase`, `hs_geneticdisease` — no FKs, minimal/no choices, validates the whole pattern end-to-end.
2. `hs_doctor`, `hs_doctorschedule` — small, sets up the doctor-profile lookup other tables need.
3. `hs_appointment`, `hs_medicalrecord`, `hs_prescription`, `hs_prescriptionorder` — core clinical flow.
4. Diet/health tracking cluster: `hs_dietlog`, `hs_exerciselog`, `hs_waterlog`, `hs_healthmetric`, `hs_allergy`, `hs_foodintolerance`, `hs_dietpreference`, `hs_ingredientdislike`, `hs_vaccination`.
5. `hs_notification`, `hs_clinicalnote`, `hs_familyhistory`, `hs_patientquestionnaire`, `hs_questionnaireanswer`, `hs_document`, `hs_ingredientscan`, `hs_healthalert`, `hs_publichealthalert`, `hs_accesslog`.
6. Last (need a bridge, not just a table): `hs_payment`, `hs_wearabletoken`, `hs_googlefitdriveimport`, `hs_message`.