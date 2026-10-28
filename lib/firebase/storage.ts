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

/**
 * Upload multiple files to storage.
 * Prioritizes direct browser-to-ImageKit upload to bypass Vercel's 4.5MB Serverless Function payload limit (FUNCTION_PAYLOAD_TOO_LARGE / 413).
 * Falls back to /api/upload with per-file requests if ImageKit client upload is unavailable.
 */
export async function uploadFiles(files: File[], folder: string): Promise<UploadedAsset[]> {
  if (!files || files.length === 0) return [];

  const cleanFolder = folder.startsWith("/") ? folder : `/${folder}`;

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
          throw new Error(`Upload to ImageKit succeeded but returned no URL for ${file.name}`);
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
  } catch (imageKitError: any) {
    console.warn(
      "Direct ImageKit client upload failed, attempting fallback via /api/upload:",
      imageKitError?.message || imageKitError
    );
  }

  // 2. Fallback: Upload individual files to /api/upload to avoid monolithic multi-file payload spikes
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
