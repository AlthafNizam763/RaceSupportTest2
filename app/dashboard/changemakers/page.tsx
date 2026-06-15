"use client";

import { useState } from "react";
import { useRealtimeCollection } from "../../../hooks/useRealtimeCollection";
import { useAuth } from "../../../hooks/useAuth";
import { createDocument, updateDocument, deleteDocument, updateOrderBatch } from "../../../lib/firebase/firestore";
import { uploadImage } from "../../../lib/firebase/storage";
import { getDeleteConfirmationMessage } from "../../../lib/messages";
import { DraggableList } from "../../../components/DraggableList";
import { AIContentGenerator } from "../../../components/AIContentGenerator";
import { Plus, Pencil, Trash2, Image as ImageIcon, X, Loader2, Star } from "lucide-react";
import { toast } from "sonner";

interface Changemaker {
  id: string;
  name: string;
  title: string;
  image: string;
  order: number;
}

export default function ChangemakersPage() {
  const { data: members, loading } = useRealtimeCollection<Changemaker>("changemakers");
  const { user } = useAuth();
  const isViewer = user?.role === "viewer";
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Changemaker | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    title: "",
    image: "",
  });

  const handleOpenModal = (item?: Changemaker) => {
    if (item) {
      setEditingItem(item);
      setFormData({
        name: item.name,
        title: item.title,
        image: item.image || "",
      });
    } else {
      setEditingItem(null);
      setFormData({ name: "", title: "", image: "" });
    }
    setIsModalOpen(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setUploadingImage(true);
    try {
      const file = e.target.files[0];
      const url = await uploadImage(file, "changemakers");
      setFormData(prev => ({ ...prev, image: url }));
      toast.success("Image uploaded!");
    } catch (err: any) {
      toast.error(err.message || "Failed to upload image.");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isViewer) return;
    try {
      if (editingItem) {
        await updateDocument("changemakers", editingItem.id, formData);
        toast.success("Changemaker updated!");
      } else {
        const order = members.length;
        await createDocument("changemakers", { ...formData, order });
        toast.success("Changemaker added!");
      }
      setIsModalOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Something went wrong.");
    }
  };

  const handleDelete = async (id: string, name?: string) => {
    if (isViewer) return;
    if (confirm(getDeleteConfirmationMessage("changemaker", name))) {
      try {
        await deleteDocument("changemakers", id);
        toast.success("Deleted successfully.");
      } catch (err) {
        toast.error("Failed to delete.");
      }
    }
  };

  const handleReorder = async (reorderedItems: Changemaker[]) => {
    if (isViewer) return;
    try {
      const updates = reorderedItems.map((item, index) => ({ id: item.id, order: index }));
      await updateOrderBatch("changemakers", updates);
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
             <Star className="w-8 h-8 text-yellow-500 pb-1" />
             Changemakers
          </h1>
          <p className="text-muted-foreground mt-1">Manage the profiles of notable changemakers.</p>
        </div>
        {!isViewer && (
          <button
            onClick={() => handleOpenModal()}
            className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg font-medium flex items-center justify-center gap-2 transition"
          >
            <Plus className="w-5 h-5" /> Add Changemaker
          </button>
        )}
      </div>

      <div className="bg-slate-900/50 p-6 rounded-2xl border border-white/5 shadow-xl min-h-[400px]">
        {loading ? (
          <div className="text-white p-8 animate-pulse flex items-center gap-3">
            <Loader2 className="animate-spin w-5 h-5"/> Loading changemakers...
          </div>
        ) : (
          <DraggableList
            disabled={isViewer}
            items={members}
            onReorder={handleReorder}
            renderItem={(item) => (
              <div className="flex flex-col md:flex-row gap-4 items-start md:items-center w-full">
                {item.image ? (
                  <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 overflow-hidden shrink-0 shadow-lg">
                    <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center text-muted-foreground shrink-0 border border-white/10">
                    <ImageIcon className="w-6 h-6" />
                  </div>
                )}
                
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-white">{item.name}</h3>
                  <p className="text-sm text-yellow-500 font-medium">{item.title}</p>
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
                      onClick={() => handleDelete(item.id, item.name)}
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
              {editingItem ? "Edit Changemaker" : "Add Changemaker"}
            </h2>

            <form onSubmit={handleSave} className="space-y-5">
              <div className="flex items-center justify-center mb-6">
                 <div className="relative w-24 h-24 rounded-full overflow-hidden border-2 border-white/10 group bg-slate-900/50 flex items-center justify-center">
                    {formData.image ? (
                      <img src={formData.image} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon className="w-8 h-8 text-muted-foreground" />
                    )}
                    <label className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                      {uploadingImage ? <Loader2 className="w-5 h-5 text-white animate-spin" /> : (
                        <>
                          <Plus className="w-5 h-5 text-white" />
                          <span className="text-[10px] text-white font-semibold mt-1">UPLOAD</span>
                        </>
                      )}
                      <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                    </label>
                 </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">Name</label>
                <input required type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full bg-slate-950/50 border border-white/10 rounded-lg p-3 text-white focus:ring-2 focus:ring-primary/50 outline-none transition" />
              </div>
              
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-muted-foreground">Title / Designation</label>
                  <AIContentGenerator 
                    title={formData.name}
                    category="Changemaker Designation"
                    onGenerated={(content) => setFormData({ ...formData, title: content })}
                  />
                </div>
                <input required type="text" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} className="w-full bg-slate-950/50 border border-white/10 rounded-lg p-3 text-white focus:ring-2 focus:ring-primary/50 outline-none transition" />
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
