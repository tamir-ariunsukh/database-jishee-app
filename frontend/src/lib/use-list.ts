'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { api, errorMessage } from './api';
import { useAuth } from './providers';

/**
 * Small data-fetching helper for the admin tables.
 * Re-fetches whenever `url` changes.
 */
export function useList<T>(url: string | null) {
  const { token } = useAuth();
  const [data, setData] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(Boolean(url));
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!url || !token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api<{ data: T[]; total?: number }>(url, { token });
      setData(res.data ?? []);
      setTotal(res.total ?? (res.data?.length ?? 0));
    } catch (err) {
      setError(errorMessage(err));
      toast.error(errorMessage(err));
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [url, token]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, total, loading, error, reload };
}
