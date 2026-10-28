"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  UploadCloud,
  Image as ImageIcon,
  Video as VideoIcon,
  Trash2,
  Edit2,
  ExternalLink,
  Loader2,
  RefreshCw,
  AlertCircle,
  Check,
  X,
  Copy,
  CheckCheck,
  Eye,
  Search,
  RotateCcw,
  CheckCircle2,
  FileVideo,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { upload } from "@imagekit/javascript";
import { useAuth } from "@/hooks/useAuth";
import { useConfirm } from "@/components/ConfirmDialog";
import {
  MediaItem,
  listMedia,
  updateMediaTitle,
  deleteMedia,
  getMediaAuth,
  completeMediaUpload,
  validateMediaFile,
} from "@/lib/api/media";

function formatBytes(bytes: number, decimals = 1) {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

function formatDate(isoString?: string) {
  if (!isoString) return "Recently";
  try {
    return new Date(isoString).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return isoString;
  }
}

export interface UploadQueueItem {
  id: string;
  file: File;
  previewUrl: string;
  mediaType: "image" | "video";
  title: string;
  progress: number;
  status: "idle" | "uploading" | "success" | "error";
  errorMessage?: string;
  fileId?: string;
  uploadedItem?: MediaItem;
}

export default function AdminMediaUpload() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const confirm = useConfirm();

  // State: media library items & pagination
  const [mediaList, setMediaList] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Filters & Search
  const [mediaTypeFilter, setMediaTypeFilter] = useState<"all" | "image" | "video">("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Multi-file Upload Queue State
  const [uploadQueue, setUploadQueue] = useState<UploadQueueItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Edit Title Modal State (for existing media in gallery)
  const [editingItem, setEditingItem] = useState<MediaItem | null>(null);
  const [editTitleValue, setEditTitleValue] = useState("");
  const [isUpdatingTitle, setIsUpdatingTitle] = useState(false);

  // Preview Lightbox Modal
  const [previewItem, setPreviewItem] = useState<MediaItem | null>(null);

  // Copied URL feedback
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Cleanup object URLs when component unmounts
  useEffect(() => {
    return () => {
      uploadQueue.forEach((item) => {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      });
    };
  }, []);

  // Fetch Media List
  const fetchMedia = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listMedia({
        page,
        limit: 12,
        mediaType: mediaTypeFilter === "all" ? undefined : mediaTypeFilter,
      });
      setMediaList(res.items || []);
      setTotalPages(res.pagination.totalPages || 1);
      setTotalCount(res.pagination.total || 0);
    } catch (err: any) {
      console.error("Failed to load media:", err);
      setError(err.message || "Failed to load media library.");
      toast.error(err.message || "Could not load media records.");
    } finally {
      setLoading(false);
    }
  }, [page, mediaTypeFilter]);

  useEffect(() => {
    fetchMedia();
  }, [fetchMedia]);

  // Add multiple files to the upload queue
  const addFilesToQueue = (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    const newItems: UploadQueueItem[] = [];
    let hasInvalid = false;

    fileArray.forEach((file) => {
      try {
        const validated = validateMediaFile(file);
        const previewUrl = URL.createObjectURL(file);
        const cleanName = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
        const formattedTitle = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);

        newItems.push({
          id: `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          file,
          previewUrl,
          mediaType: validated.mediaType,
          title: formattedTitle,
          progress: 0,
          status: "idle",
        });
      } catch (err: any) {
        hasInvalid = true;
        toast.error(err.message || `File "${file.name}" is invalid.`);
      }
    });

    if (newItems.length > 0) {
      setUploadQueue((prev) => [...prev, ...newItems]);
      toast.success(`Added ${newItems.length} file(s) to upload queue.`);
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Remove individual file from queue
  const removeFromQueue = (id: string) => {
    setUploadQueue((prev) => {
      const item = prev.find((i) => i.id === id);
      if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
      return prev.filter((i) => i.id !== id);
    });
  };

  // Clear all non-uploading files from queue
  const clearQueue = () => {
    if (isUploading) return;
    uploadQueue.forEach((item) => {
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
    });
    setUploadQueue([]);
  };

  // Update title of queued item
  const updateQueueItemTitle = (id: string, newTitle: string) => {
    setUploadQueue((prev) =>
      prev.map((item) => (item.id === id ? { ...item, title: newTitle } : item))
    );
  };

  // Drag and drop handlers
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFilesToQueue(e.dataTransfer.files);
    }
  };

  // Upload an individual queued file
  const uploadSingleItem = async (
    item: UploadQueueItem
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      // 1. Get fresh auth parameters per file to ensure unique single-use ImageKit token
      const auth = await getMediaAuth();

      // 2. Upload directly to ImageKit with progress
      const uploadRes: any = await upload({
        file: item.file,
        fileName: item.file.name,
        token: auth.token,
        signature: auth.signature,
        expire: auth.expire,
        publicKey: auth.publicKey,
        folder: "/admin-media",
        onProgress: (event) => {
          if (event.lengthComputable) {
            const percent = Math.round((event.loaded / event.total) * 100);
            setUploadQueue((prev) =>
              prev.map((i) => (i.id === item.id ? { ...i, progress: percent } : i))
            );
          }
        },
      });

      if (!uploadRes?.fileId) {
        throw new Error("Upload completed without ImageKit fileId.");
      }

      // 3. Persist verified metadata to Firestore
      const saved = await completeMediaUpload({
        fileId: uploadRes.fileId,
        title: item.title.trim() || item.file.name.replace(/\.[^/.]+$/, ""),
      });

      setUploadQueue((prev) =>
        prev.map((i) =>
          i.id === item.id
            ? { ...i, progress: 100, status: "success", uploadedItem: saved }
            : i
        )
      );

      return { success: true };
    } catch (err: any) {
      console.error(`Upload failed for ${item.file.name}:`, err);
      const msg = err.message || "Upload failed.";
      setUploadQueue((prev) =>
        prev.map((i) =>
          i.id === item.id ? { ...i, status: "error", errorMessage: msg } : i
        )
      );
      return { success: false, error: msg };
    }
  };

  // Start uploading all pending files
  const handleStartUpload = async () => {
    if (!isAdmin) {
      toast.error("Only administrators can upload media.");
      return;
    }

    const pending = uploadQueue.filter((i) => i.status === "idle" || i.status === "error");
    if (pending.length === 0) {
      toast.info("No pending files to upload.");
      return;
    }

    setIsUploading(true);

    try {
      // Set items to uploading state
      setUploadQueue((prev) =>
        prev.map((i) =>
          i.status === "idle" || i.status === "error"
            ? { ...i, status: "uploading", progress: 0, errorMessage: undefined }
            : i
        )
      );

      // Upload concurrently with concurrency limit of 3
      const concurrencyLimit = 3;
      const queueToProcess = [...pending];
      let successCount = 0;
      let failCount = 0;

      const runWorker = async () => {
        while (queueToProcess.length > 0) {
          const item = queueToProcess.shift();
          if (!item) break;
          const res = await uploadSingleItem(item);
          if (res.success) {
            successCount++;
          } else {
            failCount++;
          }
        }
      };

      const workers = Array.from(
        { length: Math.min(concurrencyLimit, pending.length) },
        () => runWorker()
      );

      await Promise.all(workers);

      if (successCount > 0) {
        toast.success(`Successfully uploaded ${successCount} file(s) to ImageKit!`);
        fetchMedia(); // Refresh media library without losing state
      }

      if (failCount > 0) {
        toast.error(`${failCount} file(s) failed to upload. Click retry on failed items.`);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to initialize upload session.");
    } finally {
      setIsUploading(false);
    }
  };

  // Retry an individual failed file
  const handleRetryItem = async (item: UploadQueueItem) => {
    setUploadQueue((prev) =>
      prev.map((i) =>
        i.id === item.id
          ? { ...i, status: "uploading", progress: 0, errorMessage: undefined }
          : i
      )
    );

    const res = await uploadSingleItem(item);
    if (res.success) {
      toast.success(`"${item.title}" uploaded successfully!`);
      fetchMedia();
    } else {
      toast.error(`Retry failed for "${item.file.name}".`);
    }
  };

  // Perform Title Edit for existing media in gallery
  const handleSaveTitle = async () => {
    if (!editingItem) return;
    if (!editTitleValue.trim()) {
      toast.error("Title cannot be empty.");
      return;
    }

    setIsUpdatingTitle(true);
    try {
      await updateMediaTitle(editingItem.id, editTitleValue.trim());
      toast.success("Media title updated successfully!");
      setEditingItem(null);
      fetchMedia();
    } catch (err: any) {
      toast.error(err.message || "Failed to update title.");
    } finally {
      setIsUpdatingTitle(false);
    }
  };

  // Perform Deletion of media from gallery
  const handleDeleteItem = async (item: MediaItem) => {
    const isConfirmed = await confirm({
      title: "Delete Media Item?",
      message: `Are you sure you want to permanently delete "${item.title}"? This action will remove the file from ImageKit and delete the record from Firestore.`,
      confirmText: "Delete",
      variant: "danger",
    });

    if (isConfirmed) {
      try {
        await deleteMedia(item.id);
        toast.success(`"${item.title}" deleted.`);
        fetchMedia();
      } catch (err: any) {
        toast.error(err.message || "Failed to delete media.");
      }
    }
  };

  // Copy URL to clipboard
  const handleCopyUrl = (item: MediaItem) => {
    navigator.clipboard.writeText(item.url);
    setCopiedId(item.id);
    toast.success("Media URL copied to clipboard!");
    setTimeout(() => setCopiedId(null), 2500);
  };

  // Client-side search filter for media library
  const filteredList = mediaList.filter((m) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      m.title.toLowerCase().includes(q) ||
      m.fileName.toLowerCase().includes(q) ||
      m.mediaType.toLowerCase().includes(q)
    );
  });

  const pendingCount = uploadQueue.filter(
    (i) => i.status === "idle" || i.status === "error"
  ).length;
  const uploadingCount = uploadQueue.filter((i) => i.status === "uploading").length;
  const successCount = uploadQueue.filter((i) => i.status === "success").length;

  return (
    <div className="space-y-8">
      {/* ─── MULTIPLE UPLOAD SECTION ─── */}
      <section className="bg-slate-900/60 border border-white/10 rounded-2xl p-6 backdrop-blur-xl shadow-2xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20 text-primary">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Upload Images & Videos</h2>
              <p className="text-xs text-muted-foreground">
                Batch upload multiple assets directly to ImageKit cloud with Firestore synchronization
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground/80 bg-white/5 px-3 py-1.5 rounded-lg border border-white/5">
            <span>Images: JPG, PNG, WEBP, GIF (≤ 25MB)</span>
            <span>•</span>
            <span>Videos: MP4, WEBM, MOV (≤ 100MB)</span>
          </div>
        </div>

        {/* Dropzone with multiple file support */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          onClick={() => !isUploading && fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200 ${
            isDragOver
              ? "border-primary bg-primary/10 scale-[0.99]"
              : "border-white/15 hover:border-white/30 bg-black/20 hover:bg-black/30"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime,.mov,.mp4,.webm,.jpg,.jpeg,.png,.webp,.gif"
            className="hidden"
            onChange={(e) => {
              if (e.target.files) addFilesToQueue(e.target.files);
            }}
            disabled={isUploading}
          />

          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-muted-foreground border border-white/10">
              <UploadCloud className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-white">
                Drag & drop multiple images or videos here, or{" "}
                <span className="text-primary underline font-semibold">browse files</span>
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                You can select multiple files at once. Supports JPG, PNG, WEBP, GIF, MP4, WEBM, MOV.
              </p>
            </div>
          </div>
        </div>

        {/* Selected Upload Queue Cards */}
        {uploadQueue.length > 0 && (
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between pb-2 border-b border-white/5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-white uppercase tracking-wider">
                  Selected Files ({uploadQueue.length})
                </span>
                {successCount > 0 && (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-medium">
                    {successCount} uploaded
                  </span>
                )}
                {uploadingCount > 0 && (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-primary/20 text-primary font-medium flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    {uploadingCount} in progress
                  </span>
                )}
              </div>

              {!isUploading && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs text-muted-foreground hover:text-white px-2.5 py-1 rounded-lg hover:bg-white/5 transition-colors flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add More
                  </button>
                  <button
                    type="button"
                    onClick={clearQueue}
                    className="text-xs text-red-400/80 hover:text-red-300 px-2.5 py-1 rounded-lg hover:bg-red-500/10 transition-colors"
                  >
                    Clear All
                  </button>
                </div>
              )}
            </div>

            {/* List of queue items */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 max-h-[380px] overflow-y-auto pr-1">
              {uploadQueue.map((item) => (
                <div
                  key={item.id}
                  className={`p-3 rounded-xl border flex items-center gap-3 transition-all ${
                    item.status === "success"
                      ? "bg-emerald-500/5 border-emerald-500/20"
                      : item.status === "error"
                      ? "bg-red-500/5 border-red-500/20"
                      : item.status === "uploading"
                      ? "bg-primary/5 border-primary/30"
                      : "bg-white/5 border-white/10"
                  }`}
                >
                  {/* Thumbnail Preview */}
                  <div className="w-16 h-16 rounded-lg bg-black/60 overflow-hidden flex-shrink-0 relative border border-white/10">
                    {item.mediaType === "video" ? (
                      <video
                        src={item.previewUrl}
                        className="w-full h-full object-cover"
                        preload="metadata"
                        muted
                      />
                    ) : (
                      <img
                        src={item.previewUrl}
                        alt={item.title}
                        className="w-full h-full object-cover"
                      />
                    )}
                    <span
                      className={`absolute bottom-1 left-1 text-[8px] font-bold px-1 rounded uppercase tracking-wider backdrop-blur-md ${
                        item.mediaType === "video"
                          ? "bg-indigo-500/80 text-white"
                          : "bg-emerald-500/80 text-white"
                      }`}
                    >
                      {item.mediaType}
                    </span>
                  </div>

                  {/* Details & Title input */}
                  <div className="flex-1 min-w-0 space-y-1">
                    <input
                      type="text"
                      value={item.title}
                      onChange={(e) => updateQueueItemTitle(item.id, e.target.value)}
                      disabled={item.status === "uploading" || item.status === "success"}
                      placeholder="Title"
                      className="w-full bg-black/30 border border-white/10 rounded px-2 py-0.5 text-xs text-white placeholder-muted-foreground focus:outline-none focus:border-primary disabled:opacity-60 truncate"
                    />

                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span className="truncate max-w-[140px]">{item.file.name}</span>
                      <span>{formatBytes(item.file.size)}</span>
                    </div>

                    {/* Progress Bar */}
                    {item.status === "uploading" && (
                      <div className="space-y-1 pt-0.5">
                        <div className="w-full h-1.5 bg-black/50 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-primary to-accent transition-all duration-150"
                            style={{ width: `${item.progress}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[10px] text-primary">
                          <span>Uploading...</span>
                          <span className="font-mono">{item.progress}%</span>
                        </div>
                      </div>
                    )}

                    {/* Status Badge & Error Feedback */}
                    {item.status === "success" && (
                      <div className="flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Uploaded & Saved
                      </div>
                    )}

                    {item.status === "error" && (
                      <div className="flex items-center justify-between text-[11px] text-red-400">
                        <span className="truncate max-w-[160px]">{item.errorMessage || "Failed"}</span>
                        <button
                          type="button"
                          onClick={() => handleRetryItem(item)}
                          className="px-2 py-0.5 rounded bg-red-500/20 hover:bg-red-500/30 text-white text-[10px] font-semibold flex items-center gap-1 transition-colors"
                        >
                          <RotateCcw className="w-3 h-3" />
                          Retry
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Remove Button */}
                  {item.status !== "uploading" && (
                    <button
                      type="button"
                      onClick={() => removeFromQueue(item.id)}
                      className="p-1.5 text-muted-foreground hover:text-white rounded-lg hover:bg-white/10 transition-colors flex-shrink-0"
                      title="Remove file"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Bottom Actions Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-white/5">
              <div className="text-xs text-muted-foreground">
                <span>
                  {pendingCount} file(s) ready to upload • {successCount} completed
                </span>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={clearQueue}
                  disabled={isUploading}
                  className="flex-1 sm:flex-initial px-4 py-2 rounded-xl text-xs font-medium text-muted-foreground hover:text-white hover:bg-white/5 transition-colors disabled:opacity-50"
                >
                  Clear Queue
                </button>
                <button
                  type="button"
                  onClick={handleStartUpload}
                  disabled={isUploading || pendingCount === 0}
                  className="flex-1 sm:flex-initial px-6 py-2.5 rounded-xl text-xs font-bold bg-primary text-black hover:bg-primary/90 transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/20 disabled:opacity-50 active:scale-95"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Uploading ({uploadingCount} active)...
                    </>
                  ) : (
                    <>
                      <UploadCloud className="w-4 h-4" />
                      Upload Images & Videos ({pendingCount})
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ─── MEDIA LIBRARY GALLERY SECTION ─── */}
      <section className="space-y-4">
        {/* Header & Filter Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-white/5">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-white tracking-tight">Media Library</h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-white/10 text-muted-foreground border border-white/10">
              {totalCount} total
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search media..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-black/30 border border-white/10 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-muted-foreground focus:outline-none focus:border-primary transition-colors w-40 sm:w-52"
              />
            </div>

            {/* Filter Tabs */}
            <div className="flex rounded-lg bg-black/40 border border-white/10 p-0.5 text-xs">
              <button
                onClick={() => setMediaTypeFilter("all")}
                className={`px-3 py-1 rounded-md transition-colors ${
                  mediaTypeFilter === "all"
                    ? "bg-primary text-black font-semibold shadow"
                    : "text-muted-foreground hover:text-white"
                }`}
              >
                All
              </button>
              <button
                onClick={() => setMediaTypeFilter("image")}
                className={`px-3 py-1 rounded-md flex items-center gap-1.5 transition-colors ${
                  mediaTypeFilter === "image"
                    ? "bg-primary text-black font-semibold shadow"
                    : "text-muted-foreground hover:text-white"
                }`}
              >
                <ImageIcon className="w-3.5 h-3.5" />
                Images
              </button>
              <button
                onClick={() => setMediaTypeFilter("video")}
                className={`px-3 py-1 rounded-md flex items-center gap-1.5 transition-colors ${
                  mediaTypeFilter === "video"
                    ? "bg-primary text-black font-semibold shadow"
                    : "text-muted-foreground hover:text-white"
                }`}
              >
                <VideoIcon className="w-3.5 h-3.5" />
                Videos
              </button>
            </div>

            {/* Refresh Button */}
            <button
              onClick={() => fetchMedia()}
              disabled={loading}
              title="Refresh list"
              className="p-2 rounded-lg bg-white/5 border border-white/10 text-muted-foreground hover:text-white hover:bg-white/10 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-primary" : ""}`} />
            </button>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading media library from Firestore...</p>
          </div>
        )}

        {/* Error State */}
        {!loading && error && (
          <div className="p-6 rounded-2xl bg-red-500/10 border border-red-500/20 text-center space-y-3">
            <AlertCircle className="w-8 h-8 text-red-400 mx-auto" />
            <p className="text-sm text-red-200">{error}</p>
            <button
              onClick={() => fetchMedia()}
              className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-200 text-xs font-semibold rounded-lg border border-red-500/30 transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && filteredList.length === 0 && (
          <div className="border border-dashed border-white/10 rounded-2xl p-12 text-center space-y-3 bg-black/10">
            <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-muted-foreground mx-auto">
              <UploadCloud className="w-6 h-6 text-muted-foreground/60" />
            </div>
            <div>
              <p className="text-base font-semibold text-white">No media records found</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                {searchQuery
                  ? "No files matched your search query. Try another search term or reset filters."
                  : "Upload images or videos above to store media on ImageKit and sync metadata in Firestore."}
              </p>
            </div>
          </div>
        )}

        {/* Media Grid */}
        {!loading && !error && filteredList.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {filteredList.map((item) => (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="group bg-slate-900/70 border border-white/10 rounded-xl overflow-hidden hover:border-white/20 transition-all duration-300 flex flex-col shadow-lg hover:shadow-2xl"
              >
                {/* Media Preview Player/Thumbnail */}
                <div className="relative aspect-video bg-black/80 flex items-center justify-center overflow-hidden border-b border-white/5">
                  {item.mediaType === "video" ? (
                    <video
                      src={item.url}
                      controls
                      preload="metadata"
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div
                      className="w-full h-full cursor-pointer relative group/img"
                      onClick={() => setPreviewItem(item)}
                    >
                      <img
                        src={item.url}
                        alt={item.title}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover/img:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                        <span className="p-2 rounded-full bg-white/20 backdrop-blur text-white">
                          <Eye className="w-5 h-5" />
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Badge */}
                  <span
                    className={`absolute top-2.5 left-2.5 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider backdrop-blur-md shadow-sm pointer-events-none ${
                      item.mediaType === "video"
                        ? "bg-indigo-500/80 text-white"
                        : "bg-emerald-500/80 text-white"
                    }`}
                  >
                    {item.mediaType}
                  </span>
                </div>

                {/* Card Body */}
                <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                  <div>
                    <h3
                      className="font-semibold text-sm text-white line-clamp-1 group-hover:text-primary transition-colors"
                      title={item.title}
                    >
                      {item.title}
                    </h3>
                    <p
                      className="text-[11px] text-muted-foreground truncate mt-0.5"
                      title={item.fileName}
                    >
                      {item.fileName}
                    </p>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-muted-foreground/80 border-t border-white/5 pt-2">
                    <span>{formatBytes(item.size)}</span>
                    <span>{formatDate(item.createdAt)}</span>
                  </div>

                  {/* Actions Bar */}
                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-1">
                      {/* Copy URL */}
                      <button
                        onClick={() => handleCopyUrl(item)}
                        title="Copy direct ImageKit URL"
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-white hover:bg-white/10 transition-colors"
                      >
                        {copiedId === item.id ? (
                          <CheckCheck className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>

                      {/* Open in new tab */}
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Open media in new tab"
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-white hover:bg-white/10 transition-colors"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>

                    <div className="flex items-center gap-1">
                      {/* Edit Title */}
                      <button
                        onClick={() => {
                          setEditingItem(item);
                          setEditTitleValue(item.title);
                        }}
                        title="Edit title"
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-white hover:bg-white/10 transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>

                      {/* Delete with custom confirmation */}
                      <button
                        onClick={() => handleDeleteItem(item)}
                        title="Delete media"
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Pagination Controls */}
        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-between pt-4 border-t border-white/5 text-xs text-muted-foreground">
            <span>
              Page {page} of {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-40 text-white transition-colors"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-40 text-white transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </section>

      {/* ─── MODAL: EDIT TITLE ─── */}
      <AnimatePresence>
        {editingItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-slate-900 border border-white/15 rounded-2xl p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between pb-2 border-b border-white/10">
                <h3 className="text-base font-semibold text-white">Edit Media Title</h3>
                <button
                  onClick={() => setEditingItem(null)}
                  className="p-1 text-muted-foreground hover:text-white rounded-lg hover:bg-white/10"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  Title
                </label>
                <input
                  type="text"
                  value={editTitleValue}
                  onChange={(e) => setEditTitleValue(e.target.value)}
                  className="w-full bg-black/50 border border-white/15 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary transition-colors"
                  autoFocus
                />
              </div>

              <div className="text-xs text-muted-foreground">
                <span className="font-semibold text-white/80">File:</span> {editingItem.fileName}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  disabled={isUpdatingTitle}
                  className="px-4 py-2 text-xs font-medium text-muted-foreground hover:text-white rounded-lg hover:bg-white/5 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveTitle}
                  disabled={isUpdatingTitle}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-primary text-black hover:bg-primary/90 transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isUpdatingTitle ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─── MODAL: FULL PREVIEW LIGHTBOX ─── */}
      <AnimatePresence>
        {previewItem && (
          <div
            onClick={() => setPreviewItem(null)}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8 bg-black/90 backdrop-blur-md"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              onClick={(e) => e.stopPropagation()}
              className="relative max-w-4xl w-full bg-slate-900 border border-white/15 rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
            >
              <div className="flex items-center justify-between px-5 py-3 border-b border-white/10 bg-black/40">
                <div className="truncate">
                  <h3 className="text-sm font-semibold text-white truncate">{previewItem.title}</h3>
                  <p className="text-[11px] text-muted-foreground truncate">{previewItem.fileName}</p>
                </div>
                <button
                  onClick={() => setPreviewItem(null)}
                  className="p-1.5 text-muted-foreground hover:text-white rounded-lg hover:bg-white/10 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-auto bg-black flex items-center justify-center p-4 min-h-[300px]">
                {previewItem.mediaType === "video" ? (
                  <video
                    src={previewItem.url}
                    controls
                    autoPlay
                    className="max-h-[65vh] w-auto max-w-full rounded"
                  />
                ) : (
                  <img
                    src={previewItem.url}
                    alt={previewItem.title}
                    className="max-h-[65vh] w-auto max-w-full object-contain rounded"
                  />
                )}
              </div>

              <div className="px-5 py-3 border-t border-white/10 bg-black/40 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-3">
                  <span>Size: {formatBytes(previewItem.size)}</span>
                  <span>•</span>
                  <span>Type: {previewItem.mimeType}</span>
                  <span>•</span>
                  <span>Date: {formatDate(previewItem.createdAt)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleCopyUrl(previewItem)}
                    className="px-3 py-1.5 bg-white/10 hover:bg-white/15 text-white rounded-lg transition-colors flex items-center gap-1.5"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    Copy URL
                  </button>
                  <a
                    href={previewItem.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 bg-primary text-black font-semibold rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-1.5"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Open Original
                  </a>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
