# Salino Cloud Functions

## Setup

1. Blaze plan on project `salino-aaf86`.
2. Set the Gemini API key (do not commit it):

   ```bash
   firebase functions:secrets:set GEMINI_API_KEY
   ```

3. Install and deploy:

   ```bash
   cd functions
   npm install
   npm run build
   cd ..
   firebase deploy --only functions:classifyItemCategory
   ```

## Deploy failed: "missing permission on the build service account"

First-time Cloud Functions (2nd gen) deploys often need extra IAM roles on project `salino-aaf86` (`937718857697`).

1. Open [IAM](https://console.cloud.google.com/iam-admin/iam?project=salino-aaf86).
2. Find **Default compute service account** (`937718857697-compute@developer.gserviceaccount.com`).
3. Edit → **Add role** → **Cloud Build Service Account** (`roles/cloudbuild.builds.builder`) → Save.
4. Find **Cloud Build Service Account** (`937718857697@cloudbuild.gserviceaccount.com`) if listed, and add:
   - **Logs Writer**
   - **Artifact Registry Writer**
   - **Storage Object Viewer**
5. Retry:

   ```bash
   firebase deploy --only functions:classifyItemCategory
   ```

Open the build log URL from the error message for the exact missing role if it still fails.

## Callable

- **Name:** `classifyItemCategory`
- **Auth:** required
- **Input:** `{ "itemName": "חלב 3%" }`
- **Output:** `{ "category": "DAIRY" }` or `{ "category": null }`
