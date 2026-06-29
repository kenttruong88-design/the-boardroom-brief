
# social-strategy-update.ps1
# Updates pillar→platform routing and posting times to match new strategy:
#   Twitter  → markets-floor + macro-mondays   (12 PM, 4 PM, 8 PM UTC)
#   LinkedIn → c-suite-circus + global-office  (7 AM, 12 PM UTC)
#   Instagram→ out-of-office + water-cooler    (11 AM UTC)

$Root = "C:\Users\kentt\Desktop\claude\news\the-boardroom-brief"

Write-Host "Applying social media strategy changes..." -ForegroundColor Cyan

# ── 1. queue-social-posts.ts ─────────────────────────────────────────────────
python3 @"
import re

path = r"$Root\app\lib\social\queue-social-posts.ts"
with open(path, encoding="utf-8") as f:
    src = f.read()

# Update time slots
src = src.replace(
    """const SOCIAL_SLOTS = {
  linkedin:  [{ h: 8,  m: 30 }, { h: 17, m: 0  }],
  twitter:   [{ h: 9,  m: 0  }, { h: 13, m: 0  }, { h: 17, m: 30 }],
  instagram: [{ h: 12, m: 0  }],
} as const;""",
    """const SOCIAL_SLOTS = {
  linkedin:  [{ h: 7,  m: 0  }, { h: 12, m: 0  }],
  twitter:   [{ h: 12, m: 0  }, { h: 16, m: 0  }, { h: 20, m: 0  }],
  instagram: [{ h: 11, m: 0  }],
} as const;

// Pillar → platform routing: each pillar posts to ONE platform only
const PILLAR_PLATFORMS: Record<string, ("linkedin" | "twitter" | "instagram")[]> = {
  "markets-floor":  ["twitter"],
  "macro-mondays":  ["twitter"],
  "c-suite-circus": ["linkedin"],
  "global-office":  ["linkedin"],
  "out-of-office":  ["instagram"],
  "water-cooler":   ["instagram"],
};"""
)

# Replace the platform loop to use pillar routing
src = src.replace(
    """  // Generate all platforms in parallel; Instagram skipped without a hero image
  const platformJobs: Promise<void>[] = [];
  const supabase = createAdminClient();

  const base = {
    article_id:       publishResult.sanityDocId,
    article_slug:     publishResult.slug,
    article_headline: draft.headline,
    article_url:      articleUrl,
    pillar:           pillarSlug,
    status:           "pending_approval",
    generated_by:     "auto",
  };

  type Platform = "linkedin" | "twitter" | "instagram";
  for (const platform of ["linkedin", "twitter", ...(hasImage ? ["instagram"] : [])] as Platform[]) {""",
    """  // Route to the correct platform(s) for this pillar
  const platforms = PILLAR_PLATFORMS[pillarSlug] ?? ["linkedin", "twitter"];

  const platformJobs: Promise<void>[] = [];
  const supabase = createAdminClient();

  const base = {
    article_id:       publishResult.sanityDocId,
    article_slug:     publishResult.slug,
    article_headline: draft.headline,
    article_url:      articleUrl,
    pillar:           pillarSlug,
    status:           "pending_approval",
    generated_by:     "auto",
  };

  type Platform = "linkedin" | "twitter" | "instagram";
  for (const platform of platforms as Platform[]) {"""
)

with open(path, "w", encoding="utf-8") as f:
    f.write(src)
print("queue-social-posts.ts updated")
"@

# ── 2. platform-rules.ts ─────────────────────────────────────────────────────
python3 @"
path = r"$Root\app\lib\social\platform-rules.ts"
with open(path, encoding="utf-8") as f:
    src = f.read()

# Update Twitter system prompt — FinTwit satirical voice
src = src.replace(
    """You write Twitter/X posts for The Alignment Times.
Rules:
- Under 240 chars including the link (reserve 25 chars for URL)
  So your actual copy must be under 215 chars
- The satirical subheadline is often your entire post
- One sharp, quotable observation
- At least 3 hashtags, placed at the end of the post
- No emojis unless Water Cooler pillar
- Write for the retweet, not the reply
${NO_MARKET_NUMBERS}
Tone: punchy, dry, devastating in under 200 chars.""",
    """You write Twitter/X posts for The Alignment Times — covering markets and macro only.
Your audience: FinTwit — traders, investors, economists, financial journalists.
Rules:
- Under 240 chars including the link (reserve 25 chars for URL), so copy must be under 215 chars
- Lead with the satirical subheadline or a punchy market observation
- Dry, sardonic humour — think Bloomberg Terminal meets The Onion
- At least 3 hashtags from: #FinTwit #Markets #Stocks #Macro #Economics #Fed #Investing #Trading
- No emojis
- Write for the retweet — one quotable line beats three good ones
${NO_MARKET_NUMBERS}
Tone: deadpan, financially literate, slightly devastating."""
)

# Update LinkedIn system prompt — corporate culture lens
src = src.replace(
    """You write LinkedIn posts for The Alignment Times.
Your audience: senior professionals, CFOs, VPs, founders.
Rules:
- Hook in the FIRST LINE before the fold (under 150 chars) — this is what appears before 'see more'. Make it stop-scrolling.
- Use short paragraphs (1-2 sentences max)
- End with a question that invites comment
- At least 3 hashtags, placed at the end
- No emojis unless pillar is water-cooler
- Never say 'I' — write as the publication, not a person
- Never start with 'We' either — lead with the insight
${NO_MARKET_NUMBERS}
Tone: authoritative, dry wit, safe to share from a work laptop.""",
    """You write LinkedIn posts for The Alignment Times — covering C-suite drama and global office culture only.
Your audience: senior professionals, CFOs, VPs, founders, HR leaders, and anyone who has survived a corporate restructure.
Rules:
- Hook in the FIRST LINE before the fold (under 150 chars) — make it stop-scrolling
- Short paragraphs (1-2 sentences max)
- Corporate culture lens: connect the story to what it means for leadership, workplace norms, or career strategy
- End with a question that provokes comment (debate drives reach on LinkedIn)
- At least 3 hashtags from: #Leadership #Corporate #BusinessCulture #Management #FutureOfWork #HR #GlobalBusiness #CorporateLife
- No emojis
- Never say 'I' — write as the publication
- Never start with 'We' — lead with the insight
${NO_MARKET_NUMBERS}
Tone: authoritative, culturally sharp, safe to share from a work laptop."""
)

# Update Instagram system prompt — lifestyle & relationships voice
src = src.replace(
    """You write Instagram captions for The Alignment Times.
Rules:
- More conversational than LinkedIn — slightly warmer
- First line must hook before the fold (under 125 chars)
- Body: expand on the article insight in an accessible way
- End with 'Full article — link in bio'
- At least 5 hashtags at the end, mix of broad and niche
  e.g. #business #finance #corporatelife #leadership
- One emoji maximum, used sparingly
${NO_MARKET_NUMBERS}
Tone: smart, approachable, slightly more human than LinkedIn.""",
    """You write Instagram captions for The Alignment Times — covering out-of-office lifestyle and water cooler culture only.
Your audience: 25-40 professionals who follow work/life content, travel, remote work, and corporate comedy.
Rules:
- First line hooks before the fold (under 125 chars) — make it relatable or funny
- Warm, conversational, human — this is lifestyle content not a press release
- Lean into relationships, identity, and lived experience: 'we've all been that person who...'
- End with 'Full article — link in bio'
- At least 5 hashtags mixing lifestyle and work: #WorkLife #OfficeLife #CorporateHumour #RemoteWork #OutOfOffice #WorkLifeBalance #CareerLife #9to5 #AdultingIsHard
- One or two emojis where they feel natural
${NO_MARKET_NUMBERS}
Tone: relatable, warm, slightly self-aware — the colleague you actually want to grab lunch with."""
)

with open(path, "w", encoding="utf-8") as f:
    f.write(src)
print("platform-rules.ts updated")
"@

Write-Host ""
Write-Host "Done. Now commit:" -ForegroundColor Green
Write-Host ""
Write-Host 'cd "C:\Users\kentt\Desktop\claude\news\the-boardroom-brief"' -ForegroundColor Yellow
Write-Host "Remove-Item .git\index.lock -Force" -ForegroundColor Yellow
Write-Host "git add app/lib/social/queue-social-posts.ts app/lib/social/platform-rules.ts" -ForegroundColor Yellow
Write-Host 'git commit -m "feat: pillar→platform routing + new voice per platform"' -ForegroundColor Yellow
Write-Host "git push origin master" -ForegroundColor Yellow
