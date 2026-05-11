import { NextRequest } from "next/server";

import { applyEmailVerification, sendVerificationEmail } from "@/lib/server/firebase-auth";
import { errorResponse, successResponse } from "@/lib/server/responses";
import { applySessionCookies, getSessionState } from "@/lib/server/session";

export async function POST(request: NextRequest) {
  const state = await getSessionState(request);
  if (!state.session) {
    return errorResponse("You must be signed in to resend verification email.", 401);
  }

  try {
    await sendVerificationEmail(state.session.tokens.idToken);
    const response = successResponse(null, "Verification email sent.");
    return state.refreshed ? applySessionCookies(response, state.session, request) : response;
  } catch (error: any) {
    return errorResponse(error.message || "Failed to send verification email.", error.status || 400);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { oobCode } = await request.json();
    if (!oobCode) {
      return errorResponse("Verification code is required.", 400);
    }

    const result = await applyEmailVerification(oobCode);
    const state = await getSessionState(request);
    const response = successResponse(
      {
        email: result.email,
        user: state.session?.user ?? null,
      },
      "Email verified successfully."
    );

    return state.session && state.refreshed ? applySessionCookies(response, state.session, request) : response;
  } catch (error: any) {
    return errorResponse(error.message || "Failed to verify email.", error.status || 400);
  }
}
