import { NextRequest, NextResponse } from "next/server";
import { assertAdminSession, applySessionCookies } from "@/lib/server/session";
import { errorResponse, successResponse } from "@/lib/server/responses";
import { getUploadAuthParams } from "@/lib/server/imagekit";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await assertAdminSession(request);
  if (!auth.ok) {
    return errorResponse(auth.message, auth.status);
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

    if (auth.sessionState?.refreshed) {
      applySessionCookies(response, auth.sessionState.session, request);
    }

    return response;
  } catch (error: any) {
    console.error("ImageKit auth error:", error);
    return errorResponse(error.message || "Failed to generate upload authorization.", 500);
  }
}
