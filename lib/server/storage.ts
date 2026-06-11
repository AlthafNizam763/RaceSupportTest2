import { promises as fs } from "fs";
import path from "path";

import { getAdminApp } from "@/lib/server/firebase-admin";

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

function getAdminStorage() {
  // Dynamically require firebase-admin/storage to avoid bundler issues
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { getStorage } = require("firebase-admin/storage");
  return getStorage(getAdminApp());
}

function getStorageBucket() {
  const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  if (!bucketName) {
    throw new Error("Missing NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET environment variable.");
  }
  return getAdminStorage().bucket(bucketName);
}

async function uploadFilesToFirebase(files: File[], folder = "uploads"): Promise<UploadedAsset[]> {
  const bucket = getStorageBucket();

  return Promise.all(
    files.map(async (file) => {
      const objectPath = buildObjectPath(folder, file.name);
      const buffer = Buffer.from(await file.arrayBuffer());
      const fileRef = bucket.file(objectPath);

      await fileRef.save(buffer, {
        contentType: file.type || "application/octet-stream",
        metadata: {
          metadata: {
            originalName: file.name,
          },
        },
      });

      // Make file publicly readable and get the download URL
      await fileRef.makePublic();
      const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!;
      const url = `https://storage.googleapis.com/${bucketName}/${objectPath}`;

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

async function uploadFilesLocally(files: File[], folder = "uploads"): Promise<UploadedAsset[]> {
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

export async function uploadFilesToStorage(files: File[], folder = "uploads"): Promise<UploadedAsset[]> {
  try {
    return await uploadFilesToFirebase(files, folder);
  } catch (error: any) {
    console.error("Firebase Storage upload failed, attempting local fallback:", error?.message || error);
    return uploadFilesLocally(files, folder);
  }
}

async function deleteLocalFile(target: string) {
  const relativePath = target.startsWith("local:") ? target.slice("local:".length) : target.replace(/^\/uploads\//, "");
  const localPath = path.join(LOCAL_UPLOAD_ROOT, relativePath);
  await fs.rm(localPath, { force: true });
}

async function deleteFromFirebase(target: string) {
  const bucket = getStorageBucket();
  // target can be a full URL or a storage object path
  let objectPath = target;
  const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!;
  if (target.startsWith("https://storage.googleapis.com/")) {
    objectPath = target.replace(`https://storage.googleapis.com/${bucketName}/`, "");
  } else if (target.startsWith("https://firebasestorage.googleapis.com/")) {
    // Handle Firebase download URLs: extract path after /o/
    const match = target.match(/\/o\/([^?]+)/);
    objectPath = match ? decodeURIComponent(match[1]) : target;
  }
  await bucket.file(objectPath).delete();
}

export async function deleteFileFromStorage(target: string): Promise<void> {
  if (target.startsWith("local:") || target.startsWith("/uploads/")) {
    await deleteLocalFile(target);
    return;
  }

  try {
    await deleteFromFirebase(target);
  } catch (err) {
    console.warn("[storage] Firebase delete failed, attempting local delete:", (err as Error).message);
    await deleteLocalFile(target);
  }
}
