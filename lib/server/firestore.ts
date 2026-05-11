import { randomUUID } from "crypto";

import { getAdminFirestore } from "@/lib/server/firebase-admin";

type CmsRecord = Record<string, any>;

function sortDocuments(items: CmsRecord[]) {
  return [...items].sort((left, right) => {
    const leftOrder = typeof left.order === "number" ? left.order : Number.MAX_SAFE_INTEGER;
    const rightOrder = typeof right.order === "number" ? right.order : Number.MAX_SAFE_INTEGER;

    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }

    const leftDate = Date.parse(left.updatedAt ?? left.createdAt ?? "");
    const rightDate = Date.parse(right.updatedAt ?? right.createdAt ?? "");
    return (rightDate || 0) - (leftDate || 0);
  });
}

function getCollection(collectionName: string) {
  return getAdminFirestore().collection(collectionName);
}

export async function listDocuments(collectionName: string, sortable = false) {
  const snapshot = await getCollection(collectionName).get();
  const items = snapshot.docs.map((doc) => doc.data() as CmsRecord);
  return sortable ? sortDocuments(items) : items;
}

export async function getDocumentById(collectionName: string, id: string) {
  const doc = await getCollection(collectionName).doc(id).get();
  return doc.exists ? (doc.data() as CmsRecord) : null;
}

export async function createDocument(collectionName: string, data: Record<string, unknown>) {
  const now = new Date().toISOString();
  const id = randomUUID();
  const item: CmsRecord = {
    id,
    ...data,
    createdAt: now,
    updatedAt: now,
  };

  await getCollection(collectionName).doc(id).set(item);
  return item;
}

export async function updateDocument(
  collectionName: string,
  id: string,
  data: Record<string, unknown>
) {
  const ref = getCollection(collectionName).doc(id);
  const existing = await ref.get();
  if (!existing.exists) return null;

  const item: CmsRecord = {
    ...(existing.data() as CmsRecord),
    ...data,
    id,
    updatedAt: new Date().toISOString(),
  };

  await ref.set(item, { merge: true });
  return item;
}

export async function deleteDocument(collectionName: string, id: string) {
  await getCollection(collectionName).doc(id).delete();
}

export async function reorderDocuments(
  collectionName: string,
  items: Array<{ id: string; order: number }>
) {
  const db = getAdminFirestore();
  const batch = db.batch();
  const now = new Date().toISOString();

  for (const item of items) {
    const ref = getCollection(collectionName).doc(item.id);
    batch.set(
      ref,
      {
        order: item.order,
        updatedAt: now,
        id: item.id,
      },
      { merge: true }
    );
  }

  await batch.commit();
}
