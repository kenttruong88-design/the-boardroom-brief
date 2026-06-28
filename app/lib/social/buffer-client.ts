import * as Sentry from "@sentry/nextjs";

const BASE_URL = "https://api.buffer.com/graphql";

function token(): string {
  const t = process.env.BUFFER_ACCESS_TOKEN;
  if (!t) throw new Error("BUFFER_ACCESS_TOKEN is not set");
  return t;
}

async function graphql<T>(
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const res = await fetch(BASE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token()}`,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    let message = `Buffer API error ${res.status}`;
    try {
      const body = await res.json() as { errors?: { message: string }[] };
      message = body.errors?.[0]?.message ?? message;
    } catch {
      // ignore parse failure
    }
    const error = new Error(message);
    Sentry.captureException(error, { tags: { service: "buffer" } });
    throw error;
  }

  const json = await res.json() as { data: T; errors?: { message: string }[] };
  if (json.errors?.length) throw new Error(json.errors[0].message);
  return json.data;
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

// ─── Caches ───────────────────────────────────────────────────────────────────

let profileCache: BufferProfile[] | null = null;
let orgIdCache: string | null = null;

// ─── Internal helpers ─────────────────────────────────────────────────────────

async function getOrganizationId(): Promise<string> {
  if (orgIdCache) return orgIdCache;
  const data = await graphql<{
    account: { organizations: { id: string }[] };
  }>(`
    query GetOrganization {
      account {
        organizations { id }
      }
    }
  `);
  const orgId = data.account.organizations[0]?.id;
  if (!orgId) throw new Error("No Buffer organization found for this account");
  orgIdCache = orgId;
  return orgId;
}

async function createPostMutation(input: Record<string, unknown>): Promise<string> {
  const data = await graphql<{
    createPost: { post?: { id: string }; message?: string };
  }>(`
    mutation CreatePost($input: CreatePostInput!) {
      createPost(input: $input) {
        ... on PostActionSuccess {
          post { id }
        }
        ... on MutationError {
          message
        }
      }
    }
  `, { input });

  const postId = data.createPost.post?.id;
  if (!postId) throw new Error(data.createPost.message ?? "Buffer did not return a post ID");
  return postId;
}

// ─── 1. getBufferProfiles ─────────────────────────────────────────────────────

export async function getBufferProfiles(): Promise<BufferProfile[]> {
  if (profileCache) return profileCache;

  const organizationId = await getOrganizationId();
  const data = await graphql<{
    channels: { id: string; name: string; service: string }[];
  }>(`
    query GetChannels($organizationId: OrganizationId!) {
      channels(input: { organizationId: $organizationId }) {
        id
        name
        service
      }
    }
  `, { organizationId });

  const validServices = new Set(["linkedin", "twitter", "instagram"]);
  profileCache = data.channels
    .filter((c) => validServices.has(c.service.toLowerCase()))
    .map((c) => ({
      id: c.id,
      service: c.service.toLowerCase() as BufferProfile["service"],
      serviceUsername: c.name,
    }));

  return profileCache;
}

// ─── 2. scheduleBufferPost ────────────────────────────────────────────────────

export async function scheduleBufferPost(
  profileId: string,
  content: string,
  scheduledAt: Date,
  imageUrl?: string,
  platform?: string
): Promise<string> {
  const input: Record<string, unknown> = {
    text: content,
    channelId: profileId,
    schedulingType: "automatic",
    mode: "customScheduled",
    dueAt: scheduledAt.toISOString(),
    assets: imageUrl ? [{ image: { url: imageUrl } }] : [],
  };
  if (platform === "instagram") input.metadata = { instagram: { type: "post", shouldShareToFeed: true } };
  return createPostMutation(input);
}

// ─── 2b. createBufferDraft ────────────────────────────────────────────────────

export async function createBufferDraft(
  profileId: string,
  content: string,
  imageUrl?: string,
  platform?: string
): Promise<string> {
  const input: Record<string, unknown> = {
    text: content,
    channelId: profileId,
    schedulingType: "automatic",
    mode: "addToQueue",
    saveToDraft: true,
    assets: imageUrl ? [{ image: { url: imageUrl } }] : [],
  };
  if (platform === "instagram") input.metadata = { instagram: { type: "post", shouldShareToFeed: true } };
  return createPostMutation(input);
}

// ─── 2c. getBufferUser ────────────────────────────────────────────────────────

export async function getBufferUser(): Promise<{ plan: string }> {
  const data = await graphql<{
    account: { organizations: { name: string }[] };
  }>(`
    query GetAccount {
      account {
        organizations { name }
      }
    }
  `);
  return { plan: data.account.organizations[0]?.name ?? "buffer" };
}

// ─── 3. cancelBufferPost ──────────────────────────────────────────────────────

export async function cancelBufferPost(bufferId: string): Promise<void> {
  await graphql<unknown>(`
    mutation DeletePost($id: String!) {
      deletePost(input: { id: $id }) {
        ... on PostActionSuccess {
          post { id }
        }
        ... on MutationError {
          message
        }
      }
    }
  `, { id: bufferId });
}

// ─── 4. getBufferPostAnalytics ────────────────────────────────────────────────

export async function getBufferPostAnalytics(
  _bufferId: string
): Promise<BufferAnalytics> {
  // Per-post analytics not yet available in the Buffer GraphQL API public beta
  return { impressions: 0, likes: 0, comments: 0, shares: 0, clicks: 0 };
}
