import { NextRequest } from "next/server";

import { listDocuments, createDocument } from "@/lib/server/firestore";
import { resolveCmsCollection } from "@/lib/server/cms-config";
import { errorResponse, successResponse } from "@/lib/server/responses";
import { applySessionCookies, requireSession } from "@/lib/server/session";

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

  try {
    const body = await request.json();
    const parsed = collectionConfig.schema.safeParse(body);

    if (!parsed.success) {
      return errorResponse("Validation failed.", 400, parsed.error.flatten());
    }

    const item = await createDocument(collectionConfig.collectionName, parsed.data);
    const response = successResponse(item, `Created ${collectionConfig.key} successfully.`, 201);
    return sessionState.refreshed ? applySessionCookies(response, sessionState.session, request) : response;
  } catch (error: any) {
    return errorResponse(error.message || "Failed to create item.", 500);
  }
}
