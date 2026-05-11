import { NextRequest } from "next/server";

import { resolveCmsCollection } from "@/lib/server/cms-config";
import { deleteDocument, getDocumentById, updateDocument } from "@/lib/server/firestore";
import { errorResponse, successResponse } from "@/lib/server/responses";
import { applySessionCookies, requireSession } from "@/lib/server/session";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: { collection: string; id: string } }
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
    const item = await getDocumentById(collectionConfig.collectionName, params.id);
    if (!item) {
      return errorResponse("Item not found.", 404);
    }

    const response = successResponse(item, "Item fetched successfully.");
    return sessionState.refreshed ? applySessionCookies(response, sessionState.session, request) : response;
  } catch (error: any) {
    return errorResponse(error.message || "Failed to fetch item.", 500);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { collection: string; id: string } }
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
    const body = await request.json();
    const parsed = collectionConfig.schema.partial().safeParse(body);

    if (!parsed.success) {
      return errorResponse("Validation failed.", 400, parsed.error.flatten());
    }

    const item = await updateDocument(collectionConfig.collectionName, params.id, parsed.data);
    const response = successResponse(item, "Item updated successfully.");
    return sessionState.refreshed ? applySessionCookies(response, sessionState.session, request) : response;
  } catch (error: any) {
    return errorResponse(error.message || "Failed to update item.", 500);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { collection: string; id: string } }
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
    await deleteDocument(collectionConfig.collectionName, params.id);
    const response = successResponse(null, "Item deleted successfully.");
    return sessionState.refreshed ? applySessionCookies(response, sessionState.session, request) : response;
  } catch (error: any) {
    return errorResponse(error.message || "Failed to delete item.", 500);
  }
}
