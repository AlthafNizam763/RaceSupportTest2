import admin from "firebase-admin";
import fs from "fs";

function readServiceAccount() {
  const json = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT;
  if (json) {
    return JSON.parse(json);
  }

  const base64 = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_BASE64;
  if (base64) {
    const decoded = Buffer.from(base64, "base64").toString("utf8");
    return JSON.parse(decoded);
  }

  const filePath = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH;
  if (filePath) {
    const contents = fs.readFileSync(filePath, "utf8");
    return JSON.parse(contents);
  }

  return null;
}

export function getAdminApp() {
  if (admin.apps.length) {
    return admin.app();
  }

  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) {
    throw new Error(
      "Missing NEXT_PUBLIC_FIREBASE_PROJECT_ID. Set it in .env.local (Firebase Console → Project settings)."
    );
  }

  const serviceAccount = readServiceAccount();
  if (serviceAccount) {
    return admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId,
    });
  }

  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    throw new Error(
      "Firebase Admin credentials not configured. Set FIREBASE_ADMIN_SERVICE_ACCOUNT (JSON), FIREBASE_ADMIN_SERVICE_ACCOUNT_BASE64 (base64 JSON), FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH (file path), or GOOGLE_APPLICATION_CREDENTIALS."
    );
  }

  return admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId,
  });
}

export function getAdminFirestore() {
  return getAdminApp().firestore();
}
