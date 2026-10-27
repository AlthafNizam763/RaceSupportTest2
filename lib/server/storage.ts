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

async function uploadFilesToImageKit(files: File[], folder = "uploads"): Promise<UploadedAsset[]> {
  const { getImageKitClient } = await import("@/lib/server/imagekit");
  const ik = getImageKitClient();
  const cleanFolder = folder.startsWith("/") ? folder : `/${folder}`;

  return Promise.all(
    files.map(async (file) => {
      const buffer = Buffer.from(await file.arrayBuffer());
      const res = await ik.files.upload({
        file: buffer.toString("base64"),
        fileName: file.name,
        folder: cleanFolder,
      });

      return {
        url: res.url || "",
        path: `imagekit:${res.fileId || ""}`,
        fileName: res.name || file.name,
        contentType: file.type || "application/octet-stream",
        size: res.size || file.size,
      } satisfies UploadedAsset;
    })
  );
}

export async function uploadFilesToStorage(files: File[], folder = "uploads"): Promise<UploadedAsset[]> {
  // 1. Prioritize ImageKit cloud upload when configured
  if (process.env.IMAGEKIT_PRIVATE_KEY) {
    try {
      return await uploadFilesToImageKit(files, folder);
    } catch (error: any) {
      console.error("ImageKit upload failed, falling back to Firebase:", error?.message || error);
    }
  }

  // 2. Fallback to Firebase Storage
  try {
    return await uploadFilesToFirebase(files, folder);
  } catch (error: any) {
    console.error("Firebase Storage upload failed:", error?.message || error);
  }

  // 3. Fallback to local filesystem ONLY in local development (never on serverless/Vercel read-only filesystem)
  const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
  if (!isServerless && process.env.NODE_ENV !== "production") {
    return uploadFilesLocally(files, folder);
  }

  throw new Error(
    "Cloud storage upload failed. Please ensure ImageKit (IMAGEKIT_PRIVATE_KEY) or Firebase Storage is configured in your environment."
  );
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
  if (target.startsWith("imagekit:")) {
    try {
      const { deleteImageKitFile } = await import("@/lib/server/imagekit");
      const fileId = target.replace("imagekit:", "");
      await deleteImageKitFile(fileId);
      return;
    } catch (err: any) {
      console.warn("[storage] ImageKit delete failed:", err?.message || err);
      return;
    }
  }

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
