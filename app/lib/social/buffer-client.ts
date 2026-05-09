const BASE_URL = "https://api.bufferapp.com/1";

function token(): string {
  const t = process.env.BUFFER_ACCESS_TOKEN;
  if (!t) throw new Error("BUFFER_ACCESS_TOKEN is not set");
  return t;
}

function authHeaders(): Record<string, string> {
  return { Authorization: `Bearer ${token()}` };
}

async function bufferFetch<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: { ...authHeaders(), ...(init?.headers ?? {}) },
  });

  if (!res.ok) {
    let message = `Buffer API error ${res.status}`;
    try {
      const body = await res.json() as { error?: string; message?: string };
      message = body.error ?? body.message ?? message;
    } catch {
      // ignore parse failure
    }
    throw new Error(message);
  }

  return res.json() as Promise<T>;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BufferProfile {
  id: string;
  service: "linkedin" | "twitter" | "instagram";
  serviceUsername: string;
}

export interface BufferAnalytics {
  impressions: number;
  likes: number;
  comments: number;
  shares: number;
  clicks: number;
}

// ─── In-memory profile cache (cleared on process restart / cold start) ────────

let profileCache: BufferProfile[] | null = null;

// ─── 1. getBufferProfiles ────────────────────────────────────────────────────

interface RawProfile {
  id: string;
  service: string;
  service_username: string;
}

export async function getBufferProfiles(): Promise<BufferProfile[]> {
  if (profileCache) return profileCache;

  const raw = await bufferFetch<RawProfile[]>("/profiles.json");

  profileCache = raw.map((p) => ({
    id: p.id,
    service: p.service as BufferProfile["service"],
    serviceUsername: p.service_username,
  }));

  return profileCache;
}

// ─── 2. scheduleBufferPost ───────────────────────────────────────────────────

interface CreateUpdateResponse {
  success: boolean;
  updates?: { id: string }[];
  error?: string;
}

export async function scheduleBufferPost(
  profileId: string,
  content: string,
  scheduledAt: Date,
  imageUrl?: string
): Promise<string> {
  const body = new URLSearchParams();
  body.append("profile_ids[]", profileId);
  body.append("text", content);
  body.append("scheduled_at", scheduledAt.toISOString());
  if (imageUrl) body.append("media[photo]", imageUrl);

  const data = await bufferFetch<CreateUpdateResponse>("/updates/create.json", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const postId = data.updates?.[0]?.id;
  if (!postId) {
    throw new Error(data.error ?? "Buffer did not return a post ID");
  }

  return postId;
}

// ─── 3. cancelBufferPost ────────────────────────────────────────────────────

export async function cancelBufferPost(bufferId: string): Promise<void> {
  await bufferFetch<unknown>(`/updates/${bufferId}/destroy.json`, {
    method: "DELETE",
  });
}

// ─── 4. getBufferPostAnalytics ───────────────────────────────────────────────

interface RawUpdate {
  statistics?: {
    impressions?: number;
    reach?: number;
    clicks?: number;
    favorites?: number;
    mentions?: number;
    reshares?: number;
    shares?: number;
  };
}

export async function getBufferPostAnalytics(
  bufferId: string
): Promise<BufferAnalytics> {
  const data = await bufferFetch<RawUpdate>(`/updates/${bufferId}.json`);
  const s = data.statistics ?? {};

  return {
    impressions: s.impressions ?? s.reach ?? 0,
    likes:       s.favorites ?? 0,
    comments:    s.mentions  ?? 0,
    shares:      s.reshares  ?? s.shares ?? 0,
    clicks:      s.clicks    ?? 0,
  };
}
