import { NextRequest } from "next/server";
import { getAdminFirestore } from "@/lib/server/firebase-admin";
import { assertAdminSession, applySessionCookies } from "@/lib/server/session";
import { errorResponse, successResponse } from "@/lib/server/responses";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await assertAdminSession(request);
  if (!auth.ok) {
    return errorResponse(auth.message, auth.status);
  }

  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
    const mediaType = searchParams.get("mediaType"); // optional filter: 'image' | 'video'

    const db = getAdminFirestore();
    let query: FirebaseFirestore.Query = db.collection("media");

    if (mediaType && (mediaType === "image" || mediaType === "video")) {
      query = query.where("mediaType", "==", mediaType);
    }

    // Order by createdAt descending
    query = query.orderBy("createdAt", "desc");

    // Fetch snapshot
    const totalSnapshot = await query.get();
    const totalCount = totalSnapshot.size;

    const offset = (page - 1) * limit;
    const paginatedSnapshot = await query.offset(offset).limit(limit).get();

    const items = paginatedSnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        title: data.title || "",
        fileId: data.fileId || "",
        url: data.url || "",
        fileName: data.fileName || "",
        mediaType: data.mediaType || "image",
        mimeType: data.mimeType || "",
        size: data.size || 0,
        folder: data.folder || "/admin-media",
        uploadedBy: data.uploadedBy || "",
        uploadedByEmail: data.uploadedByEmail || null,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt || null,
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt || null,
      };
    });

    const response = successResponse(
      {
        items,
        pagination: {
          page,
          limit,
          total: totalCount,
          totalPages: Math.ceil(totalCount / limit) || 1,
          hasMore: offset + items.length < totalCount,
        },
      },
      "Media items retrieved successfully."
    );

    if (auth.sessionState?.refreshed) {
      applySessionCookies(response, auth.sessionState.session, request);
    }

    return response;
  } catch (error: any) {
    console.error("Error retrieving media items:", error);
    return errorResponse(error.message || "Failed to retrieve media items.", 500);
  }
}
