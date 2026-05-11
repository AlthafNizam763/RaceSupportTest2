"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { confirmVerificationEmail, resendVerificationEmail } from "@/lib/firebase/auth";
import { useAuth } from "@/hooks/useAuth";

export default function VerifyEmailPage() {
  const { user, loading } = useAuth();
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [oobCode, setOobCode] = useState("");
  const router = useRouter();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setOobCode(params.get("oobCode") || "");
  }, []);

  useEffect(() => {
    if (!oobCode) {
      return;
    }

    let cancelled = false;
    const verify = async () => {
      setVerifying(true);
      try {
        await confirmVerificationEmail(oobCode);
        if (cancelled) {
          return;
        }

        toast.success("Email verified successfully.");
      } catch (error: any) {
        if (!cancelled) {
          toast.error(error.message || "Failed to verify email.");
        }
      } finally {
        if (!cancelled) {
          setVerifying(false);
        }
      }
    };

    void verify();
    return () => {
      cancelled = true;
    };
  }, [oobCode]);

  const handleResend = async () => {
    setResending(true);
    try {
      await resendVerificationEmail();
      toast.success("Verification email sent.");
    } catch (error: any) {
      toast.error(error.message || "Failed to resend verification email.");
    } finally {
      setResending(false);
    }
  };

  const isVerified = Boolean(user?.emailVerified);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary/20 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-accent/20 blur-[120px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="glass-panel p-8 rounded-2xl w-full max-w-md z-10 mx-4 text-center"
      >
        <h1 className="text-3xl font-bold text-white mb-3 tracking-tight">Verify Your Email</h1>
        <p className="text-muted-foreground text-sm mb-8">
          {oobCode
            ? "We are confirming your verification link."
            : "Check your inbox and click the verification link to complete setup."}
        </p>

        {(verifying || loading) && (
          <div className="flex items-center justify-center gap-3 text-white mb-6">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            <span>{verifying ? "Verifying email..." : "Checking session..."}</span>
          </div>
        )}

        {!verifying && !loading && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-sm text-muted-foreground">
              {isVerified
                ? "Your email has been verified. You can continue to the dashboard."
                : "Your email is not verified yet. Use the button below to resend the verification email."}
            </div>

            {!isVerified && (
              <button
                type="button"
                onClick={handleResend}
                disabled={resending || !user}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-3 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {resending ? "Sending..." : "Resend verification email"}
              </button>
            )}

            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              className="w-full bg-white/5 hover:bg-white/10 text-white font-semibold py-3 rounded-lg transition"
            >
              Continue to dashboard
            </button>
          </div>
        )}

        <p className="text-center text-sm text-muted-foreground mt-6">
          Need another account?{" "}
          <Link href="/register" className="text-primary hover:underline">
            Register again
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
