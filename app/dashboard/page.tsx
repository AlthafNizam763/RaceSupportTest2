"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  BookOpen,
  Calendar,
  FileText,
  Image,
  Loader2,
  Radio,
  Star,
  Ticket,
  Users,
} from "lucide-react";

import { onCollectionMutation } from "@/lib/api/events";
import { apiFetch } from "@/lib/api/fetcher";

interface DashboardAnalytics {
  cards: {
    totalEvents: number;
    ongoingEvents: number;
    totalProjects: number;
    openTickets: number;
    inProgressTickets: number;
    resolvedTickets: number;
    totalTeamMembers: number;
    totalChangemakers: number;
    totalGalleryItems: number;
    galleryImages: number;
    galleryVideos: number;
    totalCourses: number;
    totalNews: number;
  };
  charts: {
    moduleCounts: Array<{ name: string; total: number }>;
    statusBreakdown: Array<{ name: string; tickets: number; events: number }>;
  };
}

export default function DashboardPage() {
  const [analytics, setAnalytics] = useState<DashboardAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const loadAnalytics = async () => {
      try {
        const data = await apiFetch<DashboardAnalytics>("/api/dashboard/analytics");
        if (!mounted) {
          return;
        }

        setAnalytics(data);
        setError(null);
      } catch (err: any) {
        if (mounted) {
          setError(err.message || "Failed to load dashboard analytics.");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void loadAnalytics();
    const unsubscribe = onCollectionMutation(() => {
      void loadAnalytics();
    });
    const handleFocus = () => {
      void loadAnalytics();
    };

    window.addEventListener("focus", handleFocus);
    return () => {
      mounted = false;
      unsubscribe();
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  const cards = analytics?.cards;
  const stats = cards
    ? [
        {
          label: "Total Events",
          value: cards.totalEvents,
          sub: `${cards.ongoingEvents} ongoing`,
          icon: Calendar,
          color: "text-blue-400",
          bg: "bg-blue-500/10",
        },
        {
          label: "Active Projects",
          value: cards.totalProjects,
          sub: "In action plan",
          icon: FileText,
          color: "text-primary",
          bg: "bg-primary/10",
        },
        {
          label: "Open Tickets",
          value: cards.openTickets,
          sub: `${cards.resolvedTickets} resolved`,
          icon: Ticket,
          color: "text-red-400",
          bg: "bg-red-500/10",
        },
        {
          label: "Team Members",
          value: cards.totalTeamMembers,
          sub: `+ ${cards.totalChangemakers} changemakers`,
          icon: Users,
          color: "text-purple-400",
          bg: "bg-purple-500/10",
        },
        {
          label: "Gallery Items",
          value: cards.totalGalleryItems,
          sub: `${cards.galleryImages} images, ${cards.galleryVideos} videos`,
          icon: Image,
          color: "text-pink-400",
          bg: "bg-pink-500/10",
        },
        {
          label: "Courses",
          value: cards.totalCourses,
          sub: "Learning resources",
          icon: BookOpen,
          color: "text-amber-400",
          bg: "bg-amber-500/10",
        },
        {
          label: "News Articles",
          value: cards.totalNews,
          sub: "Published content",
          icon: Radio,
          color: "text-cyan-400",
          bg: "bg-cyan-500/10",
        },
        {
          label: "Changemakers",
          value: cards.totalChangemakers,
          sub: "Featured profiles",
          icon: Star,
          color: "text-yellow-400",
          bg: "bg-yellow-500/10",
        },
      ]
    : [];

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  };

  if (loading) {
    return (
      <div className="glass-panel p-10 rounded-2xl flex items-center justify-center gap-3 text-white">
        <Loader2 className="w-5 h-5 animate-spin text-primary" />
        <span>Loading dashboard analytics...</span>
      </div>
    );
  }

  if (error || !analytics) {
    return (
      <div className="glass-panel p-10 rounded-2xl text-center text-muted-foreground">
        {error || "Dashboard analytics could not be loaded."}
      </div>
    );
  }

  const summaryCards = analytics.cards;

  return (
    <>
      <div className="flex flex-col gap-2 mb-8">
        <h1 className="text-3xl font-bold text-white tracking-tight">Overview</h1>
        <p className="text-muted-foreground">Live dashboard analytics loaded from the CMS APIs.</p>
      </div>

      <motion.div
        initial="hidden"
        animate="visible"
        transition={{ staggerChildren: 0.07 }}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8"
      >
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.label}
              variants={itemVariants}
              className="glass p-5 rounded-2xl flex items-center gap-4 hover:border-white/20 transition-colors"
            >
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${stat.bg}`}>
                <Icon className={`w-6 h-6 ${stat.color}`} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted-foreground truncate">{stat.label}</p>
                <h3 className="text-2xl font-bold text-white mt-0.5">{stat.value}</h3>
                <p className="text-[11px] text-muted-foreground truncate">{stat.sub}</p>
              </div>
            </motion.div>
          );
        })}
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-panel p-6 rounded-2xl"
        >
          <h3 className="text-xl font-semibold text-white mb-6">Content by Module</h3>
          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.charts.moduleCounts}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                <XAxis dataKey="name" stroke="#ffffff50" axisLine={false} tickLine={false} />
                <YAxis stroke="#ffffff50" axisLine={false} tickLine={false} />
                <Tooltip
                  cursor={{ fill: "#ffffff05" }}
                  contentStyle={{
                    backgroundColor: "#0f172a",
                    border: "1px solid #ffffff10",
                    borderRadius: "8px",
                  }}
                />
                <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass-panel p-6 rounded-2xl"
        >
          <h3 className="text-xl font-semibold text-white mb-6">Status Breakdown</h3>
          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={analytics.charts.statusBreakdown}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                <XAxis dataKey="name" stroke="#ffffff50" axisLine={false} tickLine={false} />
                <YAxis stroke="#ffffff50" axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0f172a",
                    border: "1px solid #ffffff10",
                    borderRadius: "8px",
                  }}
                />
                <Line type="monotone" dataKey="tickets" stroke="hsl(var(--accent))" strokeWidth={3} />
                <Line type="monotone" dataKey="events" stroke="#60a5fa" strokeWidth={3} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="glass-panel p-6 rounded-2xl"
      >
        <h3 className="text-xl font-semibold text-white mb-4">Content Summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Events", value: summaryCards.totalEvents, color: "text-blue-400" },
            {
              label: "Total Tickets",
              value:
                summaryCards.openTickets +
                summaryCards.inProgressTickets +
                summaryCards.resolvedTickets,
              color: "text-red-400",
            },
            {
              label: "Gallery Media",
              value: summaryCards.totalGalleryItems,
              color: "text-pink-400",
            },
            {
              label: "Team + Makers",
              value: summaryCards.totalTeamMembers + summaryCards.totalChangemakers,
              color: "text-purple-400",
            },
          ].map((item) => (
            <div key={item.label} className="bg-white/5 rounded-xl p-4 text-center border border-white/5">
              <div className={`text-3xl font-black ${item.color}`}>{item.value}</div>
              <div className="text-xs text-muted-foreground mt-1">{item.label}</div>
            </div>
          ))}
        </div>
      </motion.div>
    </>
  );
}
