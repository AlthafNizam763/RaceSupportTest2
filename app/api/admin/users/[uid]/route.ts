import { NextRequest } from "next/server";
import { getAuth } from "firebase-admin/auth";

import { getAdminApp, getAdminFirestore } from "@/lib/server/firebase-admin";
import { requireAdminSession } from "@/lib/server/session";
import { errorResponse, successResponse } from "@/lib/server/responses";
import { AdminUserUpdateSchema } from "@/lib/api/schemas";

export const runtime = "nodejs";

const getAdminAuth = () => getAuth(getAdminApp());

export async function PATCH(
  request: NextRequest,
  { params }: { params: { uid: string } }
) {
  const sessionState = await requireAdminSession(request);
  if (!sessionState) {
    return errorResponse("Permission denied. Admin role required.", 403);
  }

  const currentUid = sessionState.session.user.uid;
  const targetUid = params.uid;

  if (currentUid === targetUid) {
    return errorResponse("Action denied. You cannot modify your own admin account.", 400);
  }

  try {
    const body = await request.json();
    const parsed = AdminUserUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse("Validation failed.", 400, parsed.error.flatten());
    }

    const { role, disabled } = parsed.data;
    const auth = getAdminAuth();
    const db = getAdminFirestore();

    // If disabled flag is provided, update Firebase Auth
    if (disabled !== undefined) {
      await auth.updateUser(targetUid, { disabled });
    }

    // If role is provided, update Firestore
    if (role !== undefined) {
      await db.collection("users").doc(targetUid).update({
        role,
        updatedAt: new Date().toISOString(),
      });
    }

    return successResponse(null, "User updated successfully.");
  } catch (error: any) {
    return errorResponse(error.message || "Failed to update user.", 500);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { uid: string } }
) {
  const sessionState = await requireAdminSession(request);
  if (!sessionState) {
    return errorResponse("Permission denied. Admin role required.", 403);
  }

  const currentUid = sessionState.session.user.uid;
  const targetUid = params.uid;

  if (currentUid === targetUid) {
    return errorResponse("Action denied. You cannot delete your own admin account.", 400);
  }

  try {
    const auth = getAdminAuth();
    const db = getAdminFirestore();

    // Delete from Firebase Auth
    await auth.deleteUser(targetUid);

    // Delete profile from Firestore
    await db.collection("users").doc(targetUid).delete();

    return successResponse(null, "User deleted successfully.");
  } catch (error: any) {
    return errorResponse(error.message || "Failed to delete user.", 500);
  }
}
