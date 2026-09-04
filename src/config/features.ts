/**
 * Feature flags. Single place to turn behaviours on/off.
 *
 * `allowAnonymousFlagging`: when true, logged-out users may report an error on a
 * business (flags.reported_by stays null). Enabled for now to lower the barrier
 * to reporting; can be flipped off if abuse becomes a problem.
 *
 * NOTE (Phase 2): the client flag drives the UI, but disabling it must ALSO be
 * enforced server-side — the RLS policy that permits anonymous INSERTs on the
 * `flags` table is conditioned on this feature. A client flag alone is not a
 * security boundary. When we want to toggle it at runtime (no redeploy), move
 * this into an `app_settings` table read by both the app and the RLS policy.
 */
export const FEATURES = {
  allowAnonymousFlagging: true,
} as const;
