import { getAdminFirestore } from "@/lib/server/firebase-admin";

export interface AuditLog {
  id: string;
  timestamp: string;
  operation: "CREATE" | "UPDATE" | "DELETE" | "FETCH";
  collectionName: string;
  documentId: string;
  userId?: string;
  dataSnapshot?: Record<string, any>;
  oldDataSnapshot?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  status: "SUCCESS" | "FAILURE";
  error?: string;
}

const AUDIT_COLLECTION = "audit_logs";

export async function logAuditEvent(event: Omit<AuditLog, "id" | "timestamp">) {
  try {
    const db = getAdminFirestore();
    const auditEntry: AuditLog = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      ...event,
    };

    await db.collection(AUDIT_COLLECTION).doc(auditEntry.id).set(auditEntry);
    return auditEntry;
  } catch (error: any) {
    console.error("Failed to log audit event:", error.message);
  }
}

export async function getAuditLogs(options?: {
  collectionName?: string;
  operation?: AuditLog["operation"];
  documentId?: string;
  limit?: number;
}) {
  try {
    const db = getAdminFirestore();
    let query: any = db.collection(AUDIT_COLLECTION);

    if (options?.collectionName) {
      query = query.where("collectionName", "==", options.collectionName);
    }
    if (options?.operation) {
      query = query.where("operation", "==", options.operation);
    }
    if (options?.documentId) {
      query = query.where("documentId", "==", options.documentId);
    }

    const limitCount = options?.limit ?? 100;

    // Attempt full query with ordering (requires composite index when multiple filters are active)
    try {
      const snapshot = await query.orderBy("timestamp", "desc").limit(limitCount).get();
      return snapshot.docs.map((doc: any) => doc.data() as AuditLog);
    } catch (indexError: any) {
      // If a composite index is missing, fall back to unordered fetch + client-side sort
      if (indexError.code === 9 || (indexError.message && indexError.message.includes("index"))) {
        console.warn("[audit] Composite index not found, falling back to client-side sort:", indexError.message);
        const snapshot = await query.limit(limitCount * 5).get();
        const docs = snapshot.docs.map((doc: any) => doc.data() as AuditLog);
        return docs
          .sort((a: AuditLog, b: AuditLog) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          )
          .slice(0, limitCount);
      }
      throw indexError;
    }
  } catch (error: any) {
    console.error("Failed to fetch audit logs:", error.message);
    return [];
  }
}

export interface DataInventory {
  collectionName: string;
  documentCount: number;
  lastUpdated: string;
  sampleDocuments?: Record<string, any>[];
}

export async function getDataInventory() {
  try {
    const db = getAdminFirestore();
    const collections = [
      "events",
      "courses",
      "projects",
      "observations",
      "collaborations",
      "news",
      "team_members",
      "changemakers",
      "gallery",
      "tickets",
      "settings",
    ];

    const inventory: DataInventory[] = [];

    for (const collectionName of collections) {
      const snapshot = await db.collection(collectionName).get();
      const docs = snapshot.docs.map((doc) => doc.data() as Record<string, any>);

      const lastUpdated = docs.length > 0
        ? docs.reduce((max, doc) => {
            const time = new Date(doc.updatedAt || doc.createdAt || "").getTime();
            const maxTime = new Date(max).getTime();
            return time > maxTime ? doc.updatedAt || doc.createdAt || new Date().toISOString() : max;
          }, new Date(0).toISOString())
        : new Date().toISOString();

      inventory.push({
        collectionName,
        documentCount: docs.length,
        lastUpdated,
        sampleDocuments: docs.slice(0, 3),
      });
    }

    return inventory;
  } catch (error: any) {
    console.error("Failed to get data inventory:", error.message);
    return [];
  }
}

export async function getCollectionSnapshot(collectionName: string) {
  try {
    const db = getAdminFirestore();
    const snapshot = await db.collection(collectionName).get();
    return snapshot.docs.map((doc) => ({
      ...doc.data(),
      _firestoreId: doc.id,
    }) as Record<string, any>);
  } catch (error: any) {
    console.error(`Failed to get collection snapshot for ${collectionName}:`, error.message);
    return [];
  }
}
