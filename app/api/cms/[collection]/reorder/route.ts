import { NextRequest } from "next/server";

import { ReorderSchema } from "@/lib/api/schemas";
import { resolveCmsCollection } from "@/lib/server/cms-config";
import { reorderDocuments } from "@/lib/server/firestore";
import { errorResponse, successResponse } from "@/lib/server/responses";
import { applySessionCookies, requireSession } from "@/lib/server/session";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: { collection: string } }
) {
  const collectionConfig = resolveCmsCollection(params.collection);
  if (!collectionConfig) {
    return errorResponse("Collection not found.", 404);
  }

  if (!collectionConfig.sortable) {
    return errorResponse("This collection does not support reordering.", 400);
  }

  const sessionState = await requireSession(request);
  if (!sessionState) {
    return errorResponse("Unauthorized access.", 401);
  }

  try {
    const body = await request.json();
    const parsed = ReorderSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse("Validation failed.", 400, parsed.error.flatten());
    }

    await reorderDocuments(collectionConfig.collectionName, parsed.data);
    const response = successResponse(null, `Saved ${collectionConfig.key} order successfully.`);
    return sessionState.refreshed ? applySessionCookies(response, sessionState.session, request) : response;
  } catch (error: any) {
    return errorResponse(error.message || "Failed to reorder items.", 500);
  }
}
