// ─────────────────────────────────────────────────────────────────────────────
// Market data fetcher — Polygon.io
// Add POLYGON_API_KEY to your .env.local and Vercel env vars
// ─────────────────────────────────────────────────────────────────────────────

const API_KEY = process.env.POLYGON_API_KEY;
const BASE = "https://api.polygon.io";

export interface MarketQuote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePct: number;
  economyId: string;
  type: "index" | "forex" | "commodity" | "crypto";
}

// ── Instrument definitions ────────────────────────────────────────────────────

export const INDICES: { symbol: string; name: string; economyId: string }[] = [
  { symbol: "SPY",      name: "S&P 500 (USA)",        economyId: "united-states" },
  { symbol: "XIU",      name: "TSX 60 (Canada)",       economyId: "canada" },
  { symbol: "EWW",      name: "Mexico ETF",            economyId: "mexico" },
  { symbol: "DAX",      name: "DAX (Germany)",         economyId: "germany" },
  { symbol: "ISF",      name: "FTSE 100 (UK)",         economyId: "united-kingdom" },
  { symbol: "EWQ",      name: "CAC 40 (France)",       economyId: "france" },
  { symbol: "FTSEMIB",  name: "FTSE MIB (Italy)",      economyId: "italy" },
  { symbol: "EWP",      name: "IBEX 35 (Spain)",       economyId: "spain" },
  { symbol: "AEX",      name: "AEX (Netherlands)",     economyId: "netherlands" },
  { symbol: "SMI",      name: "SMI (Switzerland)",     economyId: "switzerland" },
  { symbol: "OMXS30",   name: "OMX30 (Sweden)",        economyId: "sweden" },
  { symbol: "EWA",      name: "ASX (Australia)",       economyId: "australia" },
  { symbol: "EWY",      name: "KOSPI (South Korea)",   economyId: "south-korea" },
  { symbol: "EWZ",      name: "Bovespa (Brazil)",      economyId: "brazil" },
  { symbol: "INDA",     name: "Nifty 50 (India)",      economyId: "india" },
  { symbol: "FXI",      name: "CSI 300 (China)",       economyId: "china" },
  { symbol: "EWJ",      name: "Nikkei (Japan)",        economyId: "japan" },
];

export const FOREX_PAIRS: { symbol: string; name: string; economyId: string }[] = [
  { symbol: "C:CADUSD", name: "CAD/USD", economyId: "canada" },
  { symbol: "C:MXNUSD", name: "MXN/USD", economyId: "mexico" },
  { symbol: "C:EURUSD", name: "EUR/USD", economyId: "germany" },
  { symbol: "C:GBPUSD", name: "GBP/USD", economyId: "united-kingdom" },
  { symbol: "C:JPYUSD", name: "JPY/USD", economyId: "japan" },
  { symbol: "C:CNYUSD", name: "CNY/USD", economyId: "china" },
  { symbol: "C:INRUSD", name: "INR/USD", economyId: "india" },
  { symbol: "C:KRWUSD", name: "KRW/USD", economyId: "south-korea" },
  { symbol: "C:AUDUSD", name: "AUD/USD", economyId: "australia" },
  { symbol: "C:BRLUSD", name: "BRL/USD", economyId: "brazil" },
  { symbol: "C:SARUSD", name: "SAR/USD", economyId: "saudi-arabia" },
  { symbol: "C:AEDUSD", name: "AED/USD", economyId: "uae" },
  { symbol: "C:TRYUSD", name: "TRY/USD", economyId: "turkey" },
  { symbol: "C:ZARUSD", name: "ZAR/USD", economyId: "south-africa" },
  { symbol: "C:NGNUSD", name: "NGN/USD", economyId: "nigeria" },
  { symbol: "C:EGPUSD", name: "EGP/USD", economyId: "egypt" },
  { symbol: "C:ARSUSD", name: "ARS/USD", economyId: "argentina" },
  { symbol: "C:COPUSD", name: "COP/USD", economyId: "colombia" },
  { symbol: "C:IDRUSD", name: "IDR/USD", economyId: "indonesia" },
  { symbol: "C:THBUSD", name: "THB/USD", economyId: "thailand" },
  { symbol: "C:TWDUSD", name: "TWD/USD", economyId: "taiwan" },
  { symbol: "C:MYRUSD", name: "MYR/USD", economyId: "malaysia" },
];

export const MACROS: { symbol: string; name: string; economyId: string; type: "commodity" | "crypto" }[] = [
  { symbol: "C:XAUUSD",  name: "Gold (USD/oz)",     economyId: "global", type: "commodity" },
  { symbol: "C:WTIUSD",  name: "WTI Oil (USD/bbl)", economyId: "global", type: "commodity" },
  { symbol: "X:BTCUSD",  name: "Bitcoin (USD)",     economyId: "global", type: "crypto" },
];

// ── Fetch helpers ─────────────────────────────────────────────────────────────

async function fetchPrevClose(ticker: string): Promise<{ price: number; changePct: number; change: number } | null> {
  if (!API_KEY) return null;
  try {
    const res = await fetch(
      `${BASE}/v2/aggs/ticker/${ticker}/prev?adjusted=true&apiKey=${API_KEY}`,
      { next: { revalidate: 300 } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const bar = data?.results?.[0];
    if (!bar) return null;
    const change = bar.c - bar.o;
    const changePct = (change / bar.o) * 100;
    return { price: bar.c, change, changePct };
  } catch {
    return null;
  }
}

async function fetchForexQuote(pair: string): Promise<{ price: number; changePct: number; change: number } | null> {
  if (!API_KEY) return null;
  try {
    // pair format: C:EURUSD — use snapshot
    const ticker = pair.replace("C:", "");
    const res = await fetch(
      `${BASE}/v2/snapshot/locale/global/markets/forex/tickers/C:${ticker}?apiKey=${API_KEY}`,
      { next: { revalidate: 300 } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const snap = data?.ticker;
    if (!snap) return null;
    const price = snap.day?.c ?? snap.lastQuote?.a ?? 0;
    const prevClose = snap.prevDay?.c ?? price;
    const change = price - prevClose;
    const changePct = prevClose ? (change / prevClose) * 100 : 0;
    return { price, change, changePct };
  } catch {
    return null;
  }
}

// ── Main fetcher ──────────────────────────────────────────────────────────────

export async function fetchAllMarketData(): Promise<MarketQuote[]> {
  const results: MarketQuote[] = [];

  // Indices (equities)
  await Promise.all(
    INDICES.map(async ({ symbol, name, economyId }) => {
      const q = await fetchPrevClose(symbol);
      if (q) {
        results.push({ symbol, name, economyId, type: "index", ...q });
      }
    })
  );

  // Forex pairs
  await Promise.all(
    FOREX_PAIRS.map(async ({ symbol, name, economyId }) => {
      const q = await fetchForexQuote(symbol);
      if (q) {
        results.push({ symbol, name, economyId, type: "forex", ...q });
      }
    })
  );

  // Macros (gold, oil, BTC)
  await Promise.all(
    MACROS.map(async ({ symbol, name, economyId, type }) => {
      const q = type === "crypto"
        ? await fetchPrevClose(symbol)
        : await fetchForexQuote(symbol);
      if (q) {
        results.push({ symbol, name, economyId, type, ...q });
      }
    })
  );

  return results;
}

// ── Fallback mock data (used when no API key or outside market hours) ─────────

export const MOCK_MARKET_DATA: MarketQuote[] = [
  { symbol: "SPY",      name: "S&P 500",    economyId: "united-states",  type: "index",     price: 521.82, change: 4.51,   changePct: 0.87 },
  { symbol: "DAX",      name: "DAX",        economyId: "germany",        type: "index",     price: 18492.35, change: 57.21, changePct: 0.31 },
  { symbol: "ISF",      name: "FTSE 100",   economyId: "united-kingdom", type: "index",     price: 8112.60, change: -11.38, changePct: -0.14 },
  { symbol: "EWJ",      name: "Nikkei",     economyId: "japan",          type: "index",     price: 39872.11, change: 484.65, changePct: 1.22 },
  { symbol: "FXI",      name: "Hang Seng",  economyId: "china",          type: "index",     price: 17284.54, change: -153.10, changePct: -0.88 },
  { symbol: "EWZ",      name: "Bovespa",    economyId: "brazil",         type: "index",     price: 128543.00, change: 539.88, changePct: 0.42 },
  { symbol: "C:EURUSD", name: "EUR/USD",    economyId: "germany",        type: "forex",     price: 1.0812, change: -0.0023, changePct: -0.21 },
  { symbol: "C:GBPUSD", name: "GBP/USD",    economyId: "united-kingdom", type: "forex",     price: 1.2645, change: 0.0031,  changePct: 0.25 },
  { symbol: "C:JPYUSD", name: "JPY/USD",    economyId: "japan",          type: "forex",     price: 0.00669, change: -0.00002, changePct: -0.30 },
  { symbol: "C:XAUUSD", name: "Gold",       economyId: "global",         type: "commodity", price: 2318.40, change: 12.50,  changePct: 0.54 },
  { symbol: "C:WTIUSD", name: "WTI Oil",    economyId: "global",         type: "commodity", price: 82.14,  change: -0.63,  changePct: -0.76 },
  { symbol: "X:BTCUSD", name: "Bitcoin",    economyId: "global",         type: "crypto",    price: 68420.00, change: 1240.00, changePct: 1.85 },
];
