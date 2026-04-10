import Link from "next/link";

export default function SubscribeSuccessPage() {
  return (
    <div style={{ background: "var(--cream)", minHeight: "100vh" }}>
      <div className="container-editorial py-32 text-center">
        <p className="eyebrow-gold mb-4" style={{ color: "var(--gold)" }}>Welcome aboard</p>
        <h1 className="text-4xl font-serif font-bold mb-4" style={{ color: "var(--navy)" }}>
          You&apos;re in. The boardroom awaits.
        </h1>
        <p className="text-lg font-sans mb-8 max-w-md mx-auto" style={{ color: "var(--ink-m)" }}>
          Your Pro subscription is active. Check your inbox — the Morning Brief lands at 6am.
        </p>
        <Link href="/" className="btn-red">Read today&apos;s brief</Link>
      </div>
    </div>
  );
}
