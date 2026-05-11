import fs from "fs";
import path from "path";
import { getAdminApp } from "../lib/server/firebase-admin";
import { getFirestore } from "firebase-admin/firestore";

interface SeedData {
  projects?: Array<Record<string, any>>;
  team_members?: Array<Record<string, any>>;
  events?: Array<Record<string, any>>;
  settings?: Array<Record<string, any>>;
  courses?: Array<Record<string, any>>;
  observations?: Array<Record<string, any>>;
  collaborations?: Array<Record<string, any>>;
  news?: Array<Record<string, any>>;
  changemakers?: Array<Record<string, any>>;
  gallery?: Array<Record<string, any>>;
  tickets?: Array<Record<string, any>>;
}

const STORE_PATH = path.join(process.cwd(), "data", "cms-store.json");

async function seedFirestore() {
  try {
    console.log("🔄 Starting Firestore seed process...\n");

    // Initialize Firebase
    const app = getAdminApp();
    const db = getFirestore(app);

    // Read the cms-store.json file
    if (!fs.existsSync(STORE_PATH)) {
      console.log("❌ cms-store.json not found at:", STORE_PATH);
      process.exit(1);
    }

    const fileContents = fs.readFileSync(STORE_PATH, "utf8");
    const seedData: SeedData = JSON.parse(fileContents);

    console.log("📦 Data loaded from cms-store.json");
    console.log("─".repeat(60));

    // Mapping of collection names and their data
    const collectionsToSeed = [
      { name: "projects", data: seedData.projects },
      { name: "team_members", data: seedData.team_members },
      { name: "events", data: seedData.events },
      { name: "settings", data: seedData.settings },
      { name: "courses", data: seedData.courses },
      { name: "observations", data: seedData.observations },
      { name: "collaborations", data: seedData.collaborations },
      { name: "news", data: seedData.news },
      { name: "changemakers", data: seedData.changemakers },
      { name: "gallery", data: seedData.gallery },
      { name: "tickets", data: seedData.tickets },
    ];

    let totalDocuments = 0;

    for (const collection of collectionsToSeed) {
      if (!collection.data || collection.data.length === 0) {
        console.log(`⏭️  ${collection.name}: Skipping (no data)`);
        continue;
      }

      console.log(`\n📝 Seeding "${collection.name}" collection...`);

      const batch = db.batch();
      const docs = collection.data as Array<Record<string, any>>;

      for (const doc of docs) {
        const docId = doc.id || generateId();
        const docRef = db.collection(collection.name).doc(docId);

        const dataToSeed = {
          ...doc,
          id: docId,
          createdAt: doc.createdAt || new Date().toISOString(),
          updatedAt: doc.updatedAt || new Date().toISOString(),
        };

        batch.set(docRef, dataToSeed);
        console.log(`   ✓ Added document: ${docId}`);
      }

      await batch.commit();
      totalDocuments += docs.length;
      console.log(`✅ ${collection.name}: ${docs.length} document(s) seeded`);
    }

    console.log("\n" + "─".repeat(60));
    console.log(`\n🎉 Seed process completed!`);
    console.log(`📊 Total documents seeded: ${totalDocuments}`);
    console.log("\n📍 Collections in Firestore:");

    // List all collections and their document counts
    const admin = require("firebase-admin");
    const collections = await db.listCollections();

    for (const collectionRef of collections) {
      const snapshot = await collectionRef.get();
      console.log(`   • ${collectionRef.id}: ${snapshot.size} documents`);
    }

    console.log(
      "\n🔍 To view the data, check these endpoints:"
    );
    console.log("   • GET /api/data/inventory - View all collections and document counts");
    console.log("   • GET /api/data/collection/[name] - View documents in a collection");
    console.log("   • GET /api/data/audit - View operation history/logs");

    process.exit(0);
  } catch (error: any) {
    console.error("❌ Error during seeding:", error.message);
    process.exit(1);
  }
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15);
}

// Run the seed function
seedFirestore();
