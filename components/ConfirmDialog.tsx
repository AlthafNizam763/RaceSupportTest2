"use client";

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trash2, AlertTriangle, AlertCircle, X, Check } from "lucide-react";

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "warning" | "primary";
}

type ConfirmFunction = (options: string | ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFunction | null>(null);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions>({
    title: "Confirm Deletion",
    message: "",
    confirmText: "Delete",
    cancelText: "Cancel",
    variant: "danger",
  });

  const resolverRef = useRef<((value: boolean) => void) | null>(null);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  const confirm: ConfirmFunction = useCallback((opts) => {
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
      if (typeof opts === "string") {
        setOptions({
          title: "Confirm Deletion",
          message: opts,
          confirmText: "Delete",
          cancelText: "Cancel",
          variant: "danger",
        });
      } else {
        setOptions({
          title: opts.title || "Confirm Deletion",
          message: opts.message,
          confirmText: opts.confirmText || "Delete",
          cancelText: opts.cancelText || "Cancel",
          variant: opts.variant || "danger",
        });
      }
      setIsOpen(true);
    });
  }, []);

  const handleConfirm = () => {
    setIsOpen(false);
    if (resolverRef.current) {
      resolverRef.current(true);
      resolverRef.current = null;
    }
  };

  const handleCancel = () => {
    setIsOpen(false);
    if (resolverRef.current) {
      resolverRef.current(false);
      resolverRef.current = null;
    }
  };

  // Keyboard shortcut: Escape cancels, Enter confirms
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        handleCancel();
      } else if (e.key === "Enter" && !e.shiftKey) {
        // Only trigger if not on cancel button
        if (document.activeElement?.tagName !== "BUTTON" || document.activeElement === confirmBtnRef.current) {
          e.preventDefault();
          handleConfirm();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // Focus confirm button when opened
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        confirmBtnRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const isDanger = options.variant === "danger";
  const isWarning = options.variant === "warning";

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}

      <AnimatePresence>
        {isOpen && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md"
            onClick={handleCancel}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-md bg-slate-900/95 border border-white/10 rounded-2xl p-6 shadow-2xl backdrop-blur-xl overflow-hidden"
              style={{
                boxShadow: isDanger
                  ? "0 20px 40px -15px rgba(239, 68, 68, 0.25)"
                  : "0 20px 40px -15px rgba(0, 0, 0, 0.5)",
              }}
            >
              {/* Subtle top accent gradient */}
              <div
                className={`absolute top-0 left-0 right-0 h-1 ${
                  isDanger
                    ? "bg-gradient-to-r from-red-500 via-rose-500 to-red-600"
                    : isWarning
                    ? "bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600"
                    : "bg-gradient-to-r from-primary via-emerald-400 to-primary"
                }`}
              />

              {/* Close Button */}
              <button
                type="button"
                onClick={handleCancel}
                className="absolute top-4 right-4 p-1.5 text-muted-foreground hover:text-white rounded-lg hover:bg-white/10 transition-colors"
                title="Cancel (Esc)"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-start gap-4 pt-1">
                {/* Icon */}
                <div
                  className={`p-3 rounded-xl border flex-shrink-0 ${
                    isDanger
                      ? "bg-red-500/10 border-red-500/25 text-red-400"
                      : isWarning
                      ? "bg-amber-500/10 border-amber-500/25 text-amber-400"
                      : "bg-primary/10 border-primary/25 text-primary"
                  }`}
                >
                  {isDanger ? (
                    <Trash2 className="w-6 h-6" />
                  ) : isWarning ? (
                    <AlertTriangle className="w-6 h-6" />
                  ) : (
                    <AlertCircle className="w-6 h-6" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 pr-6">
                  <h3 className="text-base font-semibold text-white tracking-tight">
                    {options.title}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-2 leading-relaxed break-words">
                    {options.message}
                  </p>
                  {isDanger && (
                    <p className="text-xs text-red-400/80 mt-2 font-medium">
                      ⚠️ This action cannot be undone.
                    </p>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-white/5">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-muted-foreground hover:text-white hover:bg-white/5 transition-colors border border-transparent hover:border-white/10"
                >
                  {options.cancelText}
                </button>
                <button
                  ref={confirmBtnRef}
                  type="button"
                  onClick={handleConfirm}
                  className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all shadow-lg flex items-center gap-2 ${
                    isDanger
                      ? "bg-red-600 hover:bg-red-500 text-white shadow-red-600/30 active:scale-95"
                      : isWarning
                      ? "bg-amber-500 hover:bg-amber-400 text-black shadow-amber-500/30 active:scale-95"
                      : "bg-primary hover:bg-primary/90 text-black shadow-primary/30 active:scale-95"
                  }`}
                >
                  {isDanger && <Trash2 className="w-4 h-4" />}
                  {options.confirmText}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFunction {
  const context = useContext(ConfirmContext);
  if (!context) {
    // Graceful fallback to window.confirm if used outside provider
    return async (opts) => {
      const msg = typeof opts === "string" ? opts : opts.message;
      return window.confirm(msg);
    };
  }
  return context;
}
