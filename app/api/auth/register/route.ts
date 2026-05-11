import { NextRequest } from "next/server";

import { registerWithEmailPassword } from "@/lib/server/firebase-auth";
import { errorResponse, successResponse } from "@/lib/server/responses";
import { applySessionCookies } from "@/lib/server/session";

export async function POST(request: NextRequest) {
  try {
    const { name, email, password } = await request.json();

    if (!name || !email || !password) {
      return errorResponse("Name, email, and password are required.", 400);
    }

    const session = await registerWithEmailPassword(name, email, password);
    const response = successResponse(
      { user: session.user },
      "Account created successfully. Verification email sent.",
      201
    );

    return applySessionCookies(response, session, request);
  } catch (error: any) {
    return errorResponse(error.message || "Failed to register account.", error.status || 400);
  }
}
