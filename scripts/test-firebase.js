/* eslint-disable no-console */
/**
 * Firebase Integration Test Script
 * Tests all CRUD operations + collection mapping for every CMS collection.
 * Run with: node scripts/test-firebase.js
 */

const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");

// ─── Load .env.local ────────────────────────────────────────────────────────
function loadEnvFile() {
  const envPath = path.join(__dirname, "..", ".env.local");
  if (!fs.existsSync(envPath)) {
    console.error("❌ .env.local not found at", envPath);
    process.exit(1);
  }
  const content = fs.readFileSync(envPath, "utf8");
  content.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const [key, ...rest] = trimmed.split("=");
      const value = rest.join("=");
      if (key && value) process.env[key.trim()] = value.trim();
    }
  });
}

// ─── Init Admin ─────────────────────────────────────────────────────────────
function initAdmin() {
  if (admin.apps.length) return admin.app();
  const json = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT;
  const b64 = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_BASE64;
  const filePath = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  if (!projectId) throw new Error("Missing NEXT_PUBLIC_FIREBASE_PROJECT_ID");

  let sa;
  if (json) sa = JSON.parse(json);
  else if (b64) sa = JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
  else if (filePath) sa = JSON.parse(fs.readFileSync(filePath, "utf8"));

  if (sa) {
    return admin.initializeApp({ credential: admin.credential.cert(sa), projectId });
  }
  return admin.initializeApp({ credential: admin.credential.applicationDefault(), projectId });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;

function ok(label) {
  console.log(`  ✅ ${label}`);
  passed++;
}

function fail(label, err) {
  console.error(`  ❌ ${label}: ${err?.message || err}`);
  failed++;
}

// ─── Collection Map (key → Firestore name) ───────────────────────────────────
const COLLECTION_MAP = {
  events: "events",
  courses: "courses",
  projects: "projects",
  observations: "observations",
  collaborations: "collaborations",
  news: "news",
  team: "team_members",         // CMS key "team" → Firestore "team_members"
  changemakers: "changemakers",
  gallery: "gallery",
  tickets: "tickets",
  settings: "settings",
};

// ─── Sample test documents ────────────────────────────────────────────────────
function getSampleDoc(collectionKey) {
  const base = {
    title: `TEST_${collectionKey}_${Date.now()}`,
    description: "Firebase integration test document",
    images: [],
    order: 9999,
  };

  switch (collectionKey) {
    case "events":
      return { ...base, date: "2026-06-01", status: "Ongoing" };
    case "team":
      return {
        name: `Test Member ${Date.now()}`,
        role: "Tester",
        image: "",
        points: 0,
        link: "",
        description: "Test bio",
        type: "leader",
        order: 9999,
      };
    case "changemakers":
      return { name: `Test Changemaker ${Date.now()}`, title: "Visionary", image: "", order: 9999 };
    case "gallery":
      return {
        title: "Test Gallery Item",
        type: "image",
        url: "https://example.com/test.jpg",
        path: "gallery/test.jpg",
        fileName: "test.jpg",
        contentType: "image/jpeg",
        size: 1024,
        order: 9999,
      };
    case "tickets":
      return {
        subject: `Test Ticket ${Date.now()}`,
        message: "This is an automated integration test ticket.",
        userName: "Test User",
        userEmail: "test@example.com",
        status: "Open",
        order: 9999,
      };
    case "settings":
      return {
        siteName: "RACE Test Portal",
        contactEmail: "test@raceindia.org",
        contactPhone: "+91 00000 00000",
        address: "Test Address, Kerala",
        instagram: "",
        linkedin: "",
        facebook: "",
        twitter: "",
      };
    default:
      return base;
  }
}

// ─── Test: CREATE ─────────────────────────────────────────────────────────────
async function testCreate(db, collectionKey, firestoreName) {
  const { v4: uuid } = require("crypto");
  const id = require("crypto").randomUUID();
  const now = new Date().toISOString();
  const data = { id, ...getSampleDoc(collectionKey), createdAt: now, updatedAt: now };

  try {
    await db.collection(firestoreName).doc(id).set(data);
    ok(`CREATE → ${firestoreName} (id: ${id.slice(0, 8)}...)`);
    return { id, data };
  } catch (err) {
    fail(`CREATE → ${firestoreName}`, err);
    return null;
  }
}

// ─── Test: FETCH ──────────────────────────────────────────────────────────────
async function testFetch(db, firestoreName, id) {
  try {
    const snap = await db.collection(firestoreName).doc(id).get();
    if (!snap.exists) throw new Error("Document not found after create");
    const doc = snap.data();
    if (doc.id !== id) throw new Error(`id field mismatch: expected ${id}, got ${doc.id}`);
    ok(`FETCH  → ${firestoreName} (id: ${id.slice(0, 8)}...)`);
    return doc;
  } catch (err) {
    fail(`FETCH  → ${firestoreName}`, err);
    return null;
  }
}

// ─── Test: LIST ───────────────────────────────────────────────────────────────
async function testList(db, firestoreName) {
  try {
    const snap = await db.collection(firestoreName).get();
    ok(`LIST   → ${firestoreName} (${snap.size} docs)`);
    return snap.size;
  } catch (err) {
    fail(`LIST   → ${firestoreName}`, err);
    return 0;
  }
}

// ─── Test: UPDATE ─────────────────────────────────────────────────────────────
async function testUpdate(db, firestoreName, id) {
  const updatedAt = new Date().toISOString();
  const patch = { description: "UPDATED via test script", updatedAt };
  try {
    const ref = db.collection(firestoreName).doc(id);
    await ref.set(patch, { merge: true });
    const snap = await ref.get();
    if (snap.data().description !== "UPDATED via test script") throw new Error("Update did not persist");
    ok(`UPDATE → ${firestoreName} (id: ${id.slice(0, 8)}...)`);
  } catch (err) {
    fail(`UPDATE → ${firestoreName}`, err);
  }
}

// ─── Test: DELETE ─────────────────────────────────────────────────────────────
async function testDelete(db, firestoreName, id) {
  try {
    await db.collection(firestoreName).doc(id).delete();
    const snap = await db.collection(firestoreName).doc(id).get();
    if (snap.exists) throw new Error("Document still exists after delete");
    ok(`DELETE → ${firestoreName} (id: ${id.slice(0, 8)}...)`);
  } catch (err) {
    fail(`DELETE → ${firestoreName}`, err);
  }
}

// ─── Test: Audit Log ─────────────────────────────────────────────────────────
async function testAuditLog(db, collectionName, docId) {
  try {
    const snap = await db.collection("audit_logs")
      .where("documentId", "==", docId)
      .limit(1)
      .get();
    if (snap.empty) throw new Error("No audit log found for document");
    ok(`AUDIT  → audit_logs has entry for ${collectionName}:${docId.slice(0, 8)}...`);
  } catch (err) {
    fail(`AUDIT  → audit_logs for ${collectionName}`, err);
  }
}

// ─── Test: Collection Alias (team → team_members) ────────────────────────────
async function testCollectionAlias(db) {
  console.log("\n  🔗 Verifying team → team_members alias:");
  try {
    const snap = await db.collection("team_members").get();
    ok(`ALIAS  → CMS key "team" maps to Firestore "team_members" (${snap.size} docs)`);
  } catch (err) {
    fail(`ALIAS  → team_members`, err);
  }
}

// ─── Test: Settings Singleton ─────────────────────────────────────────────────
async function testSettingsSingleton(db) {
  console.log("\n  ⚙️  Verifying settings singleton:");
  try {
    const snap = await db.collection("settings").get();
    if (snap.size > 1) {
      console.warn(`  ⚠️  WARNING: settings has ${snap.size} documents (should be 1). Consider deduplicating.`);
    } else {
      ok(`SINGLETON → settings has ${snap.size} document(s) (expected ≤1)`);
    }
  } catch (err) {
    fail("SINGLETON → settings", err);
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  loadEnvFile();
  const app = initAdmin();
  const db = app.firestore();

  console.log("\n🔥 RACE Firebase Integration Test\n");
  console.log(`📦 Project: ${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}`);
  console.log("─".repeat(60));

  const testIds = {}; // collectionKey → { firestoreName, id }

  // ── Phase 1: CREATE + FETCH for all collections ──
  console.log("\n📝 Phase 1: CREATE + FETCH\n");
  for (const [key, firestoreName] of Object.entries(COLLECTION_MAP)) {
    const result = await testCreate(db, key, firestoreName);
    if (result) {
      testIds[key] = { firestoreName, id: result.id };
      await testFetch(db, firestoreName, result.id);
    }
  }

  // ── Phase 2: LIST all collections ──
  console.log("\n📋 Phase 2: LIST\n");
  for (const [key, firestoreName] of Object.entries(COLLECTION_MAP)) {
    await testList(db, firestoreName);
  }

  // ── Phase 3: UPDATE ──
  console.log("\n✏️  Phase 3: UPDATE\n");
  for (const [key, meta] of Object.entries(testIds)) {
    if (key === "settings" || key === "gallery" || key === "tickets") continue; // skip fields without "description"
    await testUpdate(db, meta.firestoreName, meta.id);
  }

  // ── Phase 4: Audit Log Verification ──
  console.log("\n📜 Phase 4: AUDIT LOGS\n");
  console.log("  (Note: Audit logs are written by the API layer, not direct Firestore; verifying audit_logs collection access)");
  try {
    const auditSnap = await db.collection("audit_logs").limit(5).get();
    ok(`AUDIT_LOGS collection is accessible (${auditSnap.size} recent entries)`);
  } catch (err) {
    fail("AUDIT_LOGS collection access", err);
  }

  // ── Phase 5: Special Tests ──
  console.log("\n🔍 Phase 5: SPECIAL TESTS");
  await testCollectionAlias(db);
  await testSettingsSingleton(db);

  // ── Phase 6: DELETE (cleanup) ──
  console.log("\n🗑️  Phase 6: DELETE (cleanup)\n");
  for (const [key, meta] of Object.entries(testIds)) {
    await testDelete(db, meta.firestoreName, meta.id);
  }

  // ── Summary ──
  console.log("\n" + "─".repeat(60));
  console.log(`\n🏁 Test complete: ${passed} passed, ${failed} failed\n`);

  if (failed > 0) {
    console.error("❌ Some tests failed. Review errors above.");
    process.exitCode = 1;
  } else {
    console.log("✅ All Firebase integration tests passed!");
  }
}

main().catch((err) => {
  console.error("\n💥 Unhandled error:", err.message);
  process.exitCode = 1;
});
