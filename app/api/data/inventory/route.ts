import { NextRequest } from "next/server";

import { getDataInventory, getAuditLogs } from "@/lib/server/data-audit";
import { errorResponse, successResponse } from "@/lib/server/responses";
import { applySessionCookies, requireSession } from "@/lib/server/session";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const sessionState = await requireSession(request);
  if (!sessionState) {
    return errorResponse("Unauthorized access.", 401);
  }

  try {
    const inventory = await getDataInventory();
    const totalDocuments = inventory.reduce((sum, item) => sum + item.documentCount, 0);

    const response = successResponse(
      {
        totalCollections: inventory.length,
        totalDocuments,
        collections: inventory,
      },
      "Data inventory retrieved successfully."
    );

    return sessionState.refreshed ? applySessionCookies(response, sessionState.session, request) : response;
  } catch (error: any) {
    return errorResponse(error.message || "Failed to retrieve data inventory.", 500);
  }
}
