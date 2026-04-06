import { redirect } from "next/navigation";
import { MOCK_ARTICLES } from "@/app/lib/mock-data";

interface Props {
  params: Promise<{ slug: string }>;
}

// Redirect legacy /articles/[slug] → /[pillar]/[slug]
export default async function ArticleRedirect({ params }: Props) {
  const { slug } = await params;
  const article = MOCK_ARTICLES.find((a) => a.slug === slug);
  redirect(article ? `/${article.pillar}/${article.slug}` : "/");
}
