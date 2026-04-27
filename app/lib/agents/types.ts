export interface AgentPersona {
  name: string;
  role: string;
  pillar: string;
  systemPrompt: string;
}

export interface TopicBrief {
  title: string;
  angle: string;
  dataPoints: string[];
  wordCount: number;
}

export interface FeaturedImage {
  cloudinaryPublicId: string;
  url:                string;
  heroUrl:            string;
  thumbnailUrl:       string;
  ogImageUrl:         string;
  mobileUrl:          string;
  altText:            string;
  source:             "flux-schnell" | "dall-e-3" | "pexels" | "pillar-default";
  generatedPrompt?:   string;
  photographerName?:  string;
  photographerUrl?:   string;
  pexelsPageUrl?:     string;
  durationMs:         number;
}

export interface ArticleDraft {
  pillar: string;
  agentName: string;
  topicBrief: TopicBrief;
  headline: string;
  satiricalHeadline: string;
  body: string;
  seoTitle: string;
  seoDescription: string;
  tags: string[];
  tone: "satire" | "straight" | "hybrid";
  marketSymbols: string[];
  countries: string[];
  featuredImage?: FeaturedImage;
}

export interface EditorReview {
  articleIndex: number;
  score: number;
  passed: boolean;
  toneScore: number;
  accuracyScore: number;
  headlineScore: number;
  satireScore: number;
  originalityScore: number;
  notes: string;
  revisionsRequired: string[];
}

export interface DailyDigest {
  date: string;
  totalArticles: number;
  passedArticles: number;
  rejectedArticles: number;
  articles: Array<{
    draft: ArticleDraft;
    review: EditorReview;
  }>;
}
