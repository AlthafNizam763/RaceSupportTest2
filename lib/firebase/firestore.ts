import { emitCollectionMutation } from "@/lib/api/events";
import { apiFetch, jsonRequest } from "@/lib/api/fetcher";

export async function createDocument(collectionName: string, data: Record<string, unknown>) {
  const result = await apiFetch<Record<string, unknown>>(`/api/cms/${collectionName}`, {
    method: "POST",
    ...jsonRequest(data),
  });

  emitCollectionMutation(collectionName);
  return result;
}

export async function updateDocument(
  collectionName: string,
  docId: string,
  data: Record<string, unknown>
) {
  const result = await apiFetch<Record<string, unknown>>(`/api/cms/${collectionName}/${docId}`, {
    method: "PATCH",
    ...jsonRequest(data),
  });

  emitCollectionMutation(collectionName);
  return result;
}

export async function deleteDocument(collectionName: string, docId: string) {
  await apiFetch<null>(`/api/cms/${collectionName}/${docId}`, {
    method: "DELETE",
  });

  emitCollectionMutation(collectionName);
  return true;
}

export async function getDocument(collectionName: string, docId: string) {
  return apiFetch<Record<string, unknown>>(`/api/cms/${collectionName}/${docId}`);
}

export async function getDocuments(collectionName: string) {
  return apiFetch<Array<Record<string, unknown>>>(`/api/cms/${collectionName}`);
}

export async function updateOrderBatch(
  collectionName: string,
  updates: Array<{ id: string; order: number }>
) {
  await apiFetch<null>(`/api/cms/${collectionName}/reorder`, {
    method: "POST",
    ...jsonRequest(updates),
  });

  emitCollectionMutation(collectionName);
  return true;
}
