/**
 * Cross-tab auth coordination so only one tab refreshes the httpOnly cookie,
 * and siblings adopt the new access JWT (avoids AUTH_REFRESH_REUSE logouts).
 *
 * Prefer BroadcastChannel (in-memory). Fall back to a short-lived localStorage
 * handoff for browsers without BroadcastChannel.
 */

export type AuthSyncMessage =
  | { v: 1; type: "access"; token: string; at: number }
  | { v: 1; type: "clear"; at: number }
  | { v: 1; type: "refreshing"; at: number };

const CHANNEL = "cor-lms-auth";
const STORAGE_KEY = "cor_auth_sync";
const LOCK_KEY = "cor_auth_refresh_lock";

type Handlers = {
  onAccess?: (token: string) => void;
  onClear?: () => void;
  onRefreshing?: () => void;
};

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

export function parseAuthSyncMessage(raw: unknown): AuthSyncMessage | null {
  if (!raw || typeof raw !== "object") return null;
  const msg = raw as Partial<AuthSyncMessage>;
  if (msg.v !== 1 || typeof msg.at !== "number") return null;
  if (msg.type === "access" && typeof msg.token === "string" && msg.token.length > 0) {
    return { v: 1, type: "access", token: msg.token, at: msg.at };
  }
  if (msg.type === "clear") return { v: 1, type: "clear", at: msg.at };
  if (msg.type === "refreshing") return { v: 1, type: "refreshing", at: msg.at };
  return null;
}

function parseMessage(raw: unknown): AuthSyncMessage | null {
  return parseAuthSyncMessage(raw);
}

let channel: BroadcastChannel | null = null;
let storageListener: ((event: StorageEvent) => void) | null = null;
const listeners = new Set<Handlers>();
let ignoreStorageWrite = false;
let bootstrapped = false;

function getChannel(): BroadcastChannel | null {
  if (!isBrowser() || typeof BroadcastChannel === "undefined") return null;
  if (!channel) {
    channel = new BroadcastChannel(CHANNEL);
    channel.onmessage = (event: MessageEvent) => {
      const msg = parseMessage(event.data);
      if (msg) dispatch(msg);
    };
  }
  return channel;
}

function dispatch(msg: AuthSyncMessage): void {
  for (const handlers of listeners) {
    if (msg.type === "access") handlers.onAccess?.(msg.token);
    else if (msg.type === "clear") handlers.onClear?.();
    else if (msg.type === "refreshing") handlers.onRefreshing?.();
  }
}

function writeStorageFallback(msg: AuthSyncMessage): void {
  if (!isBrowser()) return;
  try {
    ignoreStorageWrite = true;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(msg));
    // Remove promptly so the access JWT is not left at rest.
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* private mode / quota */
  } finally {
    ignoreStorageWrite = false;
  }
}

function ensureBootstrapped(): void {
  if (!isBrowser() || bootstrapped) return;
  bootstrapped = true;
  getChannel();
  storageListener = (event: StorageEvent) => {
    if (ignoreStorageWrite) return;
    if (event.key !== STORAGE_KEY || !event.newValue) return;
    try {
      const msg = parseMessage(JSON.parse(event.newValue));
      if (msg) dispatch(msg);
    } catch {
      /* ignore */
    }
  };
  window.addEventListener("storage", storageListener);
}

export function publishAuthSync(msg: Omit<AuthSyncMessage, "v" | "at"> & { token?: string }): void {
  if (!isBrowser()) return;
  ensureBootstrapped();
  const full = { ...msg, v: 1 as const, at: Date.now() } as AuthSyncMessage;
  const ch = getChannel();
  if (ch) {
    try {
      ch.postMessage(full);
    } catch {
      /* closed */
    }
  }
  // Mirror via storage so tabs without BroadcastChannel still sync.
  writeStorageFallback(full);
}

export function publishAccessToken(token: string): void {
  publishAuthSync({ type: "access", token });
}

export function publishClearSession(): void {
  publishAuthSync({ type: "clear" });
}

export function publishRefreshing(): void {
  publishAuthSync({ type: "refreshing" });
}

/** Subscribe to peer auth events. Returns unsubscribe. */
export function subscribeAuthSync(handlers: Handlers): () => void {
  if (!isBrowser()) return () => undefined;
  ensureBootstrapped();
  listeners.add(handlers);
  return () => {
    listeners.delete(handlers);
  };
}

export function tryAcquireRefreshLock(owner: string, ttlMs = 10_000): boolean {
  if (!isBrowser()) return true;
  const now = Date.now();
  try {
    const raw = localStorage.getItem(LOCK_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { owner?: string; expires?: number };
      if (
        typeof parsed.expires === "number" &&
        parsed.expires > now &&
        parsed.owner &&
        parsed.owner !== owner
      ) {
        return false;
      }
    }
    localStorage.setItem(LOCK_KEY, JSON.stringify({ owner, expires: now + ttlMs }));
    const check = JSON.parse(localStorage.getItem(LOCK_KEY) ?? "{}") as { owner?: string };
    return check.owner === owner;
  } catch {
    return true;
  }
}

export function releaseRefreshLock(owner: string): void {
  if (!isBrowser()) return;
  try {
    const raw = localStorage.getItem(LOCK_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as { owner?: string };
    if (parsed.owner === owner) localStorage.removeItem(LOCK_KEY);
  } catch {
    /* ignore */
  }
}

/** Wait for another tab to publish an access token (or give up). */
export function waitForPeerAccessToken(timeoutMs: number): Promise<string | null> {
  if (!isBrowser()) return Promise.resolve(null);

  return new Promise((resolve) => {
    let settled = false;
    const finish = (token: string | null) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      unsub();
      resolve(token);
    };

    const timer = window.setTimeout(() => finish(null), timeoutMs);
    const unsub = subscribeAuthSync({
      onAccess: (token) => finish(token),
      onClear: () => finish(null),
    });
  });
}
