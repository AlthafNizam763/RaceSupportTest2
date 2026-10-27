"use client";

import { useAuth } from "@/hooks/useAuth";
import AdminMediaUpload from "@/components/AdminMediaUpload";
import { CloudUpload, ShieldAlert, Loader2 } from "lucide-react";

export default function MediaManagementPage() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Verifying administrator session...</p>
      </div>
    );
  }

  if (user?.role !== "admin") {
    return (
      <div className="max-w-xl mx-auto my-12 p-8 rounded-2xl bg-red-500/10 border border-red-500/20 text-center space-y-4">
        <div className="w-14 h-14 rounded-full bg-red-500/20 flex items-center justify-center mx-auto text-red-400">
          <ShieldAlert className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold text-white">Administrator Access Required</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          The Media Management tool is restricted to authorized administrators. Your account
          currently has the role <span className="text-white font-semibold">"{user?.role || "viewer"}"</span>.
          Please contact an administrator if you require upload privileges.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1 pb-4 border-b border-white/5">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-primary/10 border border-primary/20 text-primary rounded-lg">
            <CloudUpload className="w-5 h-5" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">ImageKit Media Manager</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Upload and manage high-performance images and videos hosted on ImageKit with Firestore synchronization.
        </p>
      </div>

      <AdminMediaUpload />
    </div>
  );
}
