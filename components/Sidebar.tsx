"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  Menu,
  ChevronDown,
  X,
  BookOpen,
  FolderOpen,
  Eye,
  Handshake,
  Newspaper,
  Image as ImageIcon,
  Star,
  Ticket,
  Settings,
  UserCheck
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const ACTION_PLAN_LINKS = [
  { name: "Ongoing & Past Events", href: "/dashboard/action-plan/events", icon: CalendarDays },
  { name: "Courses & Training", href: "/dashboard/action-plan/courses", icon: BookOpen },
  { name: "Projects", href: "/dashboard/action-plan/projects", icon: FolderOpen },
  { name: "Day Observations", href: "/dashboard/action-plan/observations", icon: Eye },
  { name: "Collaborations", href: "/dashboard/action-plan/collaborations", icon: Handshake },
  { name: "Features in News", href: "/dashboard/action-plan/news", icon: Newspaper },
];

export default function Sidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const [isActionPlanOpen, setIsActionPlanOpen] = useState(true);
  const pathname = usePathname();
  const { user } = useAuth();

  const navItemClass = (href: string, exact = false) => {
    const isActive = exact ? pathname === href : pathname?.startsWith(href);
    return cn(
      "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 ease-in-out font-medium",
      isActive
        ? "bg-primary/20 text-primary shadow-[0_0_15px_rgba(34,197,94,0.15)] border border-primary/20"
        : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
    );
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-slate-950 border-r border-white/5 backdrop-blur-3xl shadow-2xl overflow-y-auto">
      <div className="p-6 md:p-8 flex items-center justify-between sticky top-0 bg-slate-950/80 backdrop-blur-md z-10 border-b border-white/5">
        <Link href="/dashboard" className="flex flex-col">
          <span className="text-2xl font-bold tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent">
            RACE
          </span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">
            Support CMS
          </span>
        </Link>
        <button className="md:hidden text-muted-foreground p-2" onClick={() => setIsOpen(false)}>
          <X className="w-5 h-5" />
        </button>
      </div>

      <nav className="flex flex-col gap-2 p-4 mt-2">
        <Link href="/dashboard" className={navItemClass("/dashboard", true)}>
          <LayoutDashboard className="w-5 h-5" />
          Dashboard
        </Link>
        
        <Link href="/dashboard/tickets" className={navItemClass("/dashboard/tickets")}>
          <Ticket className="w-5 h-5 text-primary/70" />
          Support Tickets
        </Link>

        <Link href="/dashboard/team" className={navItemClass("/dashboard/team")}>
          <Users className="w-5 h-5" />
          Team RACE
        </Link>

        {/* Action Plan Dropdown */}
        <div className="pt-2">
          <button
            onClick={() => setIsActionPlanOpen(!isActionPlanOpen)}
            className="w-full flex items-center justify-between text-xs uppercase tracking-wider text-muted-foreground font-semibold px-4 py-3 hover:text-white transition-colors"
          >
            <span>Action Plan</span>
            <ChevronDown
              className={cn("w-4 h-4 transition-transform duration-300", isActionPlanOpen ? "rotate-180" : "")}
            />
          </button>

          <AnimatePresence>
            {isActionPlanOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden flex flex-col gap-1 pl-2 mb-2"
              >
                {ACTION_PLAN_LINKS.map((link) => {
                  const Icon = link.icon;
                  return (
                    <Link key={link.href} href={link.href} className={navItemClass(link.href)}>
                      <Icon className="w-4 h-4 ml-2 opacity-70" />
                      <span className="text-sm">{link.name}</span>
                    </Link>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <Link href="/dashboard/changemakers" className={navItemClass("/dashboard/changemakers")}>
          <Star className="w-5 h-5 text-yellow-500/70" />
          Changemakers
        </Link>

        <Link href="/dashboard/gallery" className={navItemClass("/dashboard/gallery")}>
          <ImageIcon className="w-5 h-5" />
          Gallery
        </Link>

        {/* Tool Settings & Admin */}
        <div className="pt-4 mt-2 border-t border-white/5 flex flex-col gap-2">
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold px-4 block">
            Tool Settings & Admin
          </span>
          <Link href="/dashboard/settings" className={navItemClass("/dashboard/settings")}>
            <Settings className="w-5 h-5" />
            Site Settings
          </Link>
          {user?.role === "admin" && (
            <Link href="/dashboard/settings/users" className={navItemClass("/dashboard/settings/users")}>
              <UserCheck className="w-5 h-5" />
              User Management
            </Link>
          )}
        </div>
      </nav>
    </div>
  );

  return (
    <>
      {/* Mobile Header trigger */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-slate-950/80 backdrop-blur border-b border-white/5 flex items-center justify-between px-4 z-40">
        <span className="font-bold text-lg bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent">
          RACE CMS
        </span>
        <button onClick={() => setIsOpen(true)} className="p-2 text-white bg-white/5 rounded-lg border border-white/10">
          <Menu className="w-5 h-5" />
        </button>
      </div>

      {/* Mobile overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar Container */}
      <motion.aside
        initial={{ x: -300 }}
        animate={{ x: isOpen ? 0 : 0 }}
        className={cn(
          "fixed md:static inset-y-0 w-72 z-50 transform transition-transform duration-300 md:translate-x-0 h-screen",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <SidebarContent />
      </motion.aside>

      {/* Spacing for mobile header */}
      <div className="h-16 md:hidden w-full flex-shrink-0" />
    </>
  );
}
