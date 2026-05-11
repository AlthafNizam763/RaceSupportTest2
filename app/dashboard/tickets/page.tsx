"use client";

import { useState } from "react";
import { useRealtimeCollection } from "../../../hooks/useRealtimeCollection";
import { updateDocument, deleteDocument } from "../../../lib/firebase/firestore";
import { 
  Ticket, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Trash2, 
  Search,
  MessageSquare,
  User,
  Filter,
  Loader2
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

interface TicketItem {
  id: string;
  subject: string;
  message: string;
  userName: string;
  userEmail: string;
  status: "Open" | "In Progress" | "Resolved";
  createdAt: any;
}

export default function TicketsPage() {
  const { data: tickets, loading } = useRealtimeCollection<TicketItem>("tickets");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("All");

  const filteredTickets = tickets.filter(ticket => {
    const matchesSearch = 
      ticket.subject?.toLowerCase().includes(searchQuery.toLowerCase()) || 
      ticket.userName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ticket.userEmail?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === "All" || ticket.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Open": return "text-red-400 bg-red-400/10 border-red-400/20";
      case "In Progress": return "text-amber-400 bg-amber-400/10 border-amber-400/20";
      case "Resolved": return "text-green-400 bg-green-400/10 border-green-400/20";
      default: return "text-gray-400 bg-gray-400/10 border-gray-400/20";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "Open": return AlertCircle;
      case "In Progress": return Clock;
      case "Resolved": return CheckCircle2;
      default: return MessageSquare;
    }
  };

  const updateStatus = async (id: string, nextStatus: string) => {
    try {
      await updateDocument("tickets", id, { status: nextStatus });
      toast.success(`Status updated to ${nextStatus}`);
    } catch (err) {
      toast.error("Failed to update status");
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Permanently delete this ticket?")) {
      try {
        await deleteDocument("tickets", id);
        toast.success("Ticket deleted");
      } catch (err) {
        toast.error("Failed to delete ticket");
      }
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
            <Ticket className="w-8 h-8 text-primary" />
            Support Tickets
          </h1>
          <p className="text-muted-foreground mt-1">Manage and respond to user queries efficiently.</p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input 
            type="text" 
            placeholder="Search tickets, names or email..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900/50 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-white focus:ring-2 focus:ring-primary/50 outline-none transition"
          />
        </div>
        <div className="flex items-center gap-2 bg-slate-900/50 border border-white/10 rounded-xl px-3 py-1">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-transparent text-sm text-white focus:outline-none cursor-pointer py-1.5"
          >
            <option value="All">All Statuses</option>
            <option value="Open">Open</option>
            <option value="In Progress">In Progress</option>
            <option value="Resolved">Resolved</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {loading ? (
          <div className="glass-panel p-12 rounded-2xl border border-white/5 animate-pulse flex items-center justify-center gap-3 text-white">
            <Loader2 className="animate-spin w-5 h-5"/> Loading tickets...
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {filteredTickets.length > 0 ? (
              filteredTickets.map((ticket) => {
                const StatusIcon = getStatusIcon(ticket.status);
                return (
                  <motion.div 
                    key={ticket.id}
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="glass-panel p-6 rounded-2xl border border-white/5 hover:border-white/10 transition-colors group"
                  >
                    <div className="flex flex-col lg:flex-row gap-6 items-start">
                      <div className="flex-1 space-y-4 w-full">
                        <div className="flex flex-wrap items-center gap-3">
                          <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${getStatusColor(ticket.status)}`}>
                            <StatusIcon className="w-3.5 h-3.5" />
                            {ticket.status}
                          </span>
                          <h3 className="text-xl font-semibold text-white group-hover:text-primary transition-colors">{ticket.subject}</h3>
                        </div>
                        
                        <p className="text-muted-foreground text-sm leading-relaxed whitespace-pre-wrap">{ticket.message}</p>
                        
                        <div className="flex flex-wrap items-center gap-6 pt-2 border-t border-white/5">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <User className="w-4 h-4 text-primary/70" />
                            <span className="font-medium text-gray-300">{ticket.userName}</span>
                            <span className="opacity-50">•</span>
                            <span className="text-xs">{ticket.userEmail}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex lg:flex-col items-center gap-3 shrink-0 w-full lg:w-auto pt-4 lg:pt-0 border-t lg:border-t-0 border-white/5">
                        <select 
                          value={ticket.status}
                          onChange={(e) => updateStatus(ticket.id, e.target.value)}
                          className="flex-1 lg:w-32 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none hover:bg-white/10 transition pointer-events-auto"
                        >
                          <option value="Open">Open</option>
                          <option value="In Progress">In Progress</option>
                          <option value="Resolved">Resolved</option>
                        </select>
                        
                        <button 
                          onClick={() => handleDelete(ticket.id)}
                          className="p-2.5 bg-destructive/10 hover:bg-destructive/20 text-red-400 rounded-lg transition-colors"
                          title="Delete Ticket"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                );
              })
            ) : (
              <div className="glass-panel p-12 rounded-2xl border border-dashed border-white/10 flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
                  <Ticket className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">No tickets found</h3>
                <p className="text-muted-foreground max-w-xs">Try adjusting your search or filters to find what you're looking for.</p>
              </div>
            )}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
