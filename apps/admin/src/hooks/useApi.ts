import { useState, useCallback, useEffect } from 'react';
import api from '../services/api';
import type { ApiError } from '../types';

interface UseApiState<T> {
  data: T | null;
  loading: boolean;
  error: ApiError | null;
}

/**
 * Hook for making API GET requests with loading/error state management.
 * Returns data, loading, error, and a refetch function.
 *
 * Usage:
 *   const { data, loading, error, refetch } = useApi<Student[]>('/api/students');
 *
 * Pass null to skip fetching:
 *   const { data } = useApi<Student[]>(shouldFetch ? '/api/students' : null);
 */
export function useApi<T>(endpoint: string | null) {
  const [state, setState] = useState<UseApiState<T>>({
    data: null,
    loading: false,
    error: null,
  });

  const fetchData = useCallback(async (ep: string) => {
    setState({ data: null, loading: true, error: null });

    try {
      const data = await api.get<T>(ep);
      setState({ data, loading: false, error: null });
    } catch (err) {
      setState({ data: null, loading: false, error: err as ApiError });
    }
  }, []);

  useEffect(() => {
    if (!endpoint) return;

    let cancelled = false;

    const doFetch = async () => {
      setState({ data: null, loading: true, error: null });
      try {
        const data = await api.get<T>(endpoint);
        if (!cancelled) setState({ data, loading: false, error: null });
      } catch (err) {
        if (!cancelled) setState({ data: null, loading: false, error: err as ApiError });
      }
    };

    doFetch();

    return () => {
      cancelled = true;
    };
  }, [endpoint]);

  const refetch = useCallback(() => {
    if (endpoint) fetchData(endpoint);
  }, [endpoint, fetchData]);

  return { ...state, refetch };
}
