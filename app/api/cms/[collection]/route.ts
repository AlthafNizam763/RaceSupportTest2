import { NextRequest } from "next/server";

import { listDocuments, createDocument, createDocuments, updateDocument } from "@/lib/server/firestore";
import { resolveCmsCollection } from "@/lib/server/cms-config";
import { errorResponse, successResponse } from "@/lib/server/responses";
import { applySessionCookies, requireSession, requireWriteAccess } from "@/lib/server/session";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: { collection: string } }
) {
  const collectionConfig = resolveCmsCollection(params.collection);
  if (!collectionConfig) {
    return errorResponse("Collection not found.", 404);
  }

  const sessionState = await requireSession(request);
  if (!sessionState) {
    return errorResponse("Unauthorized access.", 401);
  }

  try {
    const items = await listDocuments(collectionConfig.collectionName, collectionConfig.sortable);
    const response = successResponse(items, `Fetched ${collectionConfig.key} successfully.`);
    return sessionState.refreshed ? applySessionCookies(response, sessionState.session, request) : response;
  } catch (error: any) {
    return errorResponse(error.message || "Failed to fetch collection.", 500);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { collection: string } }
) {
  const collectionConfig = resolveCmsCollection(params.collection);
  if (!collectionConfig) {
    return errorResponse("Collection not found.", 404);
  }

  const sessionState = await requireSession(request);
  if (!sessionState) {
    return errorResponse("Unauthorized access.", 401);
  }

  const writeState = await requireWriteAccess(request);
  if (!writeState) {
    return errorResponse("Permission denied. Viewers cannot modify content.", 403);
  }

  try {
    const body = await request.json();

    // Check for batch array of items
    const rawItems = Array.isArray(body)
      ? body
      : Array.isArray((body as any)?.items)
      ? (body as any).items
      : null;

    if (rawItems) {
      if (rawItems.length === 0) {
        return errorResponse("Items array cannot be empty.", 400);
      }
      const validatedItems: Record<string, unknown>[] = [];
      for (let i = 0; i < rawItems.length; i++) {
        const itemResult = collectionConfig.schema.safeParse(rawItems[i]);
        if (!itemResult.success) {
          return errorResponse(`Item at index ${i} failed validation.`, 400, itemResult.error.flatten());
        }
        validatedItems.push(itemResult.data);
      }
      const createdItems = await createDocuments(collectionConfig.collectionName, validatedItems);
      const response = successResponse(
        createdItems,
        `Created ${createdItems.length} ${collectionConfig.key} items successfully.`,
        201
      );
      return sessionState.refreshed ? applySessionCookies(response, sessionState.session, request) : response;
    }

    // Single item handling
    const parsed = collectionConfig.schema.safeParse(body);

    if (!parsed.success) {
      return errorResponse("Validation failed.", 400, parsed.error.flatten());
    }

    // For singleton collections (e.g. settings), upsert into the existing document
    if (collectionConfig.singleton) {
      const existing = await listDocuments(collectionConfig.collectionName);
      if (existing.length > 0) {
        const existingId = (existing[0] as any).id as string;
        const item = await updateDocument(collectionConfig.collectionName, existingId, parsed.data);
        const response = successResponse(item, `Updated ${collectionConfig.key} settings successfully.`);
        return sessionState.refreshed ? applySessionCookies(response, sessionState.session, request) : response;
      }
    }

    const item = await createDocument(collectionConfig.collectionName, parsed.data);
    const response = successResponse(item, `Created ${collectionConfig.key} successfully.`, 201);
    return sessionState.refreshed ? applySessionCookies(response, sessionState.session, request) : response;
  } catch (error: any) {
    return errorResponse(error.message || "Failed to create item.", 500);
  }
}
