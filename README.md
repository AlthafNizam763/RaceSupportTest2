# Race Support Tool

## Firebase CMS storage

CMS collections are stored in Firestore via the server routes under `app/api/cms/*`.

### Required server env vars

Set one of:

- `FIREBASE_ADMIN_SERVICE_ACCOUNT` (JSON string), or
- `FIREBASE_ADMIN_SERVICE_ACCOUNT_BASE64` (base64-encoded JSON), or
- `GOOGLE_APPLICATION_CREDENTIALS` (path to a service account JSON file)

And set:

- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`

### Seed existing local data into Firestore

This uploads `data/cms-store.json` into Firestore collections with the same names:

`npm run seed:firestore`

