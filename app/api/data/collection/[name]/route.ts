import { NextRequest } from "next/server";

import { getCollectionSnapshot } from "@/lib/server/data-audit";
import { errorResponse, successResponse } from "@/lib/server/responses";
import { applySessionCookies, requireSession } from "@/lib/server/session";

export const runtime = "nodejs";

const VALID_COLLECTIONS = [
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
  "audit_logs",
];

export async function GET(
  request: NextRequest,
  { params }: { params: { name: string } }
) {
  const sessionState = await requireSession(request);
  if (!sessionState) {
    return errorResponse("Unauthorized access.", 401);
  }

  const collectionName = params.name;

  if (!VALID_COLLECTIONS.includes(collectionName)) {
    return errorResponse(
      `Collection "${collectionName}" not found. Valid collections: ${VALID_COLLECTIONS.join(", ")}`,
      404
    );
  }

  try {
    const documents = await getCollectionSnapshot(collectionName);

    const response = successResponse(
      {
        collection: collectionName,
        documentCount: documents.length,
        documents,
      },
      `Retrieved ${documents.length} documents from "${collectionName}" collection.`
    );

    return sessionState.refreshed ? applySessionCookies(response, sessionState.session, request) : response;
  } catch (error: any) {
    return errorResponse(error.message || "Failed to retrieve collection data.", 500);
  }
}
