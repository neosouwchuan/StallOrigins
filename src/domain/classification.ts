/**
 * Classification model (SPEC §3). Two independent axes per business.
 * Everything defaults to "unverified" — we never guess.
 */

// Independence is about STRUCTURE / SCALE only. Local-vs-foreign lives solely
// in `Origin` — never mix the two axes.
export type Independence =
  | "independent"
  | "chain"
  | "franchise"
  | "unverified";

// Axis B — ownership origin is a COUNTRY chosen from the official `countries`
// list (ISO 3166-1). 'SG' is the buy-local signal; undefined = unverified.
export interface OriginCountry {
  code: string; // ISO 3166-1 alpha-2
  name: string;
}

/** Coarse origin bucket for map filtering (specific country still shown on cards). */
export type OriginCoarse = "singaporean" | "foreign" | "unverified";

/** ISO alpha-2 code → flag emoji (regional indicator symbols). */
export function flagEmoji(code: string): string {
  if (!/^[A-Za-z]{2}$/.test(code)) return "🏳️";
  const cc = code.toUpperCase();
  return String.fromCodePoint(
    ...[...cc].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65),
  );
}

export type Category = "fnb" | "retail" | "services";

export const INDEPENDENCE_META: Record<
  Independence,
  { label: string; emoji: string; description: string }
> = {
  independent: {
    label: "Independent",
    emoji: "🧍",
    description: "Single owner-operated outlet",
  },
  chain: {
    label: "Chain",
    emoji: "🏢",
    description: "A chain — multiple outlets",
  },
  franchise: {
    label: "Franchise",
    emoji: "🔗",
    description: "Operates under a licensed brand (origin shown separately)",
  },
  unverified: {
    label: "Unverified",
    emoji: "❔",
    description: "Not yet classified",
  },
};

/** Coarse buckets used by the map filter chips. */
export const ORIGIN_COARSE_META: Record<
  OriginCoarse,
  { label: string; emoji: string }
> = {
  singaporean: { label: "Singaporean", emoji: "🇸🇬" },
  foreign: { label: "Foreign", emoji: "🌍" },
  unverified: { label: "Unverified", emoji: "❔" },
};

/** Map an origin country (or unverified) to its coarse bucket. */
export function originCoarse(origin?: OriginCountry): OriginCoarse {
  if (!origin) return "unverified";
  return origin.code === "SG" ? "singaporean" : "foreign";
}

export const CATEGORY_META: Record<
  Category,
  { label: string; emoji: string }
> = {
  fnb: { label: "Food & drink", emoji: "🍜" },
  retail: { label: "Retail", emoji: "🛍️" },
  services: { label: "Services", emoji: "✂️" },
};

export interface Business {
  id: string;
  /** The brand this outlet belongs to; classification is proposed against it. */
  brandId?: string;
  name: string;
  lat: number;
  lng: number;
  address?: string;
  /** Building/mall the outlet sits in (for group-by-building); undefined = none. */
  building?: { id: string; name: string };
  category: Category;
  subcategory?: string;
  independence: Independence;
  /** Ownership country; undefined = unverified. */
  origin?: OriginCountry;
  independenceSource?: string;
  originSource?: string;
  updatedAt?: string;
}

/** Marker colour: green = Singaporean, amber = any foreign country, grey = unverified. */
export function originColor(origin?: OriginCountry): string {
  if (!origin) return "#94a3b8"; // slate/grey (unverified)
  if (origin.code === "SG") return "#16a34a"; // green
  return "#d97706"; // amber (any foreign country)
}
