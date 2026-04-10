export default function MarketingLoading() {
  return (
    <div style={{ background: "var(--cream)", minHeight: "100vh" }} aria-busy="true">
      <div className="container-editorial py-8 animate-pulse">
        {/* Hero skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
          <div className="rounded-sm" style={{ height: 400, background: "var(--border)" }} />
          <div className="space-y-4">
            <div className="h-4 w-24 rounded" style={{ background: "var(--border)" }} />
            <div className="h-8 rounded" style={{ background: "var(--border)" }} />
            <div className="h-8 w-3/4 rounded" style={{ background: "var(--border)" }} />
            <div className="h-4 rounded" style={{ background: "var(--border)" }} />
            <div className="h-4 w-5/6 rounded" style={{ background: "var(--border)" }} />
          </div>
        </div>

        {/* Article grid skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-3">
              <div className="rounded-sm" style={{ height: 180, background: "var(--border)" }} />
              <div className="h-3 w-20 rounded" style={{ background: "var(--border)" }} />
              <div className="h-5 rounded" style={{ background: "var(--border)" }} />
              <div className="h-5 w-4/5 rounded" style={{ background: "var(--border)" }} />
              <div className="h-3 w-1/3 rounded" style={{ background: "var(--border)" }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
