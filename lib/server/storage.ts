import { promises as fs } from "fs";
import path from "path";

import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";

import { storage } from "@/lib/firebase";

const LOCAL_UPLOAD_ROOT = path.join(process.cwd(), "public", "uploads");

export interface UploadedAsset {
  url: string;
  path: string;
  fileName: string;
  contentType: string;
  size: number;
}

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function buildObjectPath(folder: string, fileName: string) {
  const cleanFolder = folder.replace(/^\/+|\/+$/g, "") || "uploads";
  return `${cleanFolder}/${Date.now()}_${sanitizeFileName(fileName)}`;
}

async function uploadFilesToFirebase(files: File[], folder = "uploads") {
  return Promise.all(
    files.map(async (file) => {
      const objectPath = buildObjectPath(folder, file.name);
      const storageRef = ref(storage, objectPath);
      const bytes = new Uint8Array(await file.arrayBuffer());

      await uploadBytes(storageRef, bytes, {
        contentType: file.type || "application/octet-stream",
        customMetadata: {
          originalName: file.name,
        },
      });

      const url = await getDownloadURL(storageRef);

      return {
        url,
        path: objectPath,
        fileName: file.name,
        contentType: file.type || "application/octet-stream",
        size: file.size,
      } satisfies UploadedAsset;
    })
  );
}

async function uploadFilesLocally(files: File[], folder = "uploads") {
  return Promise.all(
    files.map(async (file) => {
      const objectPath = buildObjectPath(folder, file.name);
      const localPath = path.join(LOCAL_UPLOAD_ROOT, objectPath);

      await fs.mkdir(path.dirname(localPath), { recursive: true });
      await fs.writeFile(localPath, Buffer.from(await file.arrayBuffer()));

      return {
        url: `/uploads/${objectPath}`,
        path: `local:${objectPath}`,
        fileName: file.name,
        contentType: file.type || "application/octet-stream",
        size: file.size,
      } satisfies UploadedAsset;
    })
  );
}

export async function uploadFilesToStorage(files: File[], folder = "uploads") {
  try {
    return await uploadFilesToFirebase(files, folder);
  } catch {
    return uploadFilesLocally(files, folder);
  }
}

async function deleteLocalFile(target: string) {
  const relativePath = target.startsWith("local:") ? target.slice("local:".length) : target.replace(/^\/uploads\//, "");
  const localPath = path.join(LOCAL_UPLOAD_ROOT, relativePath);
  await fs.rm(localPath, { force: true });
}

export async function deleteFileFromStorage(target: string) {
  if (target.startsWith("local:") || target.startsWith("/uploads/")) {
    await deleteLocalFile(target);
    return;
  }

  try {
    const storageRef = ref(storage, target);
    await deleteObject(storageRef);
  } catch {
    await deleteLocalFile(target);
  }
}
