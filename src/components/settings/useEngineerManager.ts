"use client";

import { useEffect, useMemo, useState, useTransition } from "react";

import {
  createEngineerAction,
  loadEngineersAction,
  updateEngineerAction,
} from "@/app/settings/actions";
import type { Engineer } from "@/types/engineer-pool";

import type { EngineerCreatePayload, EngineerUpdatePayload } from "./types";

/**
 * ViewModel hook for engineer CRUD — loads list on mount via server action.
 */
export function useEngineerManager() {
  const [engineers, setEngineers] = useState<Engineer[]>([]);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    void loadEngineersAction().then((res) => {
      if (res.ok) setEngineers(res.engineers);
      else setError(res.error);
      setIsLoading(false);
    });
  }, []);

  const sortedEngineers = useMemo(
    () =>
      [...engineers].sort(
        (a, b) =>
          a.lastName.localeCompare(b.lastName) ||
          a.firstName.localeCompare(b.firstName) ||
          a.code.localeCompare(b.code)
      ),
    [engineers]
  );

  const runMutation = (fn: () => Promise<void>) => {
    startTransition(() => {
      void fn();
    });
  };

  const create = async (payload: EngineerCreatePayload): Promise<boolean> => {
    const res = await createEngineerAction(payload);
    if (!res.ok) {
      setError(res.error);
      return false;
    }
    setEngineers(res.engineers);
    setError(null);
    return true;
  };

  const update = (payload: EngineerUpdatePayload) => {
    runMutation(async () => {
      const res = await updateEngineerAction(payload);
      if (!res.ok) return setError(res.error);
      setEngineers(res.engineers);
      setError(null);
    });
  };

  return {
    sortedEngineers,
    isPending,
    isLoading,
    error,
    create,
    update,
  } as const;
}
