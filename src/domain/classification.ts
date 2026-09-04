/**
 * Classification model (SPEC §3). Two independent axes per business.
 * Everything defaults to "unverified" — we never guess.
 */

// Independence is about STRUCTURE / SCALE only. Local-vs-foreign lives solely
// in `Origin` — never mix the two axes.
export type Independence =
  | "independent"
  | "chain_small"
  | "chain"
  | "franchise"
  | "unverified";

export type Origin = "local" | "foreign" | "unverified";

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
  chain_small: {
    label: "Small chain",
    emoji: "🏘️",
    description: "2–5 outlets",
  },
  chain: {
    label: "Chain",
    emoji: "🏢",
    description: "Large chain (>5 outlets)",
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

export const ORIGIN_META: Record<
  Origin,
  { label: string; emoji: string; description: string }
> = {
  local: {
    label: "Local",
    emoji: "🇸🇬",
    description: "Majority Singaporean beneficial ownership",
  },
  foreign: {
    label: "Foreign",
    emoji: "🌍",
    description: "Majority foreign ownership / overseas parent",
  },
  unverified: {
    label: "Unverified",
    emoji: "❔",
    description: "Not yet classified",
  },
};

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
  name: string;
  lat: number;
  lng: number;
  address?: string;
  category: Category;
  subcategory?: string;
  independence: Independence;
  origin: Origin;
  independenceSource?: string;
  originSource?: string;
  updatedAt?: string;
}

/** Marker colour is driven by ownership origin (SPEC §7). */
export function originColor(origin: Origin): string {
  switch (origin) {
    case "local":
      return "#16a34a"; // green
    case "foreign":
      return "#d97706"; // amber
    case "unverified":
    default:
      return "#94a3b8"; // slate/grey
  }
}
