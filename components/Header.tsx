"use client";

import { useAuth } from "../hooks/useAuth";
import { logout } from "../lib/firebase/auth";
import { useRouter } from "next/navigation";
import { UserCircle, LogOut } from "lucide-react";
import { toast } from "sonner";

export default function Header() {
  const { user } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await logout();
      toast.success("Logged out safely.");
      router.push("/login");
    } catch (err: any) {
      toast.error(err.message || "Failed to logout");
    }
  };

  return (
    <header className="hidden md:flex sticky top-0 z-30 h-20 items-center justify-end px-8 bg-slate-950/40 backdrop-blur-xl border-b border-white/5">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/5 border border-green-500/10 rounded-full">
          <div className="relative flex h-2 w-2">
            <div className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></div>
            <div className="relative inline-flex rounded-full h-2 w-2 bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
          </div>
          <span className="text-[10px] uppercase font-bold text-green-500 tracking-wider">Live Sync</span>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
            <UserCircle className="w-6 h-6 text-primary" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-white truncate max-w-[120px]">
              {user?.displayName || "Admin User"}
            </span>
            <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">
              {user?.email}
            </span>
          </div>
        </div>

        <div className="h-8 w-px bg-white/10 mx-2"></div>

        <button 
          onClick={handleLogout}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 hover:text-red-400 rounded-lg transition-colors border border-transparent hover:border-destructive/20"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </header>
  );
}
