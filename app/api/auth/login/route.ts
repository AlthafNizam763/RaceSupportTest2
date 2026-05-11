import { NextRequest } from "next/server";

import { signInWithEmailPassword } from "@/lib/server/firebase-auth";
import { errorResponse, successResponse } from "@/lib/server/responses";
import { applySessionCookies } from "@/lib/server/session";

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return errorResponse("Email and password are required.", 400);
    }

    const session = await signInWithEmailPassword(email, password);
    const response = successResponse({ user: session.user }, "Login successful.");
    return applySessionCookies(response, session, request);
  } catch (error: any) {
    return errorResponse(error.message || "Failed to sign in.", error.status || 400);
  }
}
