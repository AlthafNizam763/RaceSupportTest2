import { NextRequest } from "next/server";
import { getAdminFirestore } from "@/lib/server/firebase-admin";
import { assertAdminSession } from "@/lib/server/session";
import { errorResponse, successResponse } from "@/lib/server/responses";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await assertAdminSession(request);
  if (!auth.ok) {
    return errorResponse(auth.message, auth.status);
  }

  try {
    const db = getAdminFirestore();
    const mediaCountSnap = await db.collection("media").limit(1).get();

    return successResponse(
      {
        status: "connected",
        service: "Race Support CMS Media API",
        version: "1.0.0",
        timestamp: new Date().toISOString(),
        user: auth.user.email || auth.user.uid,
        hasMedia: !mediaCountSnap.empty,
      },
      "Connection to Race Support CMS is active and healthy."
    );
  } catch (error: any) {
    console.error("Integration health check error:", error);
    return errorResponse(error.message || "Failed to connect to database.", 500);
  }
}
