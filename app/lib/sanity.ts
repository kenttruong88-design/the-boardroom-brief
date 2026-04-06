import { createClient } from "@sanity/client";
import imageUrlBuilder from "@sanity/image-url";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SanityImageSource = any;

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET ?? "production";

// Guard: if projectId is missing (e.g. during Vercel build without env vars),
// return a no-op client so the build doesn't crash at module evaluation.
export const client = projectId
  ? createClient({ projectId, dataset, apiVersion: "2024-01-01", useCdn: true })
  : null;

export const writeClient = projectId
  ? createClient({ projectId, dataset, apiVersion: "2024-01-01", useCdn: false, token: process.env.SANITY_API_TOKEN })
  : null;

const builder = client ? imageUrlBuilder(client) : null;

export function urlFor(source: SanityImageSource) {
  if (!builder) return { url: () => "" };
  return builder.image(source);
}
