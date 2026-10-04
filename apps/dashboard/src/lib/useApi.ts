import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "./api";

export type ApiState<T> = {
  data: T | null;
  error: ApiError | null;
  /** Fetch again without blanking what is on screen. */
  reload: () => Promise<void>;
};

/** Loads one GET request, and again whenever `reload` is called or the path changes. */
export function useApi<T>(path: string): ApiState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  const reload = useCallback(async () => {
    try {
      setData(await api<T>(path));
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e : new ApiError("Something went wrong.", 0));
    }
  }, [path]);

  useEffect(() => {
    setData(null);
    setError(null);
    void reload();
  }, [reload]);

  return { data, error, reload };
}
