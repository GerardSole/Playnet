import { useSearchParams } from 'react-router-dom';
import { useCallback } from 'react';

export function useSearchParam(key: string, defaultValue = '') {
  const [params, setParams] = useSearchParams();
  const value = params.get(key) ?? defaultValue;

  const set = useCallback(
    (v: string) => {
      setParams((prev) => {
        const next = new URLSearchParams(prev);
        if (v) next.set(key, v);
        else next.delete(key);
        return next;
      });
    },
    [key, setParams]
  );

  return [value, set] as const;
}
