"use client";

import { useState } from "react";
import { useRealtimeCollection } from "../../../../hooks/useRealtimeCollection";
import { useAuth } from "../../../../hooks/useAuth";
import { createDocument, updateDocument, deleteDocument, updateOrderBatch } from "../../../../lib/firebase/firestore";
import { DraggableList } from "../../../../components/DraggableList";
import { getDeleteConfirmationMessage } from "../../../../lib/messages";
import { AIContentGenerator } from "../../../../components/AIContentGenerator";
import { Plus, Pencil, Trash2, Calendar, Image as ImageIcon, X } from "lucide-react";
import { toast } from "sonner";

interface EventItem {
  id: string;
  title: string;
  description: string;
  date: string;
  status: "Ongoing" | "Past";
  order: number;
}

export default function EventsPage() {
  const { data: events, loading } = useRealtimeCollection<EventItem>("events");
  const { user } = useAuth();
  const isViewer = user?.role === "viewer";
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<EventItem | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    date: "",
    status: "Ongoing",
  });

  const handleOpenModal = (item?: EventItem) => {
    if (item) {
      setEditingItem(item);
      setFormData({
        title: item.title,
        description: item.description,
        date: item.date,
        status: item.status,
      });
    } else {
      setEditingItem(null);
      setFormData({ title: "", description: "", date: "", status: "Ongoing" });
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isViewer) return;
    try {
      if (editingItem) {
        await updateDocument("events", editingItem.id, formData);
        toast.success("Event updated successfully!");
      } else {
        const order = events.length; // place at bottom
        await createDocument("events", { ...formData, order });
        toast.success("Event created successfully!");
      }
      setIsModalOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Something went wrong saving the event.");
    }
  };

  const handleDelete = async (id: string, title?: string) => {
    if (isViewer) return;
    if (confirm(getDeleteConfirmationMessage("event", title))) {
      try {
        await deleteDocument("events", id);
        toast.success("Event deleted.");
      } catch (err) {
        toast.error("Failed to delete event.");
      }
    }
  };

  const handleReorder = async (reorderedItems: EventItem[]) => {
    if (isViewer) return;
    try {
      // Create batch update payload
      const updates = reorderedItems.map((item, index) => ({
        id: item.id,
        order: index,
      }));
      // We rely on realtime listener to update UI instantly without full refresh
      await updateOrderBatch("events", updates);
      toast.success("Order saved! 🔄", { duration: 2000 });
    } catch (err) {
      toast.error("Failed to reorder items.");
    }
  };

  return (
    <>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Events Management</h1>
          <p className="text-muted-foreground mt-1">Manage ongoing and past events with drag-and-drop reordering.</p>
        </div>
        {!isViewer && (
          <button
            onClick={() => handleOpenModal()}
            className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg font-medium flex items-center justify-center gap-2 transition"
          >
            <Plus className="w-5 h-5" /> Add New Event
          </button>
        )}
      </div>

      <div className="bg-slate-900/50 p-6 rounded-2xl border border-white/5 shadow-xl min-h-[400px]">
        {loading ? (
          <div className="text-white p-8 animate-pulse flex items-center gap-3 text-white">
            <Calendar className="animate-spin w-5 h-5 text-primary"/> Loading events...
          </div>
        ) : (
          <DraggableList
            disabled={isViewer}
            items={events}
            onReorder={handleReorder}
            renderItem={(item) => (
              <div className="flex flex-col md:flex-row gap-4 items-start md:items-center w-full">
                <div className="w-16 h-16 bg-white/5 rounded-lg flex items-center justify-center text-muted-foreground shrink-0 border border-white/10">
                  <ImageIcon className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-lg font-semibold text-white">{item.title}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${item.status === 'Ongoing' ? 'bg-green-500/20 text-green-400' : 'bg-white/10 text-muted-foreground'}`}>
                      {item.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <Calendar className="w-4 h-4" /> {item.date || "No date set"}
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-1">{item.description}</p>
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
              {editingItem ? "Edit Event" : "Create Event"}
            </h2>

            <form onSubmit={handleSave} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">Event Title</label>
                <input
                  required
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full bg-slate-950/50 border border-white/10 rounded-lg p-3 text-white focus:ring-2 focus:ring-primary/50 outline-none transition"
                  placeholder="E.g. Annual Tech Symposium"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1">Date</label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full bg-slate-950/50 border border-white/10 rounded-lg p-3 text-white focus:ring-2 focus:ring-primary/50 outline-none transition [color-scheme:dark]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full bg-slate-950/50 border border-white/10 rounded-lg p-3 text-white focus:ring-2 focus:ring-primary/50 outline-none transition"
                  >
                    <option value="Ongoing">Ongoing</option>
                    <option value="Past">Past</option>
                  </select>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-muted-foreground">Description</label>
                  <AIContentGenerator 
                    title={formData.title} 
                    category="Event"
                    onGenerated={(content) => setFormData({ ...formData, description: content })}
                  />
                </div>
                <textarea
                  required
                  rows={4}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full bg-slate-950/50 border border-white/10 rounded-lg p-3 text-white focus:ring-2 focus:ring-primary/50 outline-none transition resize-none"
                  placeholder="Describe the event..."
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
                  {editingItem ? "Save Changes" : "Create Event"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
