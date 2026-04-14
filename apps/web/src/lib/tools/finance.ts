const COINGECKO_BASE = "https://api.coingecko.com/api/v3";

export interface MarketAsset {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  price_change_percentage_24h: number | null;
  price_change_percentage_7d_in_currency: number | null;
  price_change_percentage_30d_in_currency: number | null;
  price_change_percentage_1y_in_currency: number | null;
  market_cap: number;
  total_volume: number;
  sparkline_in_7d: { price: number[] } | null;
  image: string;
}

/** Assets we always show in the highlights section */
export const HIGHLIGHT_IDS = ["bitcoin", "ethereum", "pax-gold"];

/** Extended list for the market table */
export const MARKET_IDS = [
  "bitcoin",
  "ethereum",
  "pax-gold",
  "tether",
  "solana",
  "ripple",
  "cardano",
  "dogecoin",
  "polkadot",
  "chainlink",
  "litecoin",
  "avalanche-2",
  "uniswap",
  "stellar",
  "monero",
];

export async function fetchMarketData(
  ids: string[] = MARKET_IDS
): Promise<MarketAsset[]> {
  const res = await fetch(
    `${COINGECKO_BASE}/coins/markets?vs_currency=usd&ids=${ids.join(",")}&order=market_cap_desc&sparkline=true&price_change_percentage=7d,30d,1y`
  );
  if (!res.ok) throw new Error("Failed to fetch market data");
  return res.json();
}

export function formatPrice(price: number): string {
  if (price >= 10000)
    return price.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (price >= 1)
    return price.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  if (price >= 0.01)
    return price.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    });
  return price.toLocaleString("en-US", {
    minimumFractionDigits: 4,
    maximumFractionDigits: 6,
  });
}

export function formatChange(pct: number | null): {
  text: string;
  positive: boolean;
} {
  if (pct == null) return { text: "-", positive: true };
  const positive = pct >= 0;
  return {
    text: `${positive ? "+" : ""}${pct.toFixed(2)}%`,
    positive,
  };
}

export function formatMarketCap(n: number): string {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  return `$${n.toLocaleString()}`;
}

/** Friendly display name overrides */
export const ASSET_LABELS: Record<string, string> = {
  "pax-gold": "Gold (PAXG)",
  "avalanche-2": "Avalanche",
};

export function getAssetLabel(asset: MarketAsset): string {
  return ASSET_LABELS[asset.id] || asset.name;
}
