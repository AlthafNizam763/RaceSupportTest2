import { NextRequest } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/server/firebase-admin";
import { assertAdminSession, applySessionCookies } from "@/lib/server/session";
import { errorResponse, successResponse } from "@/lib/server/responses";
import {
  getVerifiedImageKitFile,
  inferMimeType,
  validateMediaAsset,
  DEFAULT_MEDIA_FOLDER,
} from "@/lib/server/imagekit";

export const dynamic = "force-dynamic";

interface MediaInputItem {
  fileId: string;
  title?: string;
}

async function processSingleFile(
  fileItem: MediaInputItem,
  auth: { user: { uid: string; email?: string | null } },
  db: FirebaseFirestore.Firestore
) {
  const trimmedFileId = fileItem.fileId.trim();
  if (!trimmedFileId) {
    throw new Error("Missing or invalid fileId parameter.");
  }

  // 1. Verify existence and fetch canonical details from ImageKit API
  const ikFile = await getVerifiedImageKitFile(trimmedFileId);
  if (!ikFile) {
    throw new Error(
      `File "${trimmedFileId}" could not be verified on ImageKit or does not exist in this account.`
    );
  }

  // 2. Determine and validate MIME type and size
  const mimeType = inferMimeType(ikFile.name, ikFile.mime);
  const folder = ikFile.filePath
    ? ikFile.filePath.substring(0, ikFile.filePath.lastIndexOf("/")) || DEFAULT_MEDIA_FOLDER
    : DEFAULT_MEDIA_FOLDER;

  const validated = validateMediaAsset({
    mimeType,
    size: ikFile.size,
    folder,
    expectedFolder: DEFAULT_MEDIA_FOLDER,
  });

  const mediaCollection = db.collection("media");

  // 3. Prevent duplicate records in Firestore
  const existingSnapshot = await mediaCollection
    .where("fileId", "==", trimmedFileId)
    .limit(1)
    .get();

  if (!existingSnapshot.empty) {
    const existingDoc = existingSnapshot.docs[0];
    const existingData = existingDoc.data();
    return {
      id: existingDoc.id,
      ...existingData,
      createdAt: existingData.createdAt?.toDate?.()?.toISOString() || existingData.createdAt,
      updatedAt: existingData.updatedAt?.toDate?.()?.toISOString() || existingData.updatedAt,
    };
  }

  // 4. Clean user-provided title or fallback to clean file name
  const cleanTitle = typeof fileItem.title === "string" && fileItem.title.trim()
    ? fileItem.title.trim().slice(0, 200)
    : ikFile.name.replace(/\.[^/.]+$/, "");

  // 5. Store verified metadata in Firestore with actual server timestamps
  const nowServerTimestamp = FieldValue.serverTimestamp();
  const docData = {
    title: cleanTitle,
    fileId: ikFile.fileId,
    url: ikFile.url,
    fileName: ikFile.name,
    mediaType: validated.mediaType,
    mimeType: validated.mimeType,
    size: ikFile.size,
    folder: folder || DEFAULT_MEDIA_FOLDER,
    uploadedBy: auth.user.uid,
    uploadedByEmail: auth.user.email || null,
    createdAt: nowServerTimestamp,
    updatedAt: nowServerTimestamp,
  };

  const docRef = await mediaCollection.add(docData);

  return {
    id: docRef.id,
    ...docData,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export async function POST(request: NextRequest) {
  const auth = await assertAdminSession(request);
  if (!auth.ok) {
    return errorResponse(auth.message, auth.status);
  }

  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return errorResponse("Invalid request body.", 400);
    }

    const db = getAdminFirestore();

    // Check if body is multiple files (either an array directly or { files: [...] })
    const fileList: MediaInputItem[] = Array.isArray(body)
      ? body
      : Array.isArray(body.files)
      ? body.files
      : [];

    const isBatch = fileList.length > 0;

    if (isBatch) {
      // Process multiple files
      const savedItems = [];
      const errors = [];

      for (const item of fileList) {
        if (!item?.fileId) continue;
        try {
          const saved = await processSingleFile(item, auth, db);
          savedItems.push(saved);
        } catch (err: any) {
          console.error(`Error processing file ${item.fileId}:`, err);
          errors.push({ fileId: item.fileId, error: err.message || "Failed to process file." });
        }
      }

      if (savedItems.length === 0 && errors.length > 0) {
        return errorResponse(errors[0].error, 400, { errors });
      }

      const response = successResponse(
        {
          items: savedItems,
          total: savedItems.length,
          errors: errors.length > 0 ? errors : undefined,
        },
        `${savedItems.length} media item(s) saved successfully.`,
        201
      );

      if (auth.sessionState?.refreshed) {
        applySessionCookies(response, auth.sessionState.session, request);
      }

      return response;
    }

    // Single file upload processing
    const { fileId, title } = body as { fileId?: string; title?: string };

    if (!fileId || typeof fileId !== "string" || !fileId.trim()) {
      return errorResponse("Missing or invalid fileId parameter.", 400);
    }

    const savedRecord = await processSingleFile({ fileId, title }, auth, db);
    const response = successResponse(savedRecord, "Media saved successfully.", 201);

    if (auth.sessionState?.refreshed) {
      applySessionCookies(response, auth.sessionState.session, request);
    }

    return response;
  } catch (error: any) {
    console.error("Error completing media upload:", error);
    return errorResponse(error.message || "Failed to process media record.", 500);
  }
}
