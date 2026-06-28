#!/usr/bin/env python3
"""
publish-global-office.py
────────────────────────
Picks the 2 oldest unpublished Global Office markdown articles from the
project folder and posts them to Sanity CMS as published articles.

Tracking: scripts/.published-global-office.json  (list of filenames already sent)

Usage:
  python3 scripts/publish-global-office.py            # publish 2 articles
  python3 scripts/publish-global-office.py --dry-run  # preview without posting
  python3 scripts/publish-global-office.py --count 1  # publish N articles
"""

import argparse
import json
import os
import re
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

import requests
import yaml

# ── Paths & config ────────────────────────────────────────────────────────────

ROOT = Path(__file__).resolve().parent.parent   # the-boardroom-brief/
TRACKING = Path(__file__).resolve().parent / ".published-global-office.json"

SANITY_PROJECT_ID = os.environ.get("NEXT_PUBLIC_SANITY_PROJECT_ID", "e8dwtkci")
SANITY_DATASET    = os.environ.get("NEXT_PUBLIC_SANITY_DATASET", "production")
SANITY_TOKEN      = os.environ.get("SANITY_API_TOKEN")
SITE_URL          = os.environ.get("NEXT_PUBLIC_SITE_URL", "https://thealignmenttimes.com")

SANITY_MUTATE = (
    f"https://{SANITY_PROJECT_ID}.api.sanity.io"
    f"/v2024-01-01/data/mutate/{SANITY_DATASET}"
)
SANITY_QUERY = (
    f"https://{SANITY_PROJECT_ID}.api.sanity.io"
    f"/v2024-01-01/data/query/{SANITY_DATASET}"
)

PILLAR_ID   = "global-office"
PILLAR_NAME = "The Global Office"
AUTHOR_ID   = "author-priya-mehta"
AUTHOR_NAME = "Priya Mehta"


# ── Markdown parser ───────────────────────────────────────────────────────────

def key() -> str:
    return uuid.uuid4().hex[:12]


def parse_inline(text: str) -> list[dict]:
    """
    Convert inline markdown (bold, italic) to Sanity span children.
    Returns a list of span dicts.
    """
    spans = []
    # Pattern: **bold**, *italic*, or plain text
    pattern = re.compile(r"\*\*(.+?)\*\*|\*(.+?)\*|([^*]+)")
    for m in pattern.finditer(text):
        if m.group(1):  # **bold**
            spans.append({"_type": "span", "_key": key(), "text": m.group(1), "marks": ["strong"]})
        elif m.group(2):  # *italic*
            spans.append({"_type": "span", "_key": key(), "text": m.group(2), "marks": ["em"]})
        else:            # plain
            t = m.group(3)
            if t:
                spans.append({"_type": "span", "_key": key(), "text": t, "marks": []})
    return spans or [{"_type": "span", "_key": key(), "text": text, "marks": []}]


def markdown_to_blocks(body: str) -> list[dict]:
    """
    Convert markdown body to Sanity portable text blocks.
    - ## → h2,  ### → h3
    - ![alt](url) → skipped (hero/body images handled via coverImage field)
    - *italic / **bold** inline marks supported
    - Byline lines (*By …*) and caption lines (*Illustration:…*) → italic block
    - Blank lines separate blocks
    """
    blocks = []
    raw_paras = re.split(r"\n{2,}", body.strip())

    for para in raw_paras:
        para = para.strip()
        if not para:
            continue

        # Skip image lines entirely — stored as coverImage / ogImage
        if re.match(r"^!\[", para):
            continue

        # Heading ## or ###
        h3 = re.match(r"^###\s+(.+)", para)
        h2 = re.match(r"^##\s+(.+)", para)
        if h3:
            blocks.append({
                "_type": "block", "_key": key(), "style": "h3",
                "markDefs": [],
                "children": parse_inline(h3.group(1)),
            })
            continue
        if h2:
            blocks.append({
                "_type": "block", "_key": key(), "style": "h2",
                "markDefs": [],
                "children": parse_inline(h2.group(1)),
            })
            continue

        # Multi-line paragraph — join lines
        lines = para.splitlines()
        merged = " ".join(l.strip() for l in lines if l.strip())

        # Skip image-only lines that slipped through
        if re.match(r"^!\[", merged):
            continue

        blocks.append({
            "_type": "block", "_key": key(), "style": "normal",
            "markDefs": [],
            "children": parse_inline(merged),
        })

    return blocks


# ── Frontmatter parser ────────────────────────────────────────────────────────

def parse_article(path: Path) -> dict | None:
    """Parse a markdown file into a structured dict. Returns None on failure."""
    text = path.read_text(encoding="utf-8")
    fm_match = re.match(r"^---\n(.*?)\n---\n(.*)", text, re.DOTALL)
    if not fm_match:
        print(f"  ⚠ No frontmatter found in {path.name} — skipping")
        return None

    try:
        fm = yaml.safe_load(fm_match.group(1))
    except yaml.YAMLError as e:
        print(f"  ⚠ YAML error in {path.name}: {e} — skipping")
        return None

    body_md = fm_match.group(2).strip()

    # Extract title from first H1 line (# Title) or first ## heading
    title_match = re.search(r"^#\s+(.+)$", body_md, re.MULTILINE)
    title = title_match.group(1).strip() if title_match else path.stem.replace("-", " ").title()

    # Satirical headline: the italic byline "By Priya Mehta, The Global Office"
    # → extract first paragraph-level italicised line after the H1 as excerpt instead
    excerpt_match = re.search(
        r"^(?:#{1,3}.+\n+)?(.+?)(?:\n\n|\Z)", body_md.lstrip("# \n"), re.DOTALL
    )
    excerpt = ""
    if excerpt_match:
        raw = excerpt_match.group(1).strip()
        # Strip markdown formatting for plain excerpt
        raw = re.sub(r"\*\*(.+?)\*\*", r"\1", raw)
        raw = re.sub(r"\*(.+?)\*", r"\1", raw)
        raw = re.sub(r"!\[.*?\]\(.*?\)", "", raw)
        excerpt = raw[:300].strip()

    # Hero image URL from frontmatter
    images = fm.get("images", {}) or {}
    hero_url = images.get("hero", "")
    og_url   = images.get("body", hero_url)

    # Countries list
    countries_raw = fm.get("countries", "")
    if isinstance(countries_raw, str):
        countries = [c.strip() for c in countries_raw.split(",") if c.strip()]
    elif isinstance(countries_raw, list):
        countries = countries_raw
    else:
        countries = []

    # Published date
    date_val = fm.get("date")
    if isinstance(date_val, str):
        pub_dt = datetime.fromisoformat(date_val).replace(
            hour=8, tzinfo=timezone.utc
        ).isoformat()
    elif date_val:
        pub_dt = datetime(date_val.year, date_val.month, date_val.day,
                          8, 0, 0, tzinfo=timezone.utc).isoformat()
    else:
        pub_dt = datetime.now(timezone.utc).isoformat()

    # Portable text body (strip the H1 title line to avoid duplication)
    body_no_title = re.sub(r"^#\s+.+\n*", "", body_md, count=1).strip()
    blocks = markdown_to_blocks(body_no_title)

    # Estimate read time
    word_count = fm.get("word_count") or len(body_md.split())
    read_time = max(1, round(int(word_count) / 200))

    # Slug
    slug_base = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")[:96]

    # Sources for seoDescription
    subject = fm.get("subject", "")
    c_str   = " vs ".join(countries[:2]) if len(countries) >= 2 else ", ".join(countries)
    seo_desc = f"{c_str}: {subject}. Analysis by Priya Mehta for The Alignment Times."[:160]

    return {
        "filename":    path.name,
        "title":       title,
        "slug":        slug_base,
        "excerpt":     excerpt,
        "subject":     subject,
        "countries":   countries,
        "hero_url":    hero_url,
        "og_url":      og_url,
        "pub_dt":      pub_dt,
        "read_time":   read_time,
        "blocks":      blocks,
        "seo_desc":    seo_desc,
        "word_count":  word_count,
    }


# ── Sanity helpers ────────────────────────────────────────────────────────────

def sanity_headers() -> dict:
    return {
        "Authorization": f"Bearer {SANITY_TOKEN}",
        "Content-Type":  "application/json",
    }


def ensure_pillar() -> None:
    """Create the global-office pillar doc if it doesn't exist."""
    mutations = [{
        "createIfNotExists": {
            "_id":   PILLAR_ID,
            "_type": "pillar",
            "name":  PILLAR_NAME,
            "slug":  {"_type": "slug", "current": PILLAR_ID},
        }
    }]
    r = requests.post(SANITY_MUTATE, headers=sanity_headers(),
                      json={"mutations": mutations}, timeout=15)
    r.raise_for_status()


def ensure_author() -> None:
    """Create the Priya Mehta author doc if it doesn't exist."""
    mutations = [{
        "createIfNotExists": {
            "_id":   AUTHOR_ID,
            "_type": "author",
            "name":  AUTHOR_NAME,
            "slug":  {"_type": "slug", "current": "priya-mehta"},
            "bio":   "Staff writer for The Alignment Times covering global work and life culture.",
        }
    }]
    r = requests.post(SANITY_MUTATE, headers=sanity_headers(),
                      json={"mutations": mutations}, timeout=15)
    r.raise_for_status()


def publish_article(article: dict, dry_run: bool = False) -> str:
    """
    Upsert the article to Sanity. Returns the published URL.
    Uses createOrReplace so re-running is idempotent.
    """
    doc_id = f"article-{article['slug']}"

    # Country reference IDs: use slugified name as stable _id
    country_refs = []
    for c in article["countries"]:
        cid = "country-" + re.sub(r"[^a-z0-9]+", "-", c.lower()).strip("-")
        country_refs.append({"_type": "reference", "_ref": cid, "_key": key()})

    doc = {
        "_id":              doc_id,
        "_type":            "article",
        "title":            article["title"],
        "slug":             {"_type": "slug", "current": article["slug"]},
        "excerpt":          article["excerpt"],
        "body":             article["blocks"],
        "pillar":           {"_type": "reference", "_ref": PILLAR_ID},
        "author":           {"_type": "reference", "_ref": AUTHOR_ID},
        "countries":        country_refs,
        "publishedAt":      article["pub_dt"],
        "readTime":         article["read_time"],
        "featured":         False,
        "aiGenerated":      True,
        "agentName":        "Priya Mehta",
        # Image fields (URL-based, not Sanity asset uploads)
        "ogImage":          article["og_url"] or article["hero_url"],
        "imageGeneratedWith": "pexels",
        # SEO
        "seoDescription":   article["seo_desc"],
    }

    published_url = f"{SITE_URL}/global-office/{article['slug']}"

    if dry_run:
        print(f"  [dry-run] Would create: {doc_id}")
        print(f"            Title:  {article['title']}")
        print(f"            Slug:   {article['slug']}")
        print(f"            Date:   {article['pub_dt']}")
        print(f"            Blocks: {len(article['blocks'])}")
        print(f"            URL:    {published_url}")
        return published_url

    mutations = [{"createOrReplace": doc}]
    r = requests.post(
        SANITY_MUTATE,
        headers=sanity_headers(),
        json={"mutations": mutations},
        timeout=20,
    )
    r.raise_for_status()
    result = r.json()
    if result.get("error"):
        raise RuntimeError(f"Sanity error: {result['error']}")

    # Trigger ISR revalidation (non-fatal)
    try:
        revalidate_secret = os.environ.get("REVALIDATE_SECRET", "")
        requests.post(
            f"{SITE_URL}/api/revalidate?secret={revalidate_secret}&path=/global-office",
            timeout=5,
        )
    except Exception:
        pass

    return published_url


# ── Country doc upserts ───────────────────────────────────────────────────────

def ensure_countries(countries: list[str], dry_run: bool) -> None:
    if not countries or dry_run:
        return
    mutations = []
    for c in countries:
        cid = "country-" + re.sub(r"[^a-z0-9]+", "-", c.lower()).strip("-")
        mutations.append({
            "createIfNotExists": {
                "_id":   cid,
                "_type": "country",
                "name":  c,
                "slug":  {"_type": "slug", "current": cid.replace("country-", "")},
            }
        })
    if mutations:
        r = requests.post(SANITY_MUTATE, headers=sanity_headers(),
                          json={"mutations": mutations}, timeout=15)
        r.raise_for_status()


# ── Tracking ──────────────────────────────────────────────────────────────────

def load_tracking() -> set[str]:
    if TRACKING.exists():
        return set(json.loads(TRACKING.read_text()))
    return set()


def save_tracking(published: set[str]) -> None:
    TRACKING.write_text(json.dumps(sorted(published), indent=2))


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Publish Global Office articles to Sanity")
    parser.add_argument("--dry-run", action="store_true", help="Preview without posting")
    parser.add_argument("--count", type=int, default=2, help="Number of articles to publish (default 2)")
    args = parser.parse_args()

    if not SANITY_TOKEN and not args.dry_run:
        sys.exit("❌ SANITY_API_TOKEN is not set. Export it or use --dry-run.")

    # Find all Global Office markdown files, sorted oldest-first
    md_files = sorted(
        [f for f in ROOT.glob("*.md") if f.name != "SKILL.md"],
        key=lambda f: f.name,
    )

    published = load_tracking()
    candidates = [f for f in md_files if f.name not in published]

    if not candidates:
        print("✅ All articles already published — nothing to do.")
        return

    to_publish = candidates[: args.count]
    print(f"📋 Found {len(candidates)} unpublished articles. Publishing {len(to_publish)}.\n")

    if not args.dry_run:
        print("🔧 Ensuring pillar and author exist in Sanity...")
        ensure_pillar()
        ensure_author()

    newly_published = []
    for f in to_publish:
        print(f"📄 Processing: {f.name}")
        article = parse_article(f)
        if not article:
            print(f"  ⚠ Skipped.\n")
            continue

        if not args.dry_run:
            ensure_countries(article["countries"], dry_run=False)

        url = publish_article(article, dry_run=args.dry_run)

        if not args.dry_run:
            published.add(f.name)
            newly_published.append(f.name)

        print(f"  ✓ {'Would post' if args.dry_run else 'Published'}: {article['title']}")
        print(f"    → {url}\n")

    if not args.dry_run and newly_published:
        save_tracking(published)
        print(f"✅ Done. {len(newly_published)} article(s) published. Tracking file updated.")
    elif args.dry_run:
        print(f"✅ Dry run complete. {len(to_publish)} article(s) would be published.")

    remaining = len(candidates) - len(to_publish)
    if remaining > 0:
        print(f"📬 {remaining} article(s) remain in the queue for future runs.")


if __name__ == "__main__":
    main()
