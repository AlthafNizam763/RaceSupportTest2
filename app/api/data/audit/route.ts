import { NextRequest } from "next/server";

import { getAuditLogs } from "@/lib/server/data-audit";
import { errorResponse, successResponse } from "@/lib/server/responses";
import { applySessionCookies, requireSession } from "@/lib/server/session";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const sessionState = await requireSession(request);
  if (!sessionState) {
    return errorResponse("Unauthorized access.", 401);
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const collectionName = searchParams.get("collection") || undefined;
    const operation = (searchParams.get("operation") as any) || undefined;
    const documentId = searchParams.get("documentId") || undefined;
    const limit = parseInt(searchParams.get("limit") || "100");

    const logs = await getAuditLogs({
      collectionName,
      operation,
      documentId,
      limit,
    });

    const response = successResponse(
      {
        total: logs.length,
        logs,
      },
      "Audit logs retrieved successfully."
    );

    return sessionState.refreshed ? applySessionCookies(response, sessionState.session, request) : response;
  } catch (error: any) {
    return errorResponse(error.message || "Failed to retrieve audit logs.", 500);
  }
}
