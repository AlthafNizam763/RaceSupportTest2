"use client";

import { useState } from "react";
import { useRealtimeCollection } from "../hooks/useRealtimeCollection";
import { createDocument, updateDocument, deleteDocument, updateOrderBatch } from "../lib/firebase/firestore";
import { uploadImage } from "../lib/firebase/storage";
import { DraggableList } from "./DraggableList";
import { AIContentGenerator } from "./AIContentGenerator";
import { Plus, Pencil, Trash2, Image as ImageIcon, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../hooks/useAuth";
import { getDeleteConfirmationMessage } from "../lib/messages";

interface ActionPlanItem {
  id: string;
  title: string;
  description: string;
  images: string[];
  order: number;
}

interface Props {
  collectionName: string;
  pageTitle: string;
  pageSubtitle: string;
}

export function GenericActionPlanPage({ collectionName, pageTitle, pageSubtitle }: Props) {
  const { data: items, loading } = useRealtimeCollection<ActionPlanItem>(collectionName);
  const { user } = useAuth();
  const isViewer = user?.role === "viewer";
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ActionPlanItem | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    images: [] as string[],
  });

  const handleOpenModal = (item?: ActionPlanItem) => {
    if (item) {
      setEditingItem(item);
      setFormData({
        title: item.title,
        description: item.description,
        images: item.images || [],
      });
    } else {
      setEditingItem(null);
      setFormData({ title: "", description: "", images: [] });
    }
    setIsModalOpen(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setUploadingImage(true);
    try {
      const file = e.target.files[0];
      const url = await uploadImage(file, collectionName);
      setFormData(prev => ({ ...prev, images: [...prev.images, url] }));
      toast.success("Image uploaded!");
    } catch (err: any) {
      toast.error(err.message || "Failed to upload image.");
    } finally {
      setUploadingImage(false);
    }
  };

  const removeImage = (index: number) => {
    setFormData(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isViewer) return;
    try {
      if (editingItem) {
        await updateDocument(collectionName, editingItem.id, formData);
        toast.success(`${pageTitle} item updated!`);
      } else {
        const order = items.length;
        await createDocument(collectionName, { ...formData, order });
        toast.success(`${pageTitle} item created!`);
      }
      setIsModalOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Something went wrong saving the item.");
    }
  };

  const handleDelete = async (id: string, itemTitle?: string) => {
    if (isViewer) return;
    if (confirm(getDeleteConfirmationMessage("item", itemTitle))) {
      try {
        await deleteDocument(collectionName, id);
        toast.success("Item deleted.");
      } catch (err: any) {
        toast.error(err.message || "Failed to delete item.");
      }
    }
  };

  const handleReorder = async (reorderedItems: ActionPlanItem[]) => {
    if (isViewer) return;
    try {
      const updates = reorderedItems.map((item, index) => ({ id: item.id, order: index }));
      await updateOrderBatch(collectionName, updates);
      toast.success("Order saved! 🔄", { duration: 2000 });
    } catch (err) {
      toast.error("Failed to reorder items.");
    }
  };

  return (
    <>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">{pageTitle}</h1>
          <p className="text-muted-foreground mt-1">{pageSubtitle}</p>
        </div>
        {!isViewer && (
          <button
            onClick={() => handleOpenModal()}
            className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg font-medium flex items-center justify-center gap-2 transition"
          >
            <Plus className="w-5 h-5" /> Add New Item
          </button>
        )}
      </div>

      <div className="bg-slate-900/50 p-6 rounded-2xl border border-white/5 shadow-xl min-h-[400px]">
        {loading ? (
          <div className="text-white p-8 animate-pulse flex items-center gap-3">
            <Loader2 className="animate-spin w-5 h-5"/> Loading {pageTitle}...
          </div>
        ) : (
          <DraggableList
            disabled={isViewer}
            items={items}
            onReorder={handleReorder}
            renderItem={(item) => (
              <div className="flex flex-col md:flex-row gap-4 items-start md:items-center w-full">
                {item.images && item.images.length > 0 ? (
                  <div className="w-24 h-16 rounded-lg bg-white/5 border border-white/10 overflow-hidden shrink-0">
                    <img src={item.images[0]} alt={item.title} className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="w-24 h-16 bg-white/5 rounded-lg flex items-center justify-center text-muted-foreground shrink-0 border border-white/10">
                    <ImageIcon className="w-6 h-6" />
                  </div>
                )}
                
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-white mb-1">{item.title}</h3>
                  <p className="text-sm text-muted-foreground line-clamp-2">{item.description}</p>
                  {item.images && item.images.length > 1 && (
                    <span className="text-xs font-mono text-primary mt-1 inline-block bg-primary/10 px-2 py-0.5 rounded-md">
                      +{item.images.length - 1} more images
                    </span>
                  )}
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
          <div className="glass-panel w-full max-w-2xl rounded-2xl p-6 relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 p-2 text-muted-foreground hover:text-white transition"
            >
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-2xl font-semibold text-white mb-6">
              {editingItem ? `Edit ${pageTitle}` : `Create ${pageTitle}`}
            </h2>

            <form onSubmit={handleSave} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">Title / Heading</label>
                <input
                  required
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full bg-slate-950/50 border border-white/10 rounded-lg p-3 text-white focus:ring-2 focus:ring-primary/50 outline-none transition"
                  placeholder="Enter heading..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">Images</label>
                <div className="flex flex-wrap gap-4 mb-3">
                  {formData.images.map((img, idx) => (
                    <div key={idx} className="relative w-24 h-24 rounded-lg overflow-hidden border border-white/10 group">
                      <img src={img} alt="Upload" className="w-full h-full object-cover" />
                      <button 
                        type="button" 
                        onClick={() => removeImage(idx)}
                        className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="w-5 h-5 text-red-400" />
                      </button>
                    </div>
                  ))}
                  
                  <label className="w-24 h-24 flex flex-col items-center justify-center bg-white/5 hover:bg-white/10 border border-dashed border-white/20 rounded-lg cursor-pointer transition text-muted-foreground hover:text-white">
                    {uploadingImage ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-6 h-6" />}
                    <span className="text-[10px] mt-1 uppercase font-semibold">Upload</span>
                    <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                  </label>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-muted-foreground">Description / Paragraph</label>
                  <AIContentGenerator 
                    title={formData.title} 
                    category={collectionName}
                    onGenerated={(content) => setFormData({ ...formData, description: content })}
                  />
                </div>
                <textarea
                  rows={5}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full bg-slate-950/50 border border-white/10 rounded-lg p-3 text-white focus:ring-2 focus:ring-primary/50 outline-none transition resize-none"
                  placeholder="Write an engaging paragraph..."
                />
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 rounded-lg text-sm font-medium text-white hover:bg-white/10 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition shadow-lg shadow-primary/20"
                >
                  {editingItem ? "Save Changes" : "Create Item"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
