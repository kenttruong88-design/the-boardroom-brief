export default function ArticleLoading() {
  return (
    <div style={{ background: "var(--cream)", minHeight: "100vh" }} aria-busy="true">
      <div className="container-editorial py-8 animate-pulse">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          <article className="lg:col-span-2 space-y-4">
            <div className="h-3 w-16 rounded" style={{ background: "var(--border)" }} />
            <div className="h-10 rounded" style={{ background: "var(--border)" }} />
            <div className="h-10 w-4/5 rounded" style={{ background: "var(--border)" }} />
            <div className="h-5 w-1/2 rounded" style={{ background: "var(--border)" }} />
            <div className="rounded-sm mt-4" style={{ height: 340, background: "var(--border)" }} />
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-4 rounded" style={{ background: "var(--border)", width: i % 2 === 0 ? "100%" : "85%" }} />
            ))}
          </article>
          <aside className="space-y-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="h-4 rounded" style={{ background: "var(--border)" }} />
                <div className="h-4 w-3/4 rounded" style={{ background: "var(--border)" }} />
                <div className="h-3 w-1/3 rounded" style={{ background: "var(--border)" }} />
              </div>
            ))}
          </aside>
        </div>
      </div>
    </div>
  );
}
