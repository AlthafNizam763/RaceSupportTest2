import fs from "fs";

import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

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
  if (filePath && fs.existsSync(filePath)) {
    const contents = fs.readFileSync(filePath, "utf8");
    return JSON.parse(contents);
  }

  return null;
}

export function getAdminApp() {
  const existing = getApps();
  if (existing.length) {
    return existing[0];
  }

  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) {
    throw new Error(
      "Missing NEXT_PUBLIC_FIREBASE_PROJECT_ID. Set it in .env.local (Firebase Console → Project settings)."
    );
  }

  const serviceAccount = readServiceAccount();
  if (serviceAccount) {
    return initializeApp({
      credential: cert(serviceAccount),
      projectId,
    });
  }

  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    throw new Error(
      "Firebase Admin credentials not configured. Set FIREBASE_ADMIN_SERVICE_ACCOUNT (JSON), FIREBASE_ADMIN_SERVICE_ACCOUNT_BASE64 (base64 JSON), FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH (file path), or GOOGLE_APPLICATION_CREDENTIALS."
    );
  }

  return initializeApp({
    credential: applicationDefault(),
    projectId,
  });
}

export function getAdminFirestore() {
  return getFirestore(getAdminApp());
}
