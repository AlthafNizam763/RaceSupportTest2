"use client";

import { useState } from "react";
import { useRealtimeCollection } from "../../../hooks/useRealtimeCollection";
import { createDocument, updateDocument, deleteDocument, updateOrderBatch } from "../../../lib/firebase/firestore";
import { uploadImage } from "../../../lib/firebase/storage";
import { DraggableList } from "../../../components/DraggableList";
import { AIContentGenerator } from "../../../components/AIContentGenerator";
import { Plus, Pencil, Trash2, Image as ImageIcon, X, Loader2, Link as LinkIcon, Award } from "lucide-react";
import { toast } from "sonner";

interface TeamMember {
  id: string;
  name: string;
  role: string;
  image: string;
  points?: number;
  link?: string;
  description?: string;
  type: "leader" | "it";
  order: number;
}

export default function TeamPage() {
  const { data: members, loading } = useRealtimeCollection<TeamMember>("team_members");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<TeamMember | null>(null);
  const [activeTab, setActiveTab] = useState<"leader" | "it">("leader");
  const [uploadingImage, setUploadingImage] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    role: "",
    image: "",
    points: 0,
    link: "",
    description: "",
  });

  const activeMembers = members.filter(m => m.type === activeTab);

  const handleOpenModal = (item?: TeamMember) => {
    if (item) {
      setEditingItem(item);
      setFormData({
        name: item.name,
        role: item.role,
        image: item.image || "",
        points: item.points || 0,
        link: item.link || "",
        description: item.description || "",
      });
    } else {
      setEditingItem(null);
      setFormData({ name: "", role: "", image: "", points: 0, link: "", description: "" });
    }
    setIsModalOpen(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setUploadingImage(true);
    try {
      const file = e.target.files[0];
      const url = await uploadImage(file, "team");
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
    try {
      if (editingItem) {
        await updateDocument("team_members", editingItem.id, { ...formData, type: activeTab });
        toast.success("Member updated!");
      } else {
        const order = activeMembers.length;
        await createDocument("team_members", { ...formData, type: activeTab, order });
        toast.success("Member added!");
      }
      setIsModalOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Something went wrong.");
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Remove this team member?")) {
      try {
        await deleteDocument("team_members", id);
        toast.success("Member deleted.");
      } catch (err) {
        toast.error("Failed to delete.");
      }
    }
  };

  const handleReorder = async (reorderedItems: TeamMember[]) => {
    try {
      const updates = reorderedItems.map((item, index) => ({ id: item.id, order: index }));
      await updateOrderBatch("team_members", updates);
      toast.success("Order saved! 🔄", { duration: 2000 });
    } catch (err) {
      toast.error("Failed to reorder items.");
    }
  };

  return (
    <>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Team RACE</h1>
          <p className="text-muted-foreground mt-1">Manage Leaders and the IT & Media Cell profiles.</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg font-medium flex items-center justify-center gap-2 transition"
        >
          <Plus className="w-5 h-5" /> Add Member
        </button>
      </div>

      <div className="flex items-center gap-4 mb-6 bg-slate-900/50 p-1.5 rounded-xl border border-white/5 w-fit">
        <button 
          onClick={() => setActiveTab("leader")}
          className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === "leader" ? "bg-white/10 text-white shadow-sm" : "text-muted-foreground hover:text-white hover:bg-white/5"}`}
        >
          Leader Section
        </button>
        <button 
          onClick={() => setActiveTab("it")}
          className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === "it" ? "bg-white/10 text-white shadow-sm" : "text-muted-foreground hover:text-white hover:bg-white/5"}`}
        >
          IT & Media Cell
        </button>
      </div>

      <div className="bg-slate-900/50 p-6 rounded-2xl border border-white/5 shadow-xl min-h-[400px]">
        {loading ? (
          <div className="text-white p-8 animate-pulse flex items-center gap-3">
            <Loader2 className="animate-spin w-5 h-5"/> Loading team...
          </div>
        ) : (
          <DraggableList
            items={activeMembers}
            onReorder={handleReorder}
            renderItem={(item) => (
              <div className="flex flex-col md:flex-row gap-4 items-start md:items-center w-full">
                {item.image ? (
                  <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 overflow-hidden shrink-0">
                    <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center text-muted-foreground shrink-0 border border-white/10">
                    <ImageIcon className="w-6 h-6" />
                  </div>
                )}
                
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-white">{item.name}</h3>
                  <p className="text-sm text-primary font-medium">{item.role}</p>
                  
                  <div className="flex items-center gap-4 mt-2">
                    {item.points !== undefined && activeTab === "leader" && (
                      <span className="flex items-center gap-1 text-xs text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full">
                        <Award className="w-3 h-3" /> {item.points} Points
                      </span>
                    )}
                    {item.link && (
                      <a href={item.link} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300">
                        <LinkIcon className="w-3 h-3" /> External Link
                      </a>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-4 md:mt-0 shrink-0">
                  <button
                    onClick={() => handleOpenModal(item)}
                    className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-blue-400 transition"
                    title="Edit"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="p-2 bg-white/5 hover:bg-destructive/20 rounded-lg text-red-500 transition"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
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
              {editingItem ? `Edit ${activeTab === "leader" ? "Leader" : "IT Member"}` : `Add ${activeTab === "leader" ? "Leader" : "IT Member"}`}
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
                <label className="block text-sm font-medium text-muted-foreground mb-1">{activeTab === "leader" ? "Role/Position" : "Designation"}</label>
                <input required type="text" value={formData.role} onChange={(e) => setFormData({ ...formData, role: e.target.value })} className="w-full bg-slate-950/50 border border-white/10 rounded-lg p-3 text-white focus:ring-2 focus:ring-primary/50 outline-none transition" />
              </div>

              {activeTab === "leader" && (
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1">Points</label>
                  <input type="number" value={formData.points} onChange={(e) => setFormData({ ...formData, points: parseInt(e.target.value) || 0 })} className="w-full bg-slate-950/50 border border-white/10 rounded-lg p-3 text-white focus:ring-2 focus:ring-primary/50 outline-none transition" />
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-muted-foreground">Bio / Description</label>
                  <AIContentGenerator 
                    title={formData.name}
                    category={`Team Member (${activeTab})`}
                    onGenerated={(content) => setFormData({ ...formData, description: content })}
                  />
                </div>
                <textarea 
                  rows={3}
                  value={formData.description} 
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })} 
                  className="w-full bg-slate-950/50 border border-white/10 rounded-lg p-3 text-white focus:ring-2 focus:ring-primary/50 outline-none transition resize-none" 
                  placeholder="Generate or write a short bio..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">External Link (Optional)</label>
                <input type="url" value={formData.link} onChange={(e) => setFormData({ ...formData, link: e.target.value })} className="w-full bg-slate-950/50 border border-white/10 rounded-lg p-3 text-white focus:ring-2 focus:ring-primary/50 outline-none transition" placeholder="https://..." />
              </div>

              <div className="pt-6 flex justify-end gap-3 border-t border-white/10">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 rounded-lg text-sm font-medium text-white hover:bg-white/10 transition">Cancel</button>
                <button type="submit" className="px-5 py-2.5 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition shadow-lg shadow-primary/20">{editingItem ? "Save Changes" : "Save Member"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
