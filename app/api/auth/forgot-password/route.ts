import { NextRequest } from "next/server";

import { sendPasswordResetEmail } from "@/lib/server/firebase-auth";
import { errorResponse, successResponse } from "@/lib/server/responses";

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return errorResponse("Email is required.", 400);
    }

    await sendPasswordResetEmail(email);
    return successResponse(null, "Password reset email sent.");
  } catch (error: any) {
    return errorResponse(error.message || "Failed to send reset email.", error.status || 400);
  }
}
