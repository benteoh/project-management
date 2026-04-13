import { useCallback, useSyncExternalStore } from "react";

const TTL_MS = 24 * 60 * 60 * 1000; // 1 day

interface StoredTab<T> {
  value: T;
  expiresAt: number;
}

function readStoredTab<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed: StoredTab<T> = JSON.parse(raw);
    if (Date.now() > parsed.expiresAt) {
      localStorage.removeItem(key);
      return fallback;
    }
    return parsed.value;
  } catch {
    return fallback;
  }
}

function writeStoredTab<T>(key: string, value: T): void {
  try {
    const entry: StoredTab<T> = { value, expiresAt: Date.now() + TTL_MS };
    localStorage.setItem(key, JSON.stringify(entry));
  } catch {
    // storage unavailable — silent fail
  }
}

/** Same-tab listeners (storage events only fire for other documents). */
const tabKeyListeners = new Map<string, Set<() => void>>();

function subscribePersistedTabKey(key: string, onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {};

  const onStorage = (e: StorageEvent) => {
    if (e.key === key || e.key === null) onStoreChange();
  };
  window.addEventListener("storage", onStorage);

  let subs = tabKeyListeners.get(key);
  if (!subs) {
    subs = new Set();
    tabKeyListeners.set(key, subs);
  }
  subs.add(onStoreChange);

  return () => {
    window.removeEventListener("storage", onStorage);
    subs!.delete(onStoreChange);
    if (subs!.size === 0) tabKeyListeners.delete(key);
  };
}

function notifyPersistedTabKey(key: string) {
  if (typeof window === "undefined") return;
  tabKeyListeners.get(key)?.forEach((cb) => cb());
}

function snapshotTab<T extends string>(key: string, defaultTab: T, validTabs: readonly T[]): T {
  const stored = readStoredTab<T>(key, defaultTab);
  return validTabs.includes(stored) ? stored : defaultTab;
}

export function usePersistedTab<T extends string>(
  storageKey: string,
  defaultTab: T,
  validTabs: readonly T[]
): [T, (tab: T) => void] {
  const subscribe = useCallback(
    (onChange: () => void) => subscribePersistedTabKey(storageKey, onChange),
    [storageKey]
  );

  const getSnapshot = useCallback(
    () => snapshotTab(storageKey, defaultTab, validTabs),
    [storageKey, defaultTab, validTabs]
  );

  const getServerSnapshot = useCallback(() => defaultTab, [defaultTab]);

  const activeTab = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setActiveTab = (tab: T) => {
    writeStoredTab(storageKey, tab);
    notifyPersistedTabKey(storageKey);
  };

  return [activeTab, setActiveTab];
}
