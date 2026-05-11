"use client";

import { useEffect, useState } from "react";

import { onAuthChange } from "@/lib/api/events";
import { getSession, type SessionUser } from "@/lib/firebase/auth";

export function useAuth() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const loadSession = async () => {
      try {
        const session = await getSession();
        if (!mounted) {
          return;
        }

        setUser(session.user);
      } catch {
        if (!mounted) {
          return;
        }

        setUser(null);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void loadSession();
    const unsubscribe = onAuthChange(() => {
      void loadSession();
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  return { user, loading };
}
