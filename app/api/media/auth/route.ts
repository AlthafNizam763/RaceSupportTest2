import { NextRequest } from "next/server";
import { requireWriteAccess, assertAdminSession, applySessionCookies } from "@/lib/server/session";
import { errorResponse, successResponse } from "@/lib/server/responses";
import { getUploadAuthParams } from "@/lib/server/imagekit";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  // Allow all users with write access (admin and editor) as well as integration keys
  const writeSession = await requireWriteAccess(request);
  let refreshedSession = writeSession?.refreshed ? writeSession.session : null;

  if (!writeSession) {
    // Check if integration key admin is present
    const adminCheck = await assertAdminSession(request);
    if (!adminCheck.ok) {
      return errorResponse(adminCheck.message || "Permission denied. You must be an administrator or editor to upload media.", adminCheck.status || 403);
    }
    if (adminCheck.sessionState?.refreshed) {
      refreshedSession = adminCheck.sessionState.session;
    }
  }

  try {
    const authParams = getUploadAuthParams();

    const response = successResponse(
      authParams,
      "Upload authentication parameters generated."
    );

    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    response.headers.set("Pragma", "no-cache");
    response.headers.set("Expires", "0");

    if (refreshedSession) {
      applySessionCookies(response, refreshedSession, request);
    }

    return response;
  } catch (error: any) {
    console.error("ImageKit auth error:", error);
    return errorResponse(error.message || "Failed to generate upload authorization.", 500);
  }
}
