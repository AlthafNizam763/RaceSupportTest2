import { upload } from "@imagekit/javascript";
import { apiFetch, jsonRequest } from "@/lib/api/fetcher";

export interface MediaItem {
  id: string;
  title: string;
  fileId: string;
  url: string;
  fileName: string;
  mediaType: "image" | "video";
  mimeType: string;
  size: number;
  folder: string;
  uploadedBy: string;
  uploadedByEmail?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MediaPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

export interface MediaListResponse {
  items: MediaItem[];
  pagination: MediaPagination;
}

export interface ImageKitAuthResponse {
  token: string;
  expire: number;
  signature: string;
  publicKey: string;
  urlEndpoint: string;
}

export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

export const ALLOWED_VIDEO_TYPES = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
];

export const MAX_IMAGE_SIZE = 25 * 1024 * 1024; // 25 MB
export const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100 MB

/**
 * Validate file before initiating upload
 */
export function validateMediaFile(file: File) {
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  const isImage =
    ALLOWED_IMAGE_TYPES.includes(file.type) ||
    ["jpg", "jpeg", "png", "webp", "gif"].includes(ext);
  const isVideo =
    ALLOWED_VIDEO_TYPES.includes(file.type) ||
    ["mp4", "webm", "mov"].includes(ext);

  if (!isImage && !isVideo) {
    throw new Error(
      `Unsupported file "${file.name}". Allowed types: JPEG, PNG, WEBP, GIF, MP4, WEBM, MOV.`
    );
  }

  if (file.size <= 0) {
    throw new Error(`File "${file.name}" is empty (0 bytes).`);
  }

  if (isImage && file.size > MAX_IMAGE_SIZE) {
    throw new Error(
      `Image "${file.name}" (${(file.size / (1024 * 1024)).toFixed(1)} MB) exceeds the 25 MB limit.`
    );
  }

  if (isVideo && file.size > MAX_VIDEO_SIZE) {
    throw new Error(
      `Video "${file.name}" (${(file.size / (1024 * 1024)).toFixed(1)} MB) exceeds the 100 MB limit.`
    );
  }

  return {
    mediaType: isImage ? ("image" as const) : ("video" as const),
    mimeType: file.type || (isImage ? `image/${ext}` : `video/${ext}`),
  };
}

/**
 * Fetch short-lived upload authentication parameters from backend
 */
export async function getMediaAuth(): Promise<ImageKitAuthResponse> {
  return apiFetch<ImageKitAuthResponse>("/api/media/auth");
}

/**
 * Save verified upload metadata into Firestore (single item)
 */
export async function completeMediaUpload(params: {
  fileId: string;
  title?: string;
}): Promise<MediaItem> {
  return apiFetch<MediaItem>("/api/media/complete", {
    method: "POST",
    ...jsonRequest(params),
  });
}

/**
 * Save multiple verified upload records into Firestore in a batch
 */
export async function completeMediaBatchUpload(
  files: Array<{ fileId: string; title?: string }>
): Promise<{ items: MediaItem[]; total: number; errors?: any[] }> {
  return apiFetch<{ items: MediaItem[]; total: number; errors?: any[] }>(
    "/api/media/complete",
    {
      method: "POST",
      ...jsonRequest({ files }),
    }
  );
}

/**
 * List media records with pagination and optional filter
 */
export async function listMedia(params?: {
  page?: number;
  limit?: number;
  mediaType?: "image" | "video";
  search?: string;
  folder?: string;
}): Promise<MediaListResponse> {
  const search = new URLSearchParams();
  if (params?.page) search.set("page", String(params.page));
  if (params?.limit) search.set("limit", String(params.limit));
  if (params?.mediaType) search.set("mediaType", params.mediaType);
  if (params?.search) search.set("search", params.search);
  if (params?.folder) search.set("folder", params.folder);

  const query = search.toString();
  return apiFetch<MediaListResponse>(`/api/media${query ? `?${query}` : ""}`);
}

/**
 * Update media record title
 */
export async function updateMediaTitle(id: string, title: string): Promise<MediaItem> {
  return apiFetch<MediaItem>(`/api/media/${id}`, {
    method: "PATCH",
    ...jsonRequest({ title }),
  });
}

/**
 * Delete media record from Firestore and remote file from ImageKit
 */
export async function deleteMedia(id: string): Promise<{ id: string; fileId: string }> {
  return apiFetch<{ id: string; fileId: string }>(`/api/media/${id}`, {
    method: "DELETE",
  });
}

/**
 * Full client-side upload workflow for a single file
 */
export async function uploadMediaToImageKit(
  file: File,
  title?: string,
  onProgress?: (progressPercent: number) => void
): Promise<MediaItem> {
  // 1. Client-side validation
  validateMediaFile(file);

  // 2. Fetch fresh temporary credentials
  const auth = await getMediaAuth();

  // 3. Upload to ImageKit via official SDK
  const uploadResponse: any = await upload({
    file,
    fileName: file.name,
    token: auth.token,
    signature: auth.signature,
    expire: auth.expire,
    publicKey: auth.publicKey,
    folder: "/admin-media",
    onProgress: (event) => {
      if (onProgress && event.lengthComputable) {
        const percent = Math.round((event.loaded / event.total) * 100);
        onProgress(percent);
      }
    },
  });

  if (!uploadResponse?.fileId) {
    throw new Error("ImageKit upload finished without a valid fileId.");
  }

  // 4. Verify on backend and save to Firestore
  return completeMediaUpload({
    fileId: uploadResponse.fileId,
    title: title?.trim() || file.name.replace(/\.[^/.]+$/, ""),
  });
}
