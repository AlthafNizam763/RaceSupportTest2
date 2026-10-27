import ImageKit from "@imagekit/nodejs";

export const ALLOWED_IMAGE_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export const ALLOWED_VIDEO_MIMES = new Set([
  "video/mp4",
  "video/webm",
]);

export const MAX_IMAGE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB
export const MAX_VIDEO_SIZE_BYTES = 100 * 1024 * 1024; // 100 MB

export const DEFAULT_MEDIA_FOLDER = "/admin-media";

let imagekitInstance: ImageKit | null = null;

export function getImageKitConfig() {
  const publicKey = process.env.IMAGEKIT_PUBLIC_KEY;
  const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;
  const urlEndpoint = process.env.IMAGEKIT_URL_ENDPOINT;

  if (!publicKey || !privateKey || !urlEndpoint) {
    throw new Error(
      "ImageKit credentials not configured. Please set IMAGEKIT_PUBLIC_KEY, IMAGEKIT_PRIVATE_KEY, and IMAGEKIT_URL_ENDPOINT in your environment."
    );
  }

  return { publicKey, privateKey, urlEndpoint };
}

export function getImageKitClient(): ImageKit {
  if (imagekitInstance) {
    return imagekitInstance;
  }

  const { privateKey } = getImageKitConfig();

  imagekitInstance = new ImageKit({
    privateKey,
  });

  return imagekitInstance;
}

export interface ImageKitAuthParams {
  token: string;
  expire: number;
  signature: string;
  publicKey: string;
  urlEndpoint: string;
}

/**
 * Generate short-lived authentication parameters for secure client-side upload.
 */
export function getUploadAuthParams(): ImageKitAuthParams {
  const ik = getImageKitClient();
  const { publicKey, urlEndpoint } = getImageKitConfig();

  // Expire after 30 minutes
  const expire = Math.floor(Date.now() / 1000) + 30 * 60;
  const auth = ik.helper.getAuthenticationParameters(undefined, expire);

  return {
    token: auth.token,
    expire: auth.expire,
    signature: auth.signature,
    publicKey,
    urlEndpoint,
  };
}

/**
 * Retrieve verified file details directly from ImageKit API using private key.
 */
export async function getVerifiedImageKitFile(fileId: string) {
  const ik = getImageKitClient();
  try {
    const file = await ik.files.get(fileId);
    return file as {
      fileId: string;
      name: string;
      filePath?: string;
      url: string;
      fileType?: string;
      height?: number;
      width?: number;
      size: number;
      mime?: string;
      tags?: string[];
      createdAt?: string;
      updatedAt?: string;
      [key: string]: any;
    };
  } catch (error: any) {
    if (error?.status === 404 || error?.statusCode === 404) {
      return null;
    }
    throw error;
  }
}

/**
 * Delete a file directly from ImageKit using its fileId.
 */
export async function deleteImageKitFile(fileId: string): Promise<boolean> {
  const ik = getImageKitClient();
  try {
    await ik.files.delete(fileId);
    return true;
  } catch (error: any) {
    // If already deleted on ImageKit (404), treat as safe
    if (error?.status === 404 || error?.statusCode === 404) {
      return true;
    }
    throw error;
  }
}

/**
 * Infer MIME type from filename extension if not provided.
 */
export function inferMimeType(fileName: string, providedMime?: string): string {
  if (providedMime && (ALLOWED_IMAGE_MIMES.has(providedMime) || ALLOWED_VIDEO_MIMES.has(providedMime))) {
    return providedMime;
  }

  const ext = fileName.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
    case "mp4":
      return "video/mp4";
    case "webm":
      return "video/webm";
    default:
      return providedMime || "application/octet-stream";
  }
}

/**
 * Validate asset against strict image/video requirements.
 */
export function validateMediaAsset(params: {
  mimeType: string;
  size: number;
  folder?: string;
  expectedFolder?: string;
}) {
  const { mimeType, size, folder, expectedFolder = DEFAULT_MEDIA_FOLDER } = params;

  const isImage = ALLOWED_IMAGE_MIMES.has(mimeType);
  const isVideo = ALLOWED_VIDEO_MIMES.has(mimeType);

  if (!isImage && !isVideo) {
    throw new Error(
      `Unsupported file type "${mimeType}". Allowed types: JPEG, PNG, WEBP, GIF, MP4, WEBM.`
    );
  }

  if (size <= 0) {
    throw new Error("File is empty (0 bytes).");
  }

  if (isImage && size > MAX_IMAGE_SIZE_BYTES) {
    throw new Error(
      `Image size (${(size / (1024 * 1024)).toFixed(2)} MB) exceeds maximum allowed size of 25 MB.`
    );
  }

  if (isVideo && size > MAX_VIDEO_SIZE_BYTES) {
    throw new Error(
      `Video size (${(size / (1024 * 1024)).toFixed(2)} MB) exceeds maximum allowed size of 100 MB.`
    );
  }

  if (folder && expectedFolder) {
    const cleanFolder = folder.replace(/\/+$/, "");
    const cleanExpected = expectedFolder.replace(/\/+$/, "");
    if (cleanFolder !== cleanExpected && !cleanFolder.startsWith(cleanExpected)) {
      throw new Error(`Upload folder "${folder}" does not match authorized folder "${expectedFolder}".`);
    }
  }

  return {
    mediaType: isImage ? ("image" as const) : ("video" as const),
    mimeType,
    size,
  };
}
