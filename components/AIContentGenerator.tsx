"use client";

import { useState } from "react";
import { Loader2, RefreshCw, Wand2 } from "lucide-react";
import { toast } from "sonner";

interface AIContentGeneratorProps {
  title: string;
  category: string;
  onGenerated: (content: string) => void;
}

export function AIContentGenerator({ title, category, onGenerated }: AIContentGeneratorProps) {
  const [loading, setLoading] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);

  const typeText = (fullText: string) => {
    let currentText = "";
    let index = 0;
    const interval = window.setInterval(() => {
      if (index < fullText.length) {
        currentText += fullText[index];
        onGenerated(currentText);
        index += 1;
      } else {
        window.clearInterval(interval);
      }
    }, 15);
  };

  const handleGenerate = async () => {
    if (!title) {
      toast.error("Please provide a title first so AI has context.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, category }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to generate content.");
      }

      if (data.content) {
        typeText(data.content);
        setHasGenerated(true);
        toast.success(data.isFallback ? "Generated fallback preview." : "Content generated successfully.");
      }
    } catch (error: any) {
      toast.error(error.message || "An error occurred during AI generation.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleGenerate}
      disabled={loading}
      className={`group relative flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all duration-300 shadow-lg ${
        hasGenerated
          ? "bg-slate-800 text-slate-300 hover:text-white border border-white/10"
          : "bg-gradient-to-r from-indigo-600 via-blue-600 to-cyan-600 text-white hover:scale-105 active:scale-95 shadow-blue-500/20"
      } disabled:opacity-50 disabled:cursor-not-allowed`}
    >
      <div className="relative flex items-center gap-2">
        {loading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : hasGenerated ? (
          <RefreshCw className="w-3.5 h-3.5 group-hover:rotate-180 transition-transform duration-500" />
        ) : (
          <Wand2 className="w-3.5 h-3.5" />
        )}
        <span>{loading ? "Generating..." : hasGenerated ? "Regenerate" : "Generate Description"}</span>
      </div>
    </button>
  );
}
