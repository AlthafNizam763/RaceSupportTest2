import { NextRequest } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/server/firebase-admin";
import { assertAdminSession, applySessionCookies } from "@/lib/server/session";
import { errorResponse, successResponse } from "@/lib/server/responses";
import { deleteImageKitFile } from "@/lib/server/imagekit";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: {
    id: string;
  };
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const auth = await assertAdminSession(request);
  if (!auth.ok) {
    return errorResponse(auth.message, auth.status);
  }

  const { id } = params;
  if (!id || typeof id !== "string") {
    return errorResponse("Missing document id.", 400);
  }

  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return errorResponse("Invalid request body.", 400);
    }

    const { title } = body as { title?: string };

    if (typeof title !== "string" || !title.trim()) {
      return errorResponse("A valid non-empty title is required.", 400);
    }

    const cleanTitle = title.trim().slice(0, 200);

    const db = getAdminFirestore();
    const docRef = db.collection("media").doc(id);
    const docSnapshot = await docRef.get();

    if (!docSnapshot.exists) {
      return errorResponse("Media record not found.", 404);
    }

    const updateData = {
      title: cleanTitle,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: auth.user.uid,
    };

    await docRef.update(updateData);

    const updatedSnapshot = await docRef.get();
    const updatedData = updatedSnapshot.data() || {};

    const response = successResponse(
      {
        id: updatedSnapshot.id,
        ...updatedData,
        createdAt: updatedData.createdAt?.toDate?.()?.toISOString() || updatedData.createdAt || null,
        updatedAt: updatedData.updatedAt?.toDate?.()?.toISOString() || updatedData.updatedAt || null,
      },
      "Media updated successfully."
    );

    if (auth.sessionState?.refreshed) {
      applySessionCookies(response, auth.sessionState.session, request);
    }

    return response;
  } catch (error: any) {
    console.error("Error updating media:", error);
    return errorResponse(error.message || "Failed to update media.", 500);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const auth = await assertAdminSession(request);
  if (!auth.ok) {
    return errorResponse(auth.message, auth.status);
  }

  const { id } = params;
  if (!id || typeof id !== "string") {
    return errorResponse("Missing document id.", 400);
  }

  try {
    const db = getAdminFirestore();
    const docRef = db.collection("media").doc(id);
    const docSnapshot = await docRef.get();

    if (!docSnapshot.exists) {
      return errorResponse("Media record not found.", 404);
    }

    const mediaData = docSnapshot.data() || {};
    const trustedFileId = mediaData.fileId;

    // 1. Delete asset from ImageKit via server API if fileId is present
    if (trustedFileId && typeof trustedFileId === "string") {
      try {
        await deleteImageKitFile(trustedFileId);
      } catch (ikError: any) {
        console.error("Failed to delete file from ImageKit:", ikError);
        // Only abort if it's an unauthorized or configuration issue
        if (ikError?.status === 401 || ikError?.status === 403) {
          return errorResponse("Failed to authenticate with ImageKit during deletion.", 500);
        }
      }
    }

    // 2. Delete Firestore record
    await docRef.delete();

    const response = successResponse(
      { id, fileId: trustedFileId },
      "Media item and remote asset deleted successfully."
    );

    if (auth.sessionState?.refreshed) {
      applySessionCookies(response, auth.sessionState.session, request);
    }

    return response;
  } catch (error: any) {
    console.error("Error deleting media:", error);
    return errorResponse(error.message || "Failed to delete media.", 500);
  }
}
