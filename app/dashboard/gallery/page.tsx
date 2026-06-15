"use client";

import { useState } from "react";
import { useRealtimeCollection } from "../../../hooks/useRealtimeCollection";
import { useAuth } from "../../../hooks/useAuth";
import { createDocument, updateDocument, deleteDocument, updateOrderBatch } from "../../../lib/firebase/firestore";
import { uploadImage } from "../../../lib/firebase/storage";
import { getDeleteConfirmationMessage } from "../../../lib/messages";
import { DraggableList } from "../../../components/DraggableList";
import { AIContentGenerator } from "../../../components/AIContentGenerator";
import { Plus, Pencil, Trash2, Image as ImageIcon, Video, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface MediaItem {
  id: string;
  title: string;
  url: string;
  type: "image" | "video";
  order: number;
}

export default function GalleryPage() {
  const { data: media, loading } = useRealtimeCollection<MediaItem>("gallery");
  const { user } = useAuth();
  const isViewer = user?.role === "viewer";
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MediaItem | null>(null);
  const [activeTab, setActiveTab] = useState<"image" | "video">("image");
  const [uploadingMedia, setUploadingMedia] = useState(false);

  const [formData, setFormData] = useState({
    title: "",
    url: "",
  });

  const activeMedia = media.filter(m => m.type === activeTab);

  const handleOpenModal = (item?: MediaItem) => {
    if (item) {
      setEditingItem(item);
      setFormData({
        title: item.title,
        url: item.url,
      });
    } else {
      setEditingItem(null);
      setFormData({ title: "", url: "" });
    }
    setIsModalOpen(true);
  };

  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setUploadingMedia(true);
    try {
      const file = e.target.files[0];
      const url = await uploadImage(file, "gallery");
      setFormData(prev => ({ ...prev, url }));
      toast.success(`${activeTab === "image" ? "Image" : "Video"} uploaded!`);
    } catch (err: any) {
      toast.error(err.message || "Failed to upload media.");
    } finally {
      setUploadingMedia(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isViewer) return;
    try {
      if (editingItem) {
        await updateDocument("gallery", editingItem.id, { ...formData, type: activeTab });
        toast.success("Media updated!");
      } else {
        const order = activeMedia.length;
        await createDocument("gallery", { ...formData, type: activeTab, order });
        toast.success("Media added!");
      }
      setIsModalOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Something went wrong.");
    }
  };

  const handleDelete = async (id: string, title?: string) => {
    if (isViewer) return;
    if (confirm(getDeleteConfirmationMessage("media item", title))) {
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
          <p className="text-muted-foreground mt-1">Upload and reorder images and videos for the public gallery.</p>
        </div>
        {!isViewer && (
          <button
            onClick={() => handleOpenModal()}
            className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg font-medium flex items-center justify-center gap-2 transition"
          >
            <Plus className="w-5 h-5" /> Add Media
          </button>
        )}
      </div>

      <div className="flex items-center gap-4 mb-6 bg-slate-900/50 p-1.5 rounded-xl border border-white/5 w-fit">
        <button 
          onClick={() => setActiveTab("image")}
          className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${activeTab === "image" ? "bg-white/10 text-white shadow-sm" : "text-muted-foreground hover:text-white hover:bg-white/5"}`}
        >
          <ImageIcon className="w-4 h-4" /> Images
        </button>
        <button 
          onClick={() => setActiveTab("video")}
          className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${activeTab === "video" ? "bg-white/10 text-white shadow-sm" : "text-muted-foreground hover:text-white hover:bg-white/5"}`}
        >
          <Video className="w-4 h-4" /> Videos
        </button>
      </div>

      <div className="bg-slate-900/50 p-6 rounded-2xl border border-white/5 shadow-xl min-h-[400px]">
        {loading ? (
          <div className="text-white p-8 animate-pulse flex items-center gap-3">
            <Loader2 className="animate-spin w-5 h-5"/> Loading gallery...
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
                    {item.url.includes("mp4") ? (
                      <video src={item.url} className="w-full h-full object-cover" />
                    ) : (
                      <Video className="w-6 h-6 text-muted-foreground" />
                    )}
                  </div>
                )}
                
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-white">{item.title || "Untitled Media"}</h3>
                  <a href={item.url} target="_blank" rel="noreferrer" className="text-xs text-blue-400 hover:text-blue-300 truncate block max-w-sm mt-1">{item.url}</a>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="glass-panel w-full max-w-lg rounded-2xl p-6 relative max-h-[90vh] overflow-y-auto">
            <button onClick={() => setIsModalOpen(false)} className="absolute top-4 right-4 p-2 text-muted-foreground hover:text-white transition">
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-2xl font-semibold text-white mb-6">
              {editingItem ? `Edit ${activeTab === "image" ? "Image" : "Video"}` : `Add ${activeTab === "image" ? "Image" : "Video"}`}
            </h2>

            <form onSubmit={handleSave} className="space-y-5">
              <div className="p-4 border border-dashed border-white/20 rounded-xl bg-white/5 flex flex-col items-center justify-center gap-3 relative overflow-hidden">
                 {formData.url ? (
                   activeTab === "image" ? 
                     <img src={formData.url} alt="Preview" className="w-full h-32 object-contain" /> :
                     <div className="text-sm font-mono text-primary w-full text-center truncate">{formData.url}</div>
                 ) : (
                   <div className="text-center">
                     {activeTab === "image" ? <ImageIcon className="w-8 h-8 text-muted-foreground mx-auto mb-2" /> : <Video className="w-8 h-8 text-muted-foreground mx-auto mb-2" />}
                     <p className="text-xs text-muted-foreground font-medium">Click to upload {activeTab} file</p>
                   </div>
                 )}
                 
                 <label className="absolute inset-0 cursor-pointer flex items-center justify-center bg-black/50 opacity-0 hover:opacity-100 transition-opacity">
                    {uploadingMedia ? <Loader2 className="w-6 h-6 text-white animate-spin" /> : <span className="text-white text-sm font-bold bg-black/50 px-3 py-1 rounded-full">Select File</span>}
                    <input type="file" accept={activeTab === "image" ? "image/*" : "video/*"} onChange={handleMediaUpload} className="hidden" />
                 </label>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-muted-foreground">Title / Caption</label>
                  <AIContentGenerator 
                    title={activeTab === "image" ? "Image from Gallery" : "Video from Gallery"}
                    category={`Gallery ${activeTab}`}
                    onGenerated={(content) => setFormData({ ...formData, title: content })}
                  />
                </div>
                <input type="text" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} className="w-full bg-slate-950/50 border border-white/10 rounded-lg p-3 text-white focus:ring-2 focus:ring-primary/50 outline-none transition" placeholder="A beautiful sunset..." />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">Direct URL (Optional if uploading)</label>
                <input type="url" value={formData.url} onChange={(e) => setFormData({ ...formData, url: e.target.value })} className="w-full bg-slate-950/50 border border-white/10 rounded-lg p-3 text-white focus:ring-2 focus:ring-primary/50 outline-none transition" placeholder="https://..." required />
              </div>

              <div className="pt-6 flex justify-end gap-3 border-t border-white/10">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 rounded-lg text-sm font-medium text-white hover:bg-white/10 transition">Cancel</button>
                <button type="submit" className="px-5 py-2.5 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition shadow-lg shadow-primary/20">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
