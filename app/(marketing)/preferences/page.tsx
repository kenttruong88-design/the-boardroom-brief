import { createAdminClient } from "@/app/lib/supabase-server";
import PreferencesForm from "@/app/components/newsletter/PreferencesForm";
import Link from "next/link";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ token?: string }>;
}

async function getSubscriber(token: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("subscribers")
    .select("id, email, first_name, segments, economies, frequency")
    .eq("unsubscribe_token", token)
    .neq("status", "unsubscribed")
    .single();

  if (error || !data) return null;
  return data as {
    id: string;
    email: string;
    first_name: string | null;
    segments: string[] | null;
    economies: string[] | null;
    frequency: string | null;
  };
}

export default async function PreferencesPage({ searchParams }: Props) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <div style={{ background: "var(--cream)", minHeight: "100vh" }}>
        <div className="container-editorial py-32 text-center">
          <h1 className="text-2xl font-serif font-bold mb-4" style={{ color: "var(--navy)" }}>
            Preferences link required
          </h1>
          <p className="text-sm font-sans mb-6" style={{ color: "var(--ink-m)" }}>
            Use the link from your Morning Brief email to manage your preferences.
          </p>
          <Link href="/subscribe" className="btn-red">Subscribe to get started</Link>
        </div>
      </div>
    );
  }

  const subscriber = await getSubscriber(token);

  if (!subscriber) {
    return (
      <div style={{ background: "var(--cream)", minHeight: "100vh" }}>
        <div className="container-editorial py-32 text-center">
          <h1 className="text-2xl font-serif font-bold mb-4" style={{ color: "var(--navy)" }}>
            Link expired or not found
          </h1>
          <p className="text-sm font-sans mb-6" style={{ color: "var(--ink-m)" }}>
            This preferences link is invalid. Check the most recent Morning Brief for a valid link.
          </p>
          <Link href="/subscribe" className="btn-red">Subscribe</Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: "var(--cream)", minHeight: "100vh" }}>
      <div className="container-editorial py-16">
        <div className="max-w-2xl mx-auto">

          <div className="mb-10">
            <p className="eyebrow mb-3" style={{ color: "var(--red)" }}>
              The Boardroom Brief
            </p>
            <h1
              className="text-3xl font-serif font-bold mb-2"
              style={{ color: "var(--navy)" }}
            >
              Your preferences
            </h1>
            <p className="text-sm font-sans" style={{ color: "var(--ink-m)" }}>
              Managing preferences for{" "}
              <strong style={{ color: "var(--ink)" }}>{subscriber.email}</strong>
            </p>
          </div>

          <PreferencesForm subscriber={subscriber} token={token} />

          <div className="mt-8 pt-6" style={{ borderTop: "1px solid var(--border)" }}>
            <p className="text-xs font-sans" style={{ color: "var(--ink-m)" }}>
              Want to stop receiving the Brief entirely?{" "}
              <Link
                href={`/api/newsletter/unsubscribe?token=${token}`}
                className="underline hover:opacity-70 transition-opacity"
                style={{ color: "var(--ink-m)" }}
              >
                Unsubscribe
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
