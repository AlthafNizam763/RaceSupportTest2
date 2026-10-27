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
];

export const MAX_IMAGE_SIZE = 25 * 1024 * 1024; // 25 MB
export const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100 MB

/**
 * Validate file before initiating upload
 */
export function validateMediaFile(file: File) {
  const isImage = ALLOWED_IMAGE_TYPES.includes(file.type);
  const isVideo = ALLOWED_VIDEO_TYPES.includes(file.type);

  if (!isImage && !isVideo) {
    throw new Error(
      `Unsupported file type "${file.type || file.name}". Allowed types: JPEG, PNG, WEBP, GIF, MP4, WEBM.`
    );
  }

  if (file.size <= 0) {
    throw new Error("The selected file is empty (0 bytes).");
  }

  if (isImage && file.size > MAX_IMAGE_SIZE) {
    throw new Error(
      `Image size (${(file.size / (1024 * 1024)).toFixed(1)} MB) exceeds the 25 MB limit.`
    );
  }

  if (isVideo && file.size > MAX_VIDEO_SIZE) {
    throw new Error(
      `Video size (${(file.size / (1024 * 1024)).toFixed(1)} MB) exceeds the 100 MB limit.`
    );
  }

  return {
    mediaType: isImage ? ("image" as const) : ("video" as const),
    mimeType: file.type,
  };
}

/**
 * Fetch short-lived upload authentication parameters from backend
 */
export async function getMediaAuth(): Promise<ImageKitAuthResponse> {
  return apiFetch<ImageKitAuthResponse>("/api/media/auth");
}

/**
 * Save verified upload metadata into Firestore
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
 * List media records with pagination and optional filter
 */
export async function listMedia(params?: {
  page?: number;
  limit?: number;
  mediaType?: "image" | "video";
}): Promise<MediaListResponse> {
  const search = new URLSearchParams();
  if (params?.page) search.set("page", String(params.page));
  if (params?.limit) search.set("limit", String(params.limit));
  if (params?.mediaType) search.set("mediaType", params.mediaType);

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
 * Full client-side upload workflow:
 * 1. Validate file type and size
 * 2. Fetch fresh auth parameters
 * 3. Upload directly to ImageKit with progress tracking
 * 4. Complete registration in Firestore
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
