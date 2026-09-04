/**
 * Single source of truth for the app's brand/name (placeholder for now).
 *
 * To rename the app later, change the values here — they flow to the header,
 * the browser tab title, and the PWA manifest (name / short name / description
 * / theme colour). No other file hard-codes the name.
 *
 * Plain constants (no import.meta) so this file can be imported by both the
 * Vite config (build time) and the React app (runtime).
 */
export const BRAND = {
  /** Full display name. */
  name: "StallOrigins",
  /** Short name for the installed PWA icon / home screen. */
  shortName: "StallOrigins",
  /** One-line tagline shown under the title. */
  tagline: "Find & support genuinely local, independent businesses.",
  /** Longer description used in the PWA manifest and meta tags. */
  description:
    "Find and support genuinely local, independent businesses in Singapore.",
  /** Primary theme colour (also used by the PWA manifest). */
  themeColor: "#166534",
} as const;
