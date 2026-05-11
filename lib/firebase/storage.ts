import { apiFetch } from "@/lib/api/fetcher";

interface UploadedAsset {
  url: string;
  path: string;
  fileName: string;
  contentType: string;
  size: number;
}

export async function uploadFiles(files: File[], folder: string): Promise<UploadedAsset[]> {
  const formData = new FormData();
  formData.set("folder", folder);

  files.forEach((file) => {
    formData.append("files", file);
  });

  return apiFetch<UploadedAsset[]>("/api/upload", {
    method: "POST",
    body: formData,
  });
}

export async function uploadImage(file: File, folder: string): Promise<string> {
  const [asset] = await uploadFiles([file], folder);
  return asset.url;
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
