import Link from "next/link";
import { Clock } from "lucide-react";
import { PILLARS, formatDate } from "@/app/lib/mock-data";

interface Article {
  slug: string;
  title: string;
  dek: string;
  section: string;
  author: string;
  publishedAt: string;
  readTime: number;
  featured?: boolean;
  image?: string | null;
}

interface ArticleCardProps {
  article: Article;
  variant?: "hero" | "featured" | "standard" | "compact";
}

function SectionBadge({ section }: { section: string }) {
  const pillar = PILLARS.find((p) => p.slug === section);
  if (!pillar) return null;
  return (
    <span className={`pill-badge ${pillar.color}`}>{pillar.name}</span>
  );
}

function Meta({ article }: { article: Article }) {
  return (
    <div className="flex items-center gap-3 text-xs text-slate-500">
      <span>{formatDate(article.publishedAt)}</span>
      <span className="flex items-center gap-1">
        <Clock className="w-3 h-3" />
        {article.readTime} min read
      </span>
    </div>
  );
}

export default function ArticleCard({ article, variant = "standard" }: ArticleCardProps) {
  if (variant === "hero") {
    return (
      <article className="group">
        <Link href={`/articles/${article.slug}`}>
          <div className="bg-navy-900 text-white rounded-xl overflow-hidden">
            {/* Placeholder image area */}
            <div className="bg-gradient-to-br from-navy-800 to-navy-950 h-72 sm:h-96 flex items-end p-8">
              <div className="space-y-4">
                <SectionBadge section={article.section} />
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white leading-tight group-hover:text-gold-300 transition-colors">
                  {article.title}
                </h1>
                <p className="text-slate-300 text-base leading-relaxed max-w-2xl hidden sm:block">
                  {article.dek}
                </p>
                <div className="flex items-center gap-3 text-xs text-slate-400">
                  <span>{formatDate(article.publishedAt)}</span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {article.readTime} min read
                  </span>
                </div>
              </div>
            </div>
          </div>
        </Link>
      </article>
    );
  }

  if (variant === "featured") {
    return (
      <article className="group border-b border-slate-200 pb-6">
        <Link href={`/articles/${article.slug}`} className="block space-y-2">
          <SectionBadge section={article.section} />
          <h2 className="text-lg font-bold text-navy-900 leading-snug group-hover:text-gold-600 transition-colors">
            {article.title}
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed">{article.dek}</p>
          <Meta article={article} />
        </Link>
      </article>
    );
  }

  if (variant === "compact") {
    return (
      <article className="group flex gap-4 border-b border-slate-100 pb-4">
        <div className="flex-1 min-w-0">
          <Link href={`/articles/${article.slug}`} className="block space-y-1">
            <h3 className="text-sm font-semibold text-navy-900 leading-snug group-hover:text-gold-600 transition-colors line-clamp-2">
              {article.title}
            </h3>
            <Meta article={article} />
          </Link>
        </div>
      </article>
    );
  }

  // standard
  return (
    <article className="group space-y-2">
      <Link href={`/articles/${article.slug}`} className="block space-y-2">
        <SectionBadge section={article.section} />
        <h2 className="text-base font-bold text-navy-900 leading-snug group-hover:text-gold-600 transition-colors">
          {article.title}
        </h2>
        <p className="text-sm text-slate-600 leading-relaxed line-clamp-3">{article.dek}</p>
        <Meta article={article} />
      </Link>
    </article>
  );
}
