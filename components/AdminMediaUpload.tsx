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
  FileText,
  Search,
  Filter,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import {
  MediaItem,
  listMedia,
  updateMediaTitle,
  deleteMedia,
  uploadMediaToImageKit,
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

export default function AdminMediaUpload() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  // State: media items & pagination
  const [mediaList, setMediaList] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Filters
  const [mediaTypeFilter, setMediaTypeFilter] = useState<"all" | "image" | "video">("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Upload Form State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [titleInput, setTitleInput] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Edit Title State
  const [editingItem, setEditingItem] = useState<MediaItem | null>(null);
  const [editTitleValue, setEditTitleValue] = useState("");
  const [isUpdatingTitle, setIsUpdatingTitle] = useState(false);

  // Delete Confirmation State
  const [deletingItem, setDeletingItem] = useState<MediaItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Preview Modal
  const [previewItem, setPreviewItem] = useState<MediaItem | null>(null);

  // Copied URL feedback
  const [copiedId, setCopiedId] = useState<string | null>(null);

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

  // Handle File Selection
  const handleFileChange = (file: File | null) => {
    if (!file) {
      setSelectedFile(null);
      return;
    }

    try {
      validateMediaFile(file);
      setSelectedFile(file);
      if (!titleInput.trim()) {
        // Auto-fill title from clean filename
        const cleanName = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
        setTitleInput(cleanName.charAt(0).toUpperCase() + cleanName.slice(1));
      }
    } catch (err: any) {
      toast.error(err.message || "Invalid file selected.");
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Drag and drop handlers
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  // Perform Upload
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      toast.error("Please select a file to upload.");
      return;
    }

    if (!isAdmin) {
      toast.error("Only administrators can upload media.");
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const saved = await uploadMediaToImageKit(
        selectedFile,
        titleInput,
        (progress) => setUploadProgress(progress)
      );

      toast.success(`"${saved.title}" uploaded and saved to Firestore!`);

      // Reset form
      setSelectedFile(null);
      setTitleInput("");
      setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = "";

      // Refresh media list without full reload
      fetchMedia();
    } catch (err: any) {
      console.error("Upload failed:", err);
      toast.error(err.message || "Upload failed. Please check your connection and credentials.");
    } finally {
      setIsUploading(false);
    }
  };

  // Perform Title Edit
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

  // Perform Deletion
  const handleDeleteConfirm = async () => {
    if (!deletingItem) return;

    setIsDeleting(true);
    try {
      await deleteMedia(deletingItem.id);
      toast.success(`"${deletingItem.title}" deleted from ImageKit and Firestore.`);
      setDeletingItem(null);
      fetchMedia();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete media.");
    } finally {
      setIsDeleting(false);
    }
  };

  // Copy URL to clipboard
  const handleCopyUrl = (item: MediaItem) => {
    navigator.clipboard.writeText(item.url);
    setCopiedId(item.id);
    toast.success("Media URL copied to clipboard!");
    setTimeout(() => setCopiedId(null), 2500);
  };

  // Client-side search filter
  const filteredList = mediaList.filter((m) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      m.title.toLowerCase().includes(q) ||
      m.fileName.toLowerCase().includes(q) ||
      m.mediaType.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-8">
      {/* ─── UPLOAD SECTION ─── */}
      <section className="bg-slate-900/60 border border-white/10 rounded-2xl p-6 backdrop-blur-xl shadow-2xl">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20 text-primary">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Upload New Media</h2>
              <p className="text-xs text-muted-foreground">
                Direct ImageKit cloud upload with Firestore metadata synchronization
              </p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-[11px] text-muted-foreground/80 bg-white/5 px-3 py-1.5 rounded-lg border border-white/5">
            <span>Images: ≤ 25MB (JPEG, PNG, WEBP, GIF)</span>
            <span>•</span>
            <span>Videos: ≤ 100MB (MP4, WEBM)</span>
          </div>
        </div>

        <form onSubmit={handleUploadSubmit} className="space-y-4">
          {/* Dropzone */}
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
              accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm"
              className="hidden"
              onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
              disabled={isUploading}
            />

            <div className="flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-muted-foreground border border-white/10">
                <UploadCloud className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">
                  {selectedFile ? (
                    <span className="text-primary font-semibold">{selectedFile.name}</span>
                  ) : (
                    <span>
                      Drag & drop your image or video here, or{" "}
                      <span className="text-primary underline">browse files</span>
                    </span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Supports JPEG, PNG, WEBP, GIF (up to 25MB) and MP4, WEBM (up to 100MB)
                </p>
              </div>
            </div>
          </div>

          {/* Selected File Details & Title Input */}
          {selectedFile && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {selectedFile.type.startsWith("video/") ? (
                    <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-lg">
                      <VideoIcon className="w-4 h-4" />
                    </div>
                  ) : (
                    <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg">
                      <ImageIcon className="w-4 h-4" />
                    </div>
                  )}
                  <div>
                    <div className="text-sm font-medium text-white truncate max-w-xs sm:max-w-md">
                      {selectedFile.name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatBytes(selectedFile.size)} • {selectedFile.type || "Unknown type"}
                    </div>
                  </div>
                </div>

                {!isUploading && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                    className="p-1.5 text-muted-foreground hover:text-white rounded-lg hover:bg-white/10 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Media Title (stored in Firestore)
                </label>
                <input
                  type="text"
                  value={titleInput}
                  onChange={(e) => setTitleInput(e.target.value)}
                  placeholder="e.g. Student Leadership Workshop"
                  disabled={isUploading}
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-muted-foreground focus:outline-none focus:border-primary transition-colors"
                />
              </div>

              {/* Upload Progress Bar */}
              {isUploading && (
                <div className="space-y-1.5 pt-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-primary font-medium flex items-center gap-1.5">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Uploading directly to ImageKit...
                    </span>
                    <span className="text-muted-foreground font-mono">{uploadProgress}%</span>
                  </div>
                  <div className="w-full h-2 bg-black/60 rounded-full overflow-hidden border border-white/5">
                    <div
                      className="h-full bg-gradient-to-r from-primary to-accent transition-all duration-200"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  disabled={isUploading}
                  className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:text-white hover:bg-white/5 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUploading}
                  className="px-5 py-2 rounded-lg text-sm font-medium bg-primary text-black hover:bg-primary/90 transition-all flex items-center gap-2 shadow-lg shadow-primary/20 disabled:opacity-50"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <UploadCloud className="w-4 h-4" />
                      Upload Media
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          )}
        </form>
      </section>

      {/* ─── MEDIA LIBRARY SECTION ─── */}
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

                      {/* Delete */}
                      <button
                        onClick={() => setDeletingItem(item)}
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

      {/* ─── MODAL: DELETE CONFIRMATION ─── */}
      <AnimatePresence>
        {deletingItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-slate-900 border border-red-500/30 rounded-2xl p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-center gap-3 text-red-400">
                <div className="p-2.5 rounded-full bg-red-500/10 border border-red-500/20">
                  <Trash2 className="w-5 h-5" />
                </div>
                <h3 className="text-base font-semibold text-white">Delete Media Item?</h3>
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed">
                Are you sure you want to delete <span className="text-white font-medium">"{deletingItem.title}"</span>?
                This action will permanently delete the remote file from your ImageKit media storage
                and remove the metadata document from Firestore.
              </p>

              <div className="flex justify-end gap-2 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setDeletingItem(null)}
                  disabled={isDeleting}
                  className="px-4 py-2 text-xs font-medium text-muted-foreground hover:text-white rounded-lg hover:bg-white/5 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteConfirm}
                  disabled={isDeleting}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-red-600 hover:bg-red-500 text-white transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-3.5 h-3.5" />
                      Confirm Delete
                    </>
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
                  <X className="w-5 h-5" />
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
