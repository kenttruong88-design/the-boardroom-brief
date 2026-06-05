import { createHash } from "crypto";

interface Entry { count: number; resetAt: number }
const store = new Map<string, Entry>();

// Prune expired entries every 5 minutes so the Map doesn't grow unbounded
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of store) if (v.resetAt < now) store.delete(k);
}, 5 * 60 * 1000).unref?.();

/**
 * Returns true if the request is within the allowed rate, false if it should
 * be rejected. Mutates the store on each call.
 *
 * @param key       Unique bucket key (use ipKey() to build one)
 * @param limit     Max requests allowed in the window
 * @param windowMs  Window length in milliseconds
 */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = store.get(key);
  if (!entry || entry.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= limit) return false;
  entry.count++;
  return true;
}

/**
 * Builds a rate-limit bucket key from the request's IP address + a
 * per-endpoint suffix. The IP is SHA-256 hashed so it's never stored raw.
 */
export function ipKey(req: Request, suffix: string): string {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";
  const hash = createHash("sha256")
    .update(ip + (process.env.IP_HASH_SALT ?? "rl-salt"))
    .digest("hex")
    .slice(0, 16);
  return `${hash}:${suffix}`;
}
