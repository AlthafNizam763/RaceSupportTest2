"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../../../hooks/useAuth";
import { apiFetch, jsonRequest } from "../../../../lib/api/fetcher";
import { getDeleteConfirmationMessage } from "../../../../lib/messages";
import { 
  UserCheck, 
  Search, 
  Plus, 
  Trash2, 
  X, 
  Eye, 
  EyeOff, 
  Loader2, 
  User, 
  Shield, 
  Info,
  ShieldCheck,
  ShieldAlert,
  UserX,
  UserCheck2
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: "admin" | "editor" | "viewer";
  disabled: boolean;
  createdAt: string;
  lastSignInTime: string | null;
}

export default function UserManagementPage() {
  const { user: currentUser, loading: authLoading } = useAuth();
  const router = useRouter();

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Form states
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    role: "editor" as "admin" | "editor" | "viewer"
  });

  // Access check redirect
  useEffect(() => {
    if (!authLoading) {
      if (!currentUser || currentUser.role !== "admin") {
        toast.error("Permission denied. You do not have access to User Management.");
        router.push("/dashboard");
      } else {
        fetchUsers();
      }
    }
  }, [currentUser, authLoading, router]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await apiFetch<UserProfile[]>("/api/admin/users");
      setUsers(response);
    } catch (err: any) {
      toast.error(err.message || "Failed to load users.");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const newUser = await apiFetch<UserProfile>("/api/admin/users", {
        method: "POST",
        ...jsonRequest(formData)
      });
      toast.success("User created successfully!");
      setUsers(prev => [newUser, ...prev]);
      setIsAddModalOpen(false);
      setFormData({ name: "", email: "", password: "", role: "editor" });
    } catch (err: any) {
      toast.error(err.message || "Failed to create user.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRoleChange = async (uid: string, newRole: "admin" | "editor" | "viewer") => {
    try {
      await apiFetch(`/api/admin/users/${uid}`, {
        method: "PATCH",
        ...jsonRequest({ role: newRole })
      });
      setUsers(prev => prev.map(u => u.uid === uid ? { ...u, role: newRole } : u));
      toast.success("Role updated successfully!");
    } catch (err: any) {
      toast.error(err.message || "Failed to update role.");
    }
  };

  const handleToggleStatus = async (uid: string, currentDisabled: boolean) => {
    const nextDisabled = !currentDisabled;
    try {
      await apiFetch(`/api/admin/users/${uid}`, {
        method: "PATCH",
        ...jsonRequest({ disabled: nextDisabled })
      });
      setUsers(prev => prev.map(u => u.uid === uid ? { ...u, disabled: nextDisabled } : u));
      toast.success(`User successfully ${nextDisabled ? "disabled" : "enabled"}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to toggle user status.");
    }
  };

  const handleDeleteUser = async (uid: string, email: string) => {
    if (confirm(getDeleteConfirmationMessage("user", email))) {
      try {
        await apiFetch(`/api/admin/users/${uid}`, {
          method: "DELETE"
        });
        setUsers(prev => prev.filter(u => u.uid !== uid));
        toast.success("User deleted successfully!");
      } catch (err: any) {
        toast.error(err.message || "Failed to delete user.");
      }
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "admin":
        return "text-emerald-400 bg-emerald-400/10 border-emerald-400/20";
      case "editor":
        return "text-blue-400 bg-blue-400/10 border-blue-400/20";
      case "viewer":
        return "text-slate-400 bg-slate-400/10 border-slate-400/20";
      default:
        return "text-gray-400 bg-gray-400/10 border-gray-400/20";
    }
  };

  const filteredUsers = users.filter(
    u =>
      u.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (authLoading || loading) {
    return (
      <div className="flex flex-col gap-8 h-full items-center justify-center p-12 text-white">
        <Loader2 className="animate-spin w-10 h-10 text-primary" />
        <span className="text-muted-foreground animate-pulse">Loading User Management...</span>
      </div>
    );
  }

  return (
    <div className="max-w-6xl flex flex-col gap-8 pb-12">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
            <UserCheck className="w-8 h-8 text-primary" />
            User Management
          </h1>
          <p className="text-muted-foreground mt-1">
            Create, view, and manage administrator and editor accounts for the RACE CMS.
          </p>
        </div>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center justify-center gap-2 bg-primary hover:bg-primary/95 text-primary-foreground font-bold px-5 py-2.5 rounded-xl transition duration-300 shadow-lg shadow-primary/20 shrink-0"
        >
          <Plus className="w-5 h-5" />
          Add User
        </button>
      </div>

      {/* Info Panel: Roles Guide */}
      <div className="glass-panel p-5 rounded-2xl border border-white/5 bg-slate-900/40 flex flex-col md:flex-row gap-5 items-start">
        <div className="p-3 bg-primary/10 text-primary rounded-xl shrink-0">
          <Info className="w-6 h-6" />
        </div>
        <div className="space-y-2">
          <h3 className="text-white font-semibold">User Access Control Quick Guide</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-muted-foreground pt-1">
            <div>
              <span className="text-emerald-400 font-bold block mb-1">Admin</span>
              Full privileges. Can read/write all CMS content, update global site settings, and access User Management.
            </div>
            <div>
              <span className="text-blue-400 font-bold block mb-1">Editor</span>
              Write privileges. Can manage all CMS items (events, gallery, team, tickets) and global branding, but cannot manage users.
            </div>
            <div>
              <span className="text-slate-400 font-bold block mb-1">Viewer</span>
              Read-only. Can view all dashboard stats, logs, settings, and tables, but cannot save, create, or delete any content.
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Table Panel */}
      <div className="flex flex-col gap-4">
        {/* Search input */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search users by name or email..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900/50 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-white placeholder-muted-foreground focus:ring-2 focus:ring-primary/50 outline-none transition"
          />
        </div>

        {/* Users list table */}
        <div className="glass-panel rounded-2xl border border-white/5 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/5 bg-slate-950/40 text-muted-foreground text-xs uppercase tracking-wider font-semibold">
                  <th className="py-4 px-6">User Info</th>
                  <th className="py-4 px-6">Role</th>
                  <th className="py-4 px-6">Status</th>
                  <th className="py-4 px-6">Registered On</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredUsers.length > 0 ? (
                  filteredUsers.map(user => {
                    const isSelf = user.uid === currentUser?.uid;
                    const initials = user.displayName
                      ? user.displayName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()
                      : user.email.slice(0, 2).toUpperCase();

                    return (
                      <tr 
                        key={user.uid}
                        className="hover:bg-white/[0.02] transition-colors"
                      >
                        {/* Avatar and Name */}
                        <td className="py-4 px-6 flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 border border-white/10 ${
                            isSelf ? "bg-primary/20 text-primary" : "bg-slate-800 text-gray-300"
                          }`}>
                            {initials}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="text-white font-medium text-sm truncate flex items-center gap-1.5">
                              {user.displayName}
                              {isSelf && (
                                <span className="text-[10px] font-bold uppercase tracking-wider bg-primary/20 text-primary px-1.5 py-0.5 rounded">
                                  You
                                </span>
                              )}
                            </span>
                            <span className="text-muted-foreground text-xs truncate">{user.email}</span>
                          </div>
                        </td>

                        {/* Role Select Dropdown */}
                        <td className="py-4 px-6">
                          {isSelf ? (
                            <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold border ${getRoleBadgeColor(user.role)}`}>
                              {user.role}
                            </span>
                          ) : (
                            <select
                              value={user.role}
                              onChange={e => handleRoleChange(user.uid, e.target.value as any)}
                              className={`bg-slate-900 border border-white/10 rounded-lg px-2.5 py-1 text-xs font-semibold text-white focus:outline-none transition cursor-pointer hover:bg-slate-850`}
                            >
                              <option value="admin">Admin</option>
                              <option value="editor">Editor</option>
                              <option value="viewer">Viewer</option>
                            </select>
                          )}
                        </td>

                        {/* Status Toggle */}
                        <td className="py-4 px-6">
                          {isSelf ? (
                            <span className="text-xs text-emerald-400 font-medium flex items-center gap-1">
                              <UserCheck2 className="w-3.5 h-3.5" /> Active
                            </span>
                          ) : (
                            <button
                              onClick={() => handleToggleStatus(user.uid, user.disabled)}
                              className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold border transition ${
                                user.disabled
                                  ? "text-red-400 bg-red-400/10 border-red-400/20 hover:bg-red-400/20"
                                  : "text-emerald-400 bg-emerald-400/10 border-emerald-400/20 hover:bg-emerald-400/20"
                              }`}
                            >
                              {user.disabled ? (
                                <>
                                  <UserX className="w-3 h-3" /> Disabled
                                </>
                              ) : (
                                <>
                                  <UserCheck2 className="w-3 h-3" /> Enabled
                                </>
                              )}
                            </button>
                          )}
                        </td>

                        {/* Creation Date */}
                        <td className="py-4 px-6 text-sm text-muted-foreground">
                          {new Date(user.createdAt).toLocaleDateString(undefined, {
                            year: "numeric",
                            month: "short",
                            day: "numeric"
                          })}
                        </td>

                        {/* Actions (Delete) */}
                        <td className="py-4 px-6 text-right">
                          <button
                            disabled={isSelf}
                            onClick={() => handleDeleteUser(user.uid, user.email)}
                            className="p-2 bg-destructive/10 hover:bg-destructive/20 text-red-400 rounded-lg transition disabled:opacity-30 disabled:cursor-not-allowed"
                            title={isSelf ? "You cannot delete yourself" : "Delete User"}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td 
                      colSpan={5} 
                      className="py-12 text-center text-muted-foreground"
                    >
                      No users found matching your search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Add User Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />

            {/* Modal Body */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="glass-panel w-full max-w-md bg-slate-950 border border-white/10 rounded-2xl overflow-hidden shadow-2xl relative z-10"
            >
              <div className="p-6 border-b border-white/5 flex items-center justify-between">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <User className="w-5 h-5 text-primary" />
                  Add New User
                </h3>
                <button
                  onClick={() => setIsAddModalOpen(false)}
                  className="p-1.5 text-muted-foreground hover:text-white rounded-lg hover:bg-white/5 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateUser} className="p-6 space-y-5">
                {/* Full Name */}
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Enter name"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-slate-900 border border-white/10 rounded-lg p-3 text-white placeholder-muted-foreground focus:ring-2 focus:ring-primary/50 outline-none transition"
                  />
                </div>

                {/* Email Address */}
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="name@raceindia.org"
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    className="w-full bg-slate-900 border border-white/10 rounded-lg p-3 text-white placeholder-muted-foreground focus:ring-2 focus:ring-primary/50 outline-none transition"
                  />
                </div>

                {/* Password */}
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      placeholder="Minimum 6 characters"
                      value={formData.password}
                      onChange={e => setFormData({ ...formData, password: e.target.value })}
                      className="w-full bg-slate-900 border border-white/10 rounded-lg p-3 text-white placeholder-muted-foreground focus:ring-2 focus:ring-primary/50 outline-none transition pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-white transition"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Role */}
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Access Permission Role
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {(["admin", "editor", "viewer"] as const).map(role => {
                      const isSelected = formData.role === role;
                      return (
                        <button
                          key={role}
                          type="button"
                          onClick={() => setFormData({ ...formData, role })}
                          className={`py-2.5 px-3 rounded-lg border text-xs font-bold uppercase tracking-wider transition ${
                            isSelected
                              ? "bg-primary/20 border-primary text-primary"
                              : "bg-slate-900 border-white/10 text-muted-foreground hover:bg-slate-800"
                          }`}
                        >
                          {role}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Buttons */}
                <div className="flex items-center gap-3 pt-3">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="flex-1 border border-white/10 hover:bg-white/5 text-white font-semibold py-3 rounded-lg transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-3 rounded-lg transition disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      "Create User"
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
