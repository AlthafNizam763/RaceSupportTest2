"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";

import { resetPassword, verifyResetCode } from "@/lib/firebase/auth";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [email, setEmail] = useState("");
  const [isCodeValid, setIsCodeValid] = useState(false);
  const [oobCode, setOobCode] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setOobCode(params.get("oobCode") || "");
  }, []);

  useEffect(() => {
    let cancelled = false;

    const verifyCode = async () => {
      if (!oobCode) {
        setLoading(false);
        return;
      }

      try {
        const result = await verifyResetCode(oobCode);
        if (!cancelled) {
          setEmail(result.email);
          setIsCodeValid(true);
        }
      } catch (error: any) {
        if (!cancelled) {
          toast.error(error.message || "Reset link is invalid.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void verifyCode();
    return () => {
      cancelled = true;
    };
  }, [oobCode]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (password !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    setSaving(true);
    try {
      await resetPassword(oobCode, password);
      toast.success("Password reset successfully.");
    } catch (error: any) {
      toast.error(error.message || "Failed to reset password.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-primary/20 blur-[120px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-accent/20 blur-[120px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="glass-panel p-8 rounded-2xl w-full max-w-md z-10 mx-4"
      >
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">Choose a New Password</h1>
          <p className="text-muted-foreground text-sm">
            {email ? `Reset password for ${email}` : "We are validating your reset link."}
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-3 text-white">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            <span>Checking reset link...</span>
          </div>
        ) : !isCodeValid ? (
          <div className="space-y-4 text-center">
            <p className="text-sm text-muted-foreground">
              This reset link is invalid or expired. Please request a new password reset email.
            </p>
            <Link href="/forgot-password" className="text-primary hover:underline">
              Request a new reset link
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="relative group">
              <input
                type={showPassword ? "text" : "password"}
                id="password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 pt-6 pb-2 pr-12 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition peer"
                placeholder=" "
              />
              <label
                htmlFor="password"
                className="absolute text-sm text-gray-400 duration-300 transform -translate-y-3 scale-75 top-4 z-10 origin-[0] left-4 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75 peer-focus:-translate-y-3"
              >
                New Password
              </label>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-white transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <div className="relative group">
              <input
                type={showConfirmPassword ? "text" : "password"}
                id="confirmPassword"
                required
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 pt-6 pb-2 pr-12 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition peer"
                placeholder=" "
              />
              <label
                htmlFor="confirmPassword"
                className="absolute text-sm text-gray-400 duration-300 transform -translate-y-3 scale-75 top-4 z-10 origin-[0] left-4 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75 peer-focus:-translate-y-3"
              >
                Confirm Password
              </label>
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-white transition-colors"
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <button
              disabled={saving}
              type="submit"
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-3 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? "Saving..." : "Update password"}
            </button>
          </form>
        )}

        <p className="text-center text-sm text-muted-foreground mt-6">
          Back to{" "}
          <Link href="/login" className="text-primary hover:underline">
            login
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
