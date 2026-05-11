/* eslint-disable no-console */

const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");

function readServiceAccount() {
  const json = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT;
  if (json) return JSON.parse(json);

  const base64 = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_BASE64;
  if (base64) return JSON.parse(Buffer.from(base64, "base64").toString("utf8"));

  return null;
}

function initAdmin() {
  if (admin.apps.length) return admin.app();

  const serviceAccount = readServiceAccount();
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  if (serviceAccount) {
    return admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId,
    });
  }

  return admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId,
  });
}

async function main() {
  const app = initAdmin();
  const db = app.firestore();

  const storePath = path.join(process.cwd(), "data", "cms-store.json");
  const raw = fs.readFileSync(storePath, "utf8");
  const store = raw ? JSON.parse(raw) : {};

  const collections = Object.entries(store).filter(([, value]) => Array.isArray(value));
  if (!collections.length) {
    console.log("No collections found in data/cms-store.json");
    return;
  }

  for (const [collectionName, items] of collections) {
    console.log(`Seeding ${collectionName} (${items.length})...`);
    const batch = db.batch();

    for (const item of items) {
      const id = item.id;
      if (!id) {
        throw new Error(`Missing id in ${collectionName} item: ${JSON.stringify(item)}`);
      }
      const ref = db.collection(collectionName).doc(id);
      batch.set(ref, { ...item, id }, { merge: true });
    }

    await batch.commit();
  }

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

