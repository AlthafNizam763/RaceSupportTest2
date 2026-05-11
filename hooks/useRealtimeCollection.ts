"use client";

import { useCallback, useEffect, useState } from "react";

import { normalizeCollectionName, onCollectionMutation } from "@/lib/api/events";
import { getDocuments } from "@/lib/firebase/firestore";

export function useRealtimeCollection<T = any>(collectionName: string) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const result = await getDocuments(collectionName);
      setData(result as T[]);
      setError(null);
    } catch (err: any) {
      setError(err.message || "Failed to load data.");
    } finally {
      setLoading(false);
    }
  }, [collectionName]);

  useEffect(() => {
    void refresh();

    const unsubscribe = onCollectionMutation((changedCollection) => {
      if (
        changedCollection === normalizeCollectionName(collectionName) ||
        changedCollection === "*"
      ) {
        void refresh();
      }
    });

    const handleFocus = () => {
      void refresh();
    };

    window.addEventListener("focus", handleFocus);
    return () => {
      unsubscribe();
      window.removeEventListener("focus", handleFocus);
    };
  }, [collectionName, refresh]);

  useEffect(() => {
    const poller = window.setInterval(() => {
      void refresh();
    }, 30000);

    return () => {
      window.clearInterval(poller);
    };
  }, [refresh]);

  return { data, loading, error, refresh };
}
