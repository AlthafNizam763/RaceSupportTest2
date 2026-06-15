import { NextRequest } from "next/server";

import { errorResponse, successResponse } from "@/lib/server/responses";
import { applySessionCookies, requireSession, requireWriteAccess } from "@/lib/server/session";
import { deleteFileFromStorage, uploadFilesToStorage } from "@/lib/server/storage";

const ALLOWED_TYPES = new Set([
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4",
  "video/quicktime",
  "video/webm",
]);

const MAX_FILE_SIZE = 50 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const sessionState = await requireSession(request);
  if (!sessionState) {
    return errorResponse("Unauthorized access.", 401);
  }

  const writeState = await requireWriteAccess(request);
  if (!writeState) {
    return errorResponse("Permission denied. Viewers cannot modify content.", 403);
  }

  try {
    const formData = await request.formData();
    const folder = String(formData.get("folder") || "uploads");
    const files = formData.getAll("files").filter((value): value is File => value instanceof File);

    if (files.length === 0) {
      return errorResponse("No files were provided.", 400);
    }

    for (const file of files) {
      if (!ALLOWED_TYPES.has(file.type)) {
        return errorResponse(`File type ${file.type} is not supported.`, 400);
      }

      if (file.size > MAX_FILE_SIZE) {
        return errorResponse(`File ${file.name} exceeds the 50MB limit.`, 400);
      }
    }

    const uploadedFiles = await uploadFilesToStorage(files, folder);
    const response = successResponse(uploadedFiles, "Files uploaded successfully.", 201);
    return sessionState.refreshed ? applySessionCookies(response, sessionState.session, request) : response;
  } catch (error: any) {
    return errorResponse(error.message || "Failed to upload files.", 500);
  }
}

export async function DELETE(request: NextRequest) {
  const sessionState = await requireSession(request);
  if (!sessionState) {
    return errorResponse("Unauthorized access.", 401);
  }

  const writeState = await requireWriteAccess(request);
  if (!writeState) {
    return errorResponse("Permission denied. Viewers cannot modify content.", 403);
  }

  try {
    const { target } = await request.json();
    if (!target) {
      return errorResponse("Target file is required.", 400);
    }

    await deleteFileFromStorage(target);
    const response = successResponse(null, "File deleted successfully.");
    return sessionState.refreshed ? applySessionCookies(response, sessionState.session, request) : response;
  } catch (error: any) {
    return errorResponse(error.message || "Failed to delete file.", 500);
  }
}
