import { supabase } from "../lib/supabase";

/** Common report reasons; `detail` carries anything free-form. */
export const FLAG_REASONS = [
  "Closed / no longer here",
  "Wrong location",
  "Wrong classification",
  "Duplicate listing",
  "Wrong name or details",
  "Other",
] as const;
export type FlagReason = (typeof FLAG_REASONS)[number];

export interface FlagInput {
  businessId: string;
  reason: FlagReason;
  detail: string;
}

/** Report a problem with an outlet — inserts an `open` flag (moderator-reviewed). */
export async function submitFlag(userId: string, input: FlagInput): Promise<void> {
  if (!supabase) throw new Error("Supabase not configured");
  const { error } = await supabase.from("flags").insert({
    business_id: input.businessId,
    reason: input.reason,
    detail: input.detail.trim() || null,
    reported_by: userId,
  });
  if (error) throw new Error(error.message);
}

export interface OpenFlag {
  id: string;
  business_id: string;
  reason: string;
  detail: string | null;
  created_at: string;
  businesses: { name: string | null } | null;
}

/** Open flags for the moderation queue (moderators see all, via RLS). */
export async function fetchOpenFlags(): Promise<OpenFlag[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("flags")
    .select("id,business_id,reason,detail,created_at,businesses(name)")
    .eq("status", "open")
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data as unknown as OpenFlag[]) ?? [];
}

/** Resolve or dismiss a flag (moderator only, via RLS). */
export async function resolveFlag(
  userId: string,
  id: string,
  status: "resolved" | "dismissed",
): Promise<void> {
  if (!supabase) throw new Error("Supabase not configured");
  const { error } = await supabase
    .from("flags")
    .update({ status, resolved_by: userId, resolved_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}
