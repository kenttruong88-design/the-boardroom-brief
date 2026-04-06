export const PILLARS = [
  {
    slug: "markets-floor",
    name: "Markets Floor",
    description: "Capital markets, indices, commodities, and the people who move them",
    color: "text-blue-700 border-blue-700",
    bg: "bg-blue-50",
  },
  {
    slug: "macro-mondays",
    name: "Macro Mondays",
    description: "Central banks, GDP, inflation, and all the numbers no one agrees on",
    color: "text-emerald-700 border-emerald-700",
    bg: "bg-emerald-50",
  },
  {
    slug: "c-suite-circus",
    name: "C-Suite Circus",
    description: "Executive moves, corporate strategy, and boardroom theatre",
    color: "text-purple-700 border-purple-700",
    bg: "bg-purple-50",
  },
  {
    slug: "global-office",
    name: "Global Office",
    description: "International business, geopolitics, and cultural misunderstandings",
    color: "text-amber-700 border-amber-700",
    bg: "bg-amber-50",
  },
  {
    slug: "water-cooler",
    name: "Water Cooler",
    description: "Corporate culture, workplace absurdity, and professional dark humour",
    color: "text-rose-700 border-rose-700",
    bg: "bg-rose-50",
  },
];

export const MOCK_ARTICLES = [
  {
    slug: "fed-holds-rates-signals-caution-2026",
    title: "Fed Holds Rates, Signals Caution as Inflation Data Disappoints",
    satiricalHeadline: "Committee Agrees To Agree To Reconvene And Consider Agreeing Later",
    excerpt:
      "The Federal Reserve left rates unchanged at its March meeting, with Chair Powell warning that the path to 2% inflation remains 'bumpy.' Markets repriced rate cut expectations sharply.",
    pillar: "markets-floor",
    author: "The Boardroom Brief",
    publishedAt: "2026-04-06T08:00:00Z",
    readTime: 4,
    featured: true,
  },
  {
    slug: "nvidia-enterprise-ai-spending-surge",
    title: "Nvidia's Enterprise Pipeline Points to Another Wave of AI Infrastructure Spend",
    satiricalHeadline: "Company That Sells Shovels Reports Everyone Still Digging",
    excerpt:
      "Hyperscaler capex commitments and a surge in sovereign AI deals suggest the infrastructure buildout is far from over.",
    pillar: "markets-floor",
    author: "The Boardroom Brief",
    publishedAt: "2026-04-06T07:30:00Z",
    readTime: 5,
    featured: false,
  },
  {
    slug: "china-gdp-q1-2026-rebound",
    title: "China's Q1 GDP Surprises to the Upside — But the Recovery is Uneven",
    satiricalHeadline: "Numbers Better Than Expected; Feelings Remain Complicated",
    excerpt:
      "Exports and manufacturing drove the beat, while domestic consumption remains subdued. The property sector continues to weigh on sentiment despite targeted stimulus.",
    pillar: "macro-mondays",
    author: "The Boardroom Brief",
    publishedAt: "2026-04-05T09:00:00Z",
    readTime: 6,
    featured: false,
  },
  {
    slug: "ceo-turnover-record-q1-2026",
    title: "CEO Turnover Hits a Decade High in Q1 — Who's Next in the Hot Seat",
    satiricalHeadline: "Performance Review Season Claims Another Victim",
    excerpt:
      "Activist pressure, AI disruption, and shareholder impatience are reshaping the average tenure of a Fortune 500 CEO.",
    pillar: "c-suite-circus",
    author: "The Boardroom Brief",
    publishedAt: "2026-04-05T08:00:00Z",
    readTime: 5,
    featured: false,
  },
  {
    slug: "eu-ai-act-enforcement-begins",
    title: "EU AI Act Enforcement Begins — What Every Boardroom Needs to Know",
    satiricalHeadline: "Europe Invents New Form of Compliance That Requires More Meetings",
    excerpt:
      "Phase one obligations are now live. Companies with high-risk AI systems face audits, documentation requirements, and fines up to 7% of global turnover.",
    pillar: "global-office",
    author: "The Boardroom Brief",
    publishedAt: "2026-04-04T09:00:00Z",
    readTime: 7,
    featured: false,
  },
  {
    slug: "open-plan-office-productivity-myth",
    title: "The Open-Plan Office Was a Mistake. Here's a 47-Slide Deck Proving It.",
    satiricalHeadline: "Study Confirms What Every Introvert Has Known Since 2009",
    excerpt:
      "New research from three universities confirms that open-plan offices reduce productivity, increase stress, and generate Slack messages that could have been emails.",
    pillar: "water-cooler",
    author: "The Boardroom Brief",
    publishedAt: "2026-04-04T08:00:00Z",
    readTime: 3,
    featured: false,
  },
  {
    slug: "dollar-strength-em-pressure-2026",
    title: "Dollar Strength is Back — and Emerging Markets Are Feeling It",
    satiricalHeadline: "Strong Dollar Continues Tradition of Being Inconvenient For Everyone Else",
    excerpt:
      "DXY above 106 is tightening financial conditions across EM. We break down which economies are most exposed.",
    pillar: "markets-floor",
    author: "The Boardroom Brief",
    publishedAt: "2026-04-04T07:00:00Z",
    readTime: 5,
    featured: false,
  },
  {
    slug: "germany-industrial-structural-decline",
    title: "Germany's Industrial Decline is No Longer Cyclical — It's Structural",
    satiricalHeadline: "Country Famous For Engineering Efficiency Finds Process Difficult To Engineer Away",
    excerpt:
      "Three consecutive years of manufacturing contraction, energy cost disadvantage, and China competition have economists revising long-term growth estimates downward.",
    pillar: "macro-mondays",
    author: "The Boardroom Brief",
    publishedAt: "2026-04-03T09:00:00Z",
    readTime: 6,
    featured: false,
  },
  {
    slug: "linkedin-thought-leadership-epidemic",
    title: "The LinkedIn Thought Leadership Epidemic Has Officially Jumped the Shark",
    satiricalHeadline: "Man Explains Resilience Using Story About His Uber Driver",
    excerpt:
      "A new analysis finds that 94% of LinkedIn 'insights' posted by executives could be replaced by a fortune cookie without loss of intellectual content.",
    pillar: "water-cooler",
    author: "The Boardroom Brief",
    publishedAt: "2026-04-03T08:00:00Z",
    readTime: 4,
    featured: false,
  },
  {
    slug: "anthropic-enterprise-expansion-2026",
    title: "Anthropic's Enterprise Push is Reshaping the AI Vendor Landscape",
    satiricalHeadline: "AI Company Discovers Enterprises Will Pay More If You Call It 'Enterprise'",
    excerpt:
      "Claude's expanding share in financial services and legal sectors signals a shift from experimentation to mission-critical deployment.",
    pillar: "c-suite-circus",
    author: "The Boardroom Brief",
    publishedAt: "2026-04-03T07:00:00Z",
    readTime: 4,
    featured: false,
  },
];

export const TICKER_DATA = [
  { symbol: "S&P 500", value: "5,218.19", change: "+0.87%", up: true },
  { symbol: "DAX",     value: "18,492.35", change: "+0.31%", up: true },
  { symbol: "FTSE 100",value: "8,112.60", change: "-0.14%", up: false },
  { symbol: "Nikkei",  value: "39,872.11", change: "+1.22%", up: true },
  { symbol: "Hang Seng",value: "17,284.54", change: "-0.88%", up: false },
  { symbol: "Bovespa", value: "128,543",  change: "+0.42%", up: true },
  { symbol: "10Y UST", value: "4.38%",    change: "+3bps",   up: false },
  { symbol: "EUR/USD", value: "1.0812",   change: "-0.21%", up: false },
  { symbol: "Gold",    value: "$2,318",   change: "+0.54%", up: true },
  { symbol: "WTI",     value: "$83.12",   change: "-0.77%", up: false },
  { symbol: "BTC",     value: "$69,420",  change: "+2.31%", up: true },
  { symbol: "VIX",     value: "14.82",    change: "-0.94%", up: false },
];

export const ECONOMIES = [
  { slug: "united-states",  name: "United States",  region: "Americas",           code: "US", flag: "🇺🇸" },
  { slug: "canada",         name: "Canada",          region: "Americas",           code: "CA", flag: "🇨🇦" },
  { slug: "brazil",         name: "Brazil",          region: "Americas",           code: "BR", flag: "🇧🇷" },
  { slug: "mexico",         name: "Mexico",          region: "Americas",           code: "MX", flag: "🇲🇽" },
  { slug: "argentina",      name: "Argentina",       region: "Americas",           code: "AR", flag: "🇦🇷" },
  { slug: "chile",          name: "Chile",           region: "Americas",           code: "CL", flag: "🇨🇱" },
  { slug: "united-kingdom", name: "United Kingdom",  region: "Europe",             code: "GB", flag: "🇬🇧" },
  { slug: "germany",        name: "Germany",         region: "Europe",             code: "DE", flag: "🇩🇪" },
  { slug: "france",         name: "France",          region: "Europe",             code: "FR", flag: "🇫🇷" },
  { slug: "italy",          name: "Italy",           region: "Europe",             code: "IT", flag: "🇮🇹" },
  { slug: "spain",          name: "Spain",           region: "Europe",             code: "ES", flag: "🇪🇸" },
  { slug: "netherlands",    name: "Netherlands",     region: "Europe",             code: "NL", flag: "🇳🇱" },
  { slug: "switzerland",    name: "Switzerland",     region: "Europe",             code: "CH", flag: "🇨🇭" },
  { slug: "sweden",         name: "Sweden",          region: "Europe",             code: "SE", flag: "🇸🇪" },
  { slug: "poland",         name: "Poland",          region: "Europe",             code: "PL", flag: "🇵🇱" },
  { slug: "norway",         name: "Norway",          region: "Europe",             code: "NO", flag: "🇳🇴" },
  { slug: "china",          name: "China",           region: "Asia-Pacific",       code: "CN", flag: "🇨🇳" },
  { slug: "japan",          name: "Japan",           region: "Asia-Pacific",       code: "JP", flag: "🇯🇵" },
  { slug: "india",          name: "India",           region: "Asia-Pacific",       code: "IN", flag: "🇮🇳" },
  { slug: "south-korea",    name: "South Korea",     region: "Asia-Pacific",       code: "KR", flag: "🇰🇷" },
  { slug: "australia",      name: "Australia",       region: "Asia-Pacific",       code: "AU", flag: "🇦🇺" },
  { slug: "singapore",      name: "Singapore",       region: "Asia-Pacific",       code: "SG", flag: "🇸🇬" },
  { slug: "indonesia",      name: "Indonesia",       region: "Asia-Pacific",       code: "ID", flag: "🇮🇩" },
  { slug: "malaysia",       name: "Malaysia",        region: "Asia-Pacific",       code: "MY", flag: "🇲🇾" },
  { slug: "thailand",       name: "Thailand",        region: "Asia-Pacific",       code: "TH", flag: "🇹🇭" },
  { slug: "vietnam",        name: "Vietnam",         region: "Asia-Pacific",       code: "VN", flag: "🇻🇳" },
  { slug: "saudi-arabia",   name: "Saudi Arabia",    region: "Middle East & Africa", code: "SA", flag: "🇸🇦" },
  { slug: "uae",            name: "UAE",             region: "Middle East & Africa", code: "AE", flag: "🇦🇪" },
  { slug: "south-africa",   name: "South Africa",    region: "Middle East & Africa", code: "ZA", flag: "🇿🇦" },
  { slug: "nigeria",        name: "Nigeria",         region: "Middle East & Africa", code: "NG", flag: "🇳🇬" },
];

export const PILLAR_SLUGS = PILLARS.map((p) => p.slug);

export function getPillar(slug: string) {
  return PILLARS.find((p) => p.slug === slug);
}

export function getArticlesByPillar(pillar: string) {
  return MOCK_ARTICLES.filter((a) => a.pillar === pillar);
}

export function getArticleBySlug(slug: string) {
  return MOCK_ARTICLES.find((a) => a.slug === slug);
}

export function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function formatDateShort(dateString: string) {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
