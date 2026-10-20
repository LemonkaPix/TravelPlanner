import { useEffect, useState } from 'react';

type SearchState<T> = {
  key: string | null;
  status: 'idle' | 'loading' | 'success' | 'error';
  items: T[];
  error: string | null;
};

// The key tags each response, so a changed query hides previous results even
// before effect cleanup. Abort + active protect against late network responses.
export function useTransitSearch<T>(
  key: string | null, load: (signal: AbortSignal) => Promise<T[]>, delay = 0,
) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<SearchState<T>>({ key: null, status: 'idle', items: [], error: null });
  useEffect(() => {
    if (key === null) return;
    const controller = new AbortController();
    let active = true;
    setState({ key, status: 'loading', items: [], error: null });
    const timer = setTimeout(() => {
      void load(controller.signal).then(
        (items) => { if (active) setState({ key, status: 'success', items, error: null }); },
        (error: unknown) => {
          if (active) setState({
            key, status: 'error', items: [],
            error: error instanceof Error ? error.message : 'Nie udało się wyszukać danych. Spróbuj ponownie.',
          });
        },
      );
    }, delay);
    return () => { active = false; clearTimeout(timer); controller.abort(); };
  }, [key, load, delay, attempt]);
  const current: SearchState<T> = key === null
    ? { key, status: 'idle', items: [], error: null }
    : state.key === key ? state : { key, status: 'loading', items: [], error: null };
  return { ...current, retry: () => setAttempt((value) => value + 1) };
}
