"use client";

import { useState, useRef, useEffect } from "react";
import { useRealtimeCollection } from "../../../hooks/useRealtimeCollection";
import { useAuth } from "../../../hooks/useAuth";
import {
  createDocument,
  createDocuments,
  updateDocument,
  deleteDocument,
  updateOrderBatch,
} from "../../../lib/firebase/firestore";
import { uploadFiles, uploadImage } from "../../../lib/firebase/storage";
import { getDeleteConfirmationMessage } from "../../../lib/messages";
import { useConfirm } from "../../../components/ConfirmDialog";
import { DraggableList } from "../../../components/DraggableList";
import { AIContentGenerator } from "../../../components/AIContentGenerator";
import {
  Plus,
  Pencil,
  Trash2,
  Image as ImageIcon,
  Video,
  X,
  Loader2,
  UploadCloud,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";

interface MediaItem {
  id: string;
  title: string;
  url: string;
  type: "image" | "video";
  order: number;
}

interface QueuedFile {
  id: string;
  file: File;
  previewUrl: string;
  title: string;
  size: number;
}

const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const ALLOWED_VIDEO_TYPES = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
]);

const MAX_IMAGE_SIZE = 25 * 1024 * 1024; // 25MB
const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100MB

function formatFileSize(bytes: number) {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

export default function GalleryPage() {
  const { data: media, loading } = useRealtimeCollection<MediaItem>("gallery");
  const { user } = useAuth();
  const confirm = useConfirm();
  const isViewer = user?.role === "viewer";

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MediaItem | null>(null);
  const [activeTab, setActiveTab] = useState<"image" | "video">("image");
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  // For multi-file upload when adding new media
  const [queuedFiles, setQueuedFiles] = useState<QueuedFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // For single-item editing or direct URL input
  const [singleFormData, setSingleFormData] = useState({
    title: "",
    url: "",
  });
  const [isDirectUrlMode, setIsDirectUrlMode] = useState(false);

  const activeMedia = media.filter((m) => m.type === activeTab);

  // Clean up object URLs on unmount or when queuedFiles changes
  useEffect(() => {
    return () => {
      queuedFiles.forEach((item) => {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      });
    };
  }, [queuedFiles]);

  const handleOpenModal = (item?: MediaItem) => {
    // Revoke previous previews
    queuedFiles.forEach((f) => {
      if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
    });
    setQueuedFiles([]);
    setIsDirectUrlMode(false);

    if (item) {
      setEditingItem(item);
      setSingleFormData({
        title: item.title,
        url: item.url,
      });
    } else {
      setEditingItem(null);
      setSingleFormData({ title: "", url: "" });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    if (isUploading) return;
    queuedFiles.forEach((f) => {
      if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
    });
    setQueuedFiles([]);
    setIsModalOpen(false);
  };

  // Validate and stage multiple files into the queue
  const stageFiles = (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    const newQueued: QueuedFile[] = [];
    let invalidCount = 0;

    fileArray.forEach((file) => {
      const isVideo = activeTab === "video";
      const fileExt = file.name.split(".").pop()?.toLowerCase() || "";
      const isMov = fileExt === "mov";
      const mime = file.type || (isMov ? "video/quicktime" : "");

      // Type validation
      if (isVideo) {
        if (!ALLOWED_VIDEO_TYPES.has(mime) && !["mp4", "webm", "mov"].includes(fileExt)) {
          toast.error(`"${file.name}" is not a supported video (MP4, WEBM, MOV).`);
          invalidCount++;
          return;
        }
        if (file.size > MAX_VIDEO_SIZE) {
          toast.error(`"${file.name}" exceeds the 100MB video size limit.`);
          invalidCount++;
          return;
        }
      } else {
        if (!ALLOWED_IMAGE_TYPES.has(mime) && !["jpg", "jpeg", "png", "webp", "gif"].includes(fileExt)) {
          toast.error(`"${file.name}" is not a supported image (JPG, PNG, WEBP, GIF).`);
          invalidCount++;
          return;
        }
        if (file.size > MAX_IMAGE_SIZE) {
          toast.error(`"${file.name}" exceeds the 25MB image size limit.`);
          invalidCount++;
          return;
        }
      }

      const previewUrl = URL.createObjectURL(file);
      const cleanName = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
      const autoTitle = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);

      newQueued.push({
        id: `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        file,
        previewUrl,
        title: autoTitle,
        size: file.size,
      });
    });

    if (newQueued.length > 0) {
      setQueuedFiles((prev) => [...prev, ...newQueued]);
      toast.success(
        newQueued.length === 1
          ? `Added 1 ${activeTab} for preview.`
          : `Added ${newQueued.length} ${activeTab}s for preview.`
      );
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeQueuedFile = (id: string) => {
    setQueuedFiles((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((item) => item.id !== id);
    });
  };

  const updateQueuedFileTitle = (id: string, title: string) => {
    setQueuedFiles((prev) =>
      prev.map((item) => (item.id === id ? { ...item, title } : item))
    );
  };

  // Upload all queued files and save to Firestore
  const handleBatchUploadAndSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isViewer || isUploading) return;

    // Single item edit mode
    if (editingItem) {
      if (!singleFormData.url.trim()) {
        toast.error("Media URL is required.");
        return;
      }
      try {
        setIsUploading(true);
        await updateDocument("gallery", editingItem.id, {
          title: singleFormData.title.trim(),
          url: singleFormData.url.trim(),
          type: activeTab,
        });
        toast.success("Media item updated successfully!");
        handleCloseModal();
      } catch (err: any) {
        toast.error(err.message || "Failed to update media item.");
      } finally {
        setIsUploading(false);
      }
      return;
    }

    // Direct URL mode for single item creation
    if (isDirectUrlMode) {
      if (!singleFormData.url.trim()) {
        toast.error("Please provide a valid media URL.");
        return;
      }
      try {
        setIsUploading(true);
        const order = activeMedia.length;
        await createDocument("gallery", {
          title: singleFormData.title.trim() || "Untitled Media",
          url: singleFormData.url.trim(),
          type: activeTab,
          order,
        });
        toast.success("Media item added!");
        handleCloseModal();
      } catch (err: any) {
        toast.error(err.message || "Failed to create media item.");
      } finally {
        setIsUploading(false);
      }
      return;
    }

    // Multi-file batch upload mode
    if (queuedFiles.length === 0) {
      toast.error(`Please select at least one ${activeTab} to upload.`);
      return;
    }

    setIsUploading(true);
    const toastId = toast.loading(`Uploading ${queuedFiles.length} ${activeTab}(s)...`);

    try {
      // 1. Upload all selected files in a single operation via FormData to /api/upload
      const filesToUpload = queuedFiles.map((q) => q.file);
      const assets = await uploadFiles(filesToUpload, "gallery");

      if (!assets || assets.length === 0) {
        throw new Error("No assets were returned from storage upload.");
      }

      // 2. Prepare documents for Firestore
      const startingOrder = activeMedia.length;
      const documentsToCreate = assets.map((asset, index) => {
        const queuedItem = queuedFiles[index];
        const title =
          queuedItem?.title?.trim() ||
          asset.fileName.replace(/\.[^/.]+$/, "") ||
          `Gallery ${activeTab} ${startingOrder + index + 1}`;

        return {
          title,
          url: asset.url,
          path: asset.path || "",
          fileName: asset.fileName || "",
          contentType: asset.contentType || "",
          size: asset.size || 0,
          type: activeTab,
          order: startingOrder + index,
        };
      });

      // 3. Batch save all uploaded items to Firestore gallery collection
      await createDocuments("gallery", documentsToCreate);

      toast.dismiss(toastId);
      toast.success(
        `Successfully uploaded and saved ${documentsToCreate.length} ${activeTab}(s)!`
      );

      handleCloseModal();
    } catch (err: any) {
      toast.dismiss(toastId);
      console.error("Batch upload failed:", err);
      toast.error(err.message || "Failed to complete media upload.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (id: string, title?: string) => {
    if (isViewer) return;
    const isConfirmed = await confirm({
      title: "Delete Media Item?",
      message: getDeleteConfirmationMessage("media item", title),
      confirmText: "Delete",
      variant: "danger",
    });

    if (isConfirmed) {
      try {
        await deleteDocument("gallery", id);
        toast.success("Deleted successfully.");
      } catch (err) {
        toast.error("Failed to delete.");
      }
    }
  };

  const handleReorder = async (reorderedItems: MediaItem[]) => {
    if (isViewer) return;
    try {
      const updates = reorderedItems.map((item, index) => ({ id: item.id, order: index }));
      await updateOrderBatch("gallery", updates);
      toast.success("Order saved! 🔄", { duration: 2000 });
    } catch (err) {
      toast.error("Failed to reorder items.");
    }
  };

  return (
    <>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-2">
            <ImageIcon className="w-8 h-8 text-primary pb-1" />
            Gallery Management
          </h1>
          <p className="text-muted-foreground mt-1">
            Upload multiple images and videos simultaneously and organize your public gallery.
          </p>
        </div>
        {!isViewer && (
          <button
            onClick={() => handleOpenModal()}
            className="bg-primary hover:bg-primary/90 text-primary-foreground px-5 py-2.5 rounded-lg font-medium flex items-center justify-center gap-2 transition shadow-lg shadow-primary/20"
          >
            <Plus className="w-5 h-5" /> Upload Images & Videos
          </button>
        )}
      </div>

      <div className="flex items-center gap-4 mb-6 bg-slate-900/50 p-1.5 rounded-xl border border-white/5 w-fit">
        <button
          onClick={() => setActiveTab("image")}
          className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
            activeTab === "image"
              ? "bg-white/10 text-white shadow-sm"
              : "text-muted-foreground hover:text-white hover:bg-white/5"
          }`}
        >
          <ImageIcon className="w-4 h-4" /> Images ({media.filter((m) => m.type === "image").length})
        </button>
        <button
          onClick={() => setActiveTab("video")}
          className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
            activeTab === "video"
              ? "bg-white/10 text-white shadow-sm"
              : "text-muted-foreground hover:text-white hover:bg-white/5"
          }`}
        >
          <Video className="w-4 h-4" /> Videos ({media.filter((m) => m.type === "video").length})
        </button>
      </div>

      <div className="bg-slate-900/50 p-6 rounded-2xl border border-white/5 shadow-xl min-h-[400px]">
        {loading ? (
          <div className="text-white p-8 animate-pulse flex items-center gap-3">
            <Loader2 className="animate-spin w-5 h-5" /> Loading gallery items...
          </div>
        ) : activeMedia.length === 0 ? (
          <div className="text-center py-16 space-y-3">
            <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto text-muted-foreground">
              {activeTab === "image" ? <ImageIcon className="w-8 h-8" /> : <Video className="w-8 h-8" />}
            </div>
            <h3 className="text-lg font-semibold text-white">No {activeTab}s yet</h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              Select multiple {activeTab}s at once using the upload button above to add to your gallery.
            </p>
          </div>
        ) : (
          <DraggableList
            disabled={isViewer}
            items={activeMedia}
            onReorder={handleReorder}
            renderItem={(item) => (
              <div className="flex flex-col md:flex-row gap-4 items-start md:items-center w-full">
                {item.type === "image" ? (
                  <div className="w-24 h-16 rounded-lg bg-white/5 border border-white/10 overflow-hidden shrink-0 shadow-lg">
                    <img src={item.url} alt={item.title} className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="w-24 h-16 rounded-lg bg-white/5 border border-white/10 overflow-hidden shrink-0 shadow-lg flex items-center justify-center">
                    {item.url.includes("mp4") || item.url.includes("webm") ? (
                      <video src={item.url} className="w-full h-full object-cover" />
                    ) : (
                      <Video className="w-6 h-6 text-muted-foreground" />
                    )}
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-semibold text-white truncate">{item.title || "Untitled Media"}</h3>
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-blue-400 hover:text-blue-300 truncate block max-w-sm mt-1"
                  >
                    {item.url}
                  </a>
                </div>
                {!isViewer && (
                  <div className="flex items-center gap-2 mt-4 md:mt-0 shrink-0">
                    <button
                      onClick={() => handleOpenModal(item)}
                      className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-blue-400 transition"
                      title="Edit"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(item.id, item.title)}
                      className="p-2 bg-white/5 hover:bg-destructive/20 rounded-lg text-red-500 transition"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            )}
          />
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="glass-panel w-full max-w-2xl rounded-2xl p-6 relative my-8 max-h-[90vh] flex flex-col">
            <button
              onClick={handleCloseModal}
              disabled={isUploading}
              className="absolute top-4 right-4 p-2 text-muted-foreground hover:text-white transition disabled:opacity-50"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-2xl font-bold text-white mb-2">
              {editingItem
                ? `Edit ${activeTab === "image" ? "Image" : "Video"}`
                : `Upload ${activeTab === "image" ? "Images" : "Videos"} to Gallery`}
            </h2>
            <p className="text-xs text-muted-foreground mb-6">
              {editingItem
                ? "Update the details for this media item."
                : `Select one or multiple ${activeTab}s using Ctrl + Click, Shift + Click, or drag-and-drop.`}
            </p>

            <form onSubmit={handleBatchUploadAndSave} className="space-y-6 flex-1 overflow-y-auto pr-1">
              {/* EDIT MODE: Single Item URL & Title */}
              {editingItem ? (
                <div className="space-y-4">
                  <div className="p-4 border border-white/10 rounded-xl bg-white/5 flex items-center justify-center">
                    {activeTab === "image" ? (
                      <img src={singleFormData.url} alt="Preview" className="max-h-48 rounded object-contain" />
                    ) : (
                      <video src={singleFormData.url} controls className="max-h-48 rounded w-full" />
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1">Title / Caption</label>
                    <input
                      type="text"
                      value={singleFormData.title}
                      onChange={(e) => setSingleFormData({ ...singleFormData, title: e.target.value })}
                      className="w-full bg-slate-950/50 border border-white/10 rounded-lg p-3 text-white focus:ring-2 focus:ring-primary/50 outline-none transition"
                      placeholder="Title..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1">Media URL</label>
                    <input
                      type="url"
                      value={singleFormData.url}
                      onChange={(e) => setSingleFormData({ ...singleFormData, url: e.target.value })}
                      className="w-full bg-slate-950/50 border border-white/10 rounded-lg p-3 text-white focus:ring-2 focus:ring-primary/50 outline-none transition"
                      required
                    />
                  </div>
                </div>
              ) : isDirectUrlMode ? (
                /* DIRECT URL MODE (single external link) */
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-white">Direct URL Upload</span>
                    <button
                      type="button"
                      onClick={() => setIsDirectUrlMode(false)}
                      className="text-xs text-primary underline hover:text-primary/80"
                    >
                      Switch to File Upload
                    </button>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1">Title / Caption</label>
                    <input
                      type="text"
                      value={singleFormData.title}
                      onChange={(e) => setSingleFormData({ ...singleFormData, title: e.target.value })}
                      className="w-full bg-slate-950/50 border border-white/10 rounded-lg p-3 text-white focus:ring-2 focus:ring-primary/50 outline-none transition"
                      placeholder="A scenic mountain view..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1">Direct URL</label>
                    <input
                      type="url"
                      value={singleFormData.url}
                      onChange={(e) => setSingleFormData({ ...singleFormData, url: e.target.value })}
                      className="w-full bg-slate-950/50 border border-white/10 rounded-lg p-3 text-white focus:ring-2 focus:ring-primary/50 outline-none transition"
                      placeholder="https://images.unsplash.com/..."
                      required
                    />
                  </div>
                </div>
              ) : (
                /* MULTI-FILE UPLOAD MODE */
                <div className="space-y-4">
                  {/* Dropzone with multiple file picker support */}
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragOver(true);
                    }}
                    onDragLeave={() => setIsDragOver(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDragOver(false);
                      if (e.dataTransfer.files) stageFiles(e.dataTransfer.files);
                    }}
                    onClick={() => !isUploading && fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all duration-200 ${
                      isDragOver
                        ? "border-primary bg-primary/10 scale-[0.99]"
                        : "border-white/15 hover:border-white/30 bg-black/20 hover:bg-black/30"
                    }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept={
                        activeTab === "image"
                          ? "image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif"
                          : "video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov"
                      }
                      onChange={(e) => {
                        if (e.target.files) stageFiles(e.target.files);
                      }}
                      className="hidden"
                      disabled={isUploading}
                    />

                    <div className="flex flex-col items-center gap-2">
                      <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-muted-foreground border border-white/10">
                        <UploadCloud className="w-6 h-6 text-primary" />
                      </div>
                      <p className="text-sm font-medium text-white">
                        Drag & drop multiple {activeTab}s here, or{" "}
                        <span className="text-primary underline font-semibold">browse files</span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Supports {activeTab === "image" ? "JPG, JPEG, PNG, WEBP, GIF (up to 25MB each)" : "MP4, WEBM, MOV (up to 100MB each)"}. Multi-select with Ctrl + Click or Shift + Click.
                      </p>
                    </div>
                  </div>

                  {/* PREVIEWS OF ALL SELECTED FILES */}
                  {queuedFiles.length > 0 && (
                    <div className="space-y-3 pt-2">
                      <div className="flex items-center justify-between pb-2 border-b border-white/10">
                        <span className="text-xs font-semibold text-white uppercase tracking-wider">
                          Selected Files ({queuedFiles.length})
                        </span>
                        {!isUploading && (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => fileInputRef.current?.click()}
                              className="text-xs text-primary hover:text-primary/80 flex items-center gap-1 font-medium"
                            >
                              <Plus className="w-3.5 h-3.5" /> Add more
                            </button>
                            <span className="text-muted-foreground text-xs">•</span>
                            <button
                              type="button"
                              onClick={() => {
                                queuedFiles.forEach((f) => {
                                  if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
                                });
                                setQueuedFiles([]);
                              }}
                              className="text-xs text-red-400 hover:text-red-300 font-medium"
                            >
                              Clear all
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-72 overflow-y-auto p-1">
                        {queuedFiles.map((item, idx) => (
                          <div
                            key={item.id}
                            className="p-3 bg-white/5 border border-white/10 rounded-xl flex gap-3 relative group hover:border-white/20 transition"
                          >
                            <div className="w-20 h-20 rounded-lg bg-black/40 overflow-hidden shrink-0 border border-white/10 flex items-center justify-center">
                              {activeTab === "image" ? (
                                <img
                                  src={item.previewUrl}
                                  alt={item.title}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <video
                                  src={item.previewUrl}
                                  className="w-full h-full object-cover"
                                />
                              )}
                            </div>

                            <div className="flex-1 min-w-0 flex flex-col justify-between">
                              <div>
                                <div className="flex items-center justify-between gap-1">
                                  <span className="text-[11px] text-muted-foreground truncate font-mono">
                                    #{idx + 1} • {formatFileSize(item.size)}
                                  </span>
                                  {!isUploading && (
                                    <button
                                      type="button"
                                      onClick={() => removeQueuedFile(item.id)}
                                      className="text-muted-foreground hover:text-red-400 p-0.5 rounded transition"
                                      title="Remove from queue"
                                    >
                                      <X className="w-4 h-4" />
                                    </button>
                                  )}
                                </div>
                                <input
                                  type="text"
                                  value={item.title}
                                  disabled={isUploading}
                                  onChange={(e) => updateQueuedFileTitle(item.id, e.target.value)}
                                  className="mt-1.5 w-full bg-slate-900/80 border border-white/10 rounded px-2 py-1 text-xs text-white placeholder-muted-foreground focus:ring-1 focus:ring-primary outline-none"
                                  placeholder="Title / Caption"
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="pt-2 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setIsDirectUrlMode(true)}
                      className="text-xs text-muted-foreground hover:text-white underline"
                    >
                      Or paste a direct URL instead
                    </button>
                  </div>
                </div>
              )}

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  disabled={isUploading}
                  className="px-5 py-2.5 rounded-lg text-sm font-medium text-white hover:bg-white/10 transition disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUploading || (!editingItem && !isDirectUrlMode && queuedFiles.length === 0)}
                  className="px-6 py-2.5 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition shadow-lg shadow-primary/20 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Uploading {queuedFiles.length > 1 ? `(${queuedFiles.length})` : ""}...
                    </>
                  ) : editingItem ? (
                    "Save Changes"
                  ) : isDirectUrlMode ? (
                    "Add Media Item"
                  ) : (
                    `Upload ${queuedFiles.length > 0 ? `${queuedFiles.length} ` : ""}${activeTab === "image" ? "Images" : "Videos"}`
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
