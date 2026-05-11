import { NextRequest } from "next/server";

import { confirmPasswordReset, verifyPasswordResetCode } from "@/lib/server/firebase-auth";
import { errorResponse, successResponse } from "@/lib/server/responses";

export async function POST(request: NextRequest) {
  try {
    const { oobCode } = await request.json();
    if (!oobCode) {
      return errorResponse("Reset code is required.", 400);
    }

    const result = await verifyPasswordResetCode(oobCode);
    return successResponse({ email: result.email }, "Reset code verified.");
  } catch (error: any) {
    return errorResponse(error.message || "Reset code is invalid.", error.status || 400);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { oobCode, newPassword } = await request.json();
    if (!oobCode || !newPassword) {
      return errorResponse("Reset code and new password are required.", 400);
    }

    const result = await confirmPasswordReset(oobCode, newPassword);
    return successResponse({ email: result.email }, "Password reset successfully.");
  } catch (error: any) {
    return errorResponse(error.message || "Failed to reset password.", error.status || 400);
  }
}
