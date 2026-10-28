import { upload } from "@imagekit/javascript";
import { apiFetch } from "@/lib/api/fetcher";
import { getMediaAuth } from "@/lib/api/media";

export interface UploadedAsset {
  url: string;
  path: string;
  fileName: string;
  contentType: string;
  size: number;
}

const VERCEL_MAX_PAYLOAD_BYTES = 4.2 * 1024 * 1024; // 4.2 MB (Vercel hard ceiling is 4.5 MB)

/**
 * Upload multiple files to storage.
 * Prioritizes direct browser-to-ImageKit upload to bypass Vercel's 4.5MB Serverless Function payload limit (FUNCTION_PAYLOAD_TOO_LARGE / 413).
 */
export async function uploadFiles(files: File[], folder: string): Promise<UploadedAsset[]> {
  if (!files || files.length === 0) return [];

  const cleanFolder = folder.startsWith("/") ? folder : `/${folder}`;
  let imageKitAuthError: Error | null = null;

  // 1. Direct browser-to-ImageKit upload (Bypasses Vercel Serverless Function 4.5MB limit)
  try {
    const assets = await Promise.all(
      files.map(async (file) => {
        // Fetch fresh single-use authentication parameters for each file
        const auth = await getMediaAuth();

        const uploadResponse: any = await upload({
          file,
          fileName: file.name,
          token: auth.token,
          signature: auth.signature,
          expire: auth.expire,
          publicKey: auth.publicKey,
          folder: cleanFolder,
        });

        if (!uploadResponse?.url) {
          throw new Error(`Upload to ImageKit succeeded but returned no URL for "${file.name}"`);
        }

        return {
          url: uploadResponse.url,
          path: `imagekit:${uploadResponse.fileId || ""}`,
          fileName: uploadResponse.name || file.name,
          contentType: file.type || "application/octet-stream",
          size: uploadResponse.size || file.size,
        } satisfies UploadedAsset;
      })
    );

    return assets;
  } catch (err: any) {
    imageKitAuthError = err;
    console.error("Direct ImageKit client upload failed:", err?.message || err);
  }

  // 2. Check if any file exceeds Vercel Serverless Function payload limit before attempting fallback
  const oversizedFile = files.find((f) => f.size > VERCEL_MAX_PAYLOAD_BYTES);
  if (oversizedFile) {
    throw new Error(
      `Direct cloud upload failed (${imageKitAuthError?.message || "ImageKit unavailable"}). ` +
      `Cannot upload "${oversizedFile.name}" (${(oversizedFile.size / (1024 * 1024)).toFixed(1)} MB) via server route ` +
      `because Vercel Serverless Functions enforce a 4.5 MB payload limit (FUNCTION_PAYLOAD_TOO_LARGE). ` +
      `Please ensure IMAGEKIT_PUBLIC_KEY, IMAGEKIT_PRIVATE_KEY, and IMAGEKIT_URL_ENDPOINT are configured in your Vercel Project Environment Variables.`
    );
  }

  // 3. Fallback for smaller files: Upload files individually to /api/upload
  return Promise.all(
    files.map(async (file) => {
      const formData = new FormData();
      formData.set("folder", folder);
      formData.append("files", file);

      const [asset] = await apiFetch<UploadedAsset[]>("/api/upload", {
        method: "POST",
        body: formData,
      });

      return asset;
    })
  );
}

export async function uploadImage(file: File, folder: string): Promise<string> {
  const [asset] = await uploadFiles([file], folder);
  return asset.url;
}

export async function uploadImages(files: File[], folder: string): Promise<UploadedAsset[]> {
  return uploadFiles(files, folder);
}

export async function deleteImage(target: string): Promise<void> {
  await apiFetch<null>("/api/upload", {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ target }),
  });
}
