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
      <div className="min-h-screen bg-cream-100 dark:bg-navy-500">
        <div className="site-container py-32 text-center">
          <h1 className="font-headline font-black text-2xl text-navy-500 dark:text-cream-100 tracking-tight mb-4">
            Preferences link required
          </h1>
          <p className="font-body text-sm text-ink-muted dark:text-cream-300 mb-6">
            Use the link from your Morning Brief email to manage your preferences.
          </p>
          <Link
            href="/subscribe"
            className="inline-block font-body text-xs font-bold tracking-widest uppercase px-5 py-2.5 bg-red-500 text-cream-100 no-underline hover:bg-navy-500 dark:hover:bg-cream-200 dark:hover:text-navy-500 transition-colors duration-[120ms]"
          >
            Subscribe to get started
          </Link>
        </div>
      </div>
    );
  }

  const subscriber = await getSubscriber(token);

  if (!subscriber) {
    return (
      <div className="min-h-screen bg-cream-100 dark:bg-navy-500">
        <div className="site-container py-32 text-center">
          <h1 className="font-headline font-black text-2xl text-navy-500 dark:text-cream-100 tracking-tight mb-4">
            Link expired or not found
          </h1>
          <p className="font-body text-sm text-ink-muted dark:text-cream-300 mb-6">
            This preferences link is invalid. Check the most recent Morning Brief for a valid link.
          </p>
          <Link
            href="/subscribe"
            className="inline-block font-body text-xs font-bold tracking-widest uppercase px-5 py-2.5 bg-red-500 text-cream-100 no-underline hover:bg-navy-500 dark:hover:bg-cream-200 dark:hover:text-navy-500 transition-colors duration-[120ms]"
          >
            Subscribe
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream-100 dark:bg-navy-500">
      <div className="site-container py-16">
        <div className="max-w-2xl mx-auto">

          <div className="mb-10">
            <p className="font-body text-xs font-bold tracking-widest uppercase text-red-500 mb-3">
              The Alignment Times
            </p>
            <h1 className="font-headline font-black text-3xl text-navy-500 dark:text-cream-100 tracking-tight mb-2">
              Your preferences
            </h1>
            <p className="font-body text-sm text-ink-muted dark:text-cream-300">
              Managing preferences for{" "}
              <strong className="text-ink dark:text-cream-100">{subscriber.email}</strong>
            </p>
          </div>

          <PreferencesForm subscriber={subscriber} token={token} />

          <div className="mt-8 pt-6 border-t border-rule dark:border-rule-dark">
            <p className="font-body text-xs text-ink-muted dark:text-cream-500">
              Want to stop receiving the Brief entirely?{" "}
              <Link
                href={`/api/newsletter/unsubscribe?token=${token}`}
                className="underline hover:text-red-500 transition-colors duration-[120ms]"
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
