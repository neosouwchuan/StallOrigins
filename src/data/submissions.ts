import { supabase } from "../lib/supabase";
import type { Category, Independence } from "../domain/classification";

export interface ClassifyInput {
  brandId: string;
  independence: Independence;
  /** ISO country code, or null to leave origin unset. */
  originCode: string | null;
  source: string;
}

/**
 * Propose a classification for a brand — inserts a pending `submissions` row.
 * A moderator later approves it (apply_submission), which updates the brand and
 * therefore every outlet of it. Sources accompany each proposed value.
 */
export async function submitClassification(
  userId: string,
  input: ClassifyInput,
): Promise<void> {
  if (!supabase) throw new Error("Supabase not configured");
  const payload: Record<string, string> = { independence: input.independence };
  if (input.independence !== "unverified")
    payload.independence_source = input.source;
  if (input.originCode) {
    payload.origin_country = input.originCode;
    payload.origin_source = input.source;
  }

  const { error } = await supabase.from("submissions").insert({
    brand_id: input.brandId,
    kind: "edit",
    payload,
    source: input.source,
    submitted_by: userId,
  });
  if (error) throw new Error(error.message);
}

export interface NewShopInput {
  /** Outlet (shop) name. */
  name: string;
  /** Existing brand's exact name to attach to, or a new brand name to create. */
  brandName: string;
  /** Category for the brand — only used when a new brand is created. */
  category: Category;
  lat: number;
  lng: number;
  address?: string;
  /** Floor + shop number, free string (e.g. "#01-23"); defaults to ground floor. */
  unit?: string;
  source: string;
}

/**
 * Propose a NEW shop — inserts a pending `submissions` row (kind 'new').
 * On approval, apply_submission() resolves the brand by name (creating it if it
 * doesn't exist) and creates the outlet. Classification stays unverified until
 * someone proposes it via the classify flow.
 */
export async function submitNewShop(
  userId: string,
  input: NewShopInput,
): Promise<void> {
  if (!supabase) throw new Error("Supabase not configured");
  const payload: Record<string, unknown> = {
    name: input.name,
    brand_name: input.brandName,
    category: input.category,
    lat: input.lat,
    lng: input.lng,
    unit: input.unit?.trim() || "Ground floor",
    data_source: "community",
  };
  if (input.address?.trim()) payload.address = input.address.trim();

  const { error } = await supabase.from("submissions").insert({
    kind: "new",
    payload,
    source: input.source,
    submitted_by: userId,
  });
  if (error) throw new Error(error.message);
}

export interface PendingSubmission {
  id: string;
  brand_id: string | null;
  business_id: string | null;
  kind: string;
  payload: Record<string, unknown>;
  source: string;
  note: string | null;
  created_at: string;
  brands: { name: string } | null;
}

/** Pending submissions for the moderation queue (moderators only, via RLS). */
export async function fetchPendingSubmissions(): Promise<PendingSubmission[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("submissions")
    .select(
      "id,brand_id,business_id,kind,payload,source,note,created_at,brands(name)",
    )
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data as unknown as PendingSubmission[]) ?? [];
}

/** Approve a submission → apply_submission() (moderator only). */
export async function approveSubmission(id: string): Promise<void> {
  if (!supabase) throw new Error("Supabase not configured");
  const { error } = await supabase.rpc("apply_submission", {
    p_submission_id: id,
  });
  if (error) throw new Error(error.message);
}

/** Reject a submission with an optional note (moderator only). */
export async function rejectSubmission(id: string, note?: string): Promise<void> {
  if (!supabase) throw new Error("Supabase not configured");
  const { error } = await supabase.rpc("reject_submission", {
    p_submission_id: id,
    p_note: note ?? null,
  });
  if (error) throw new Error(error.message);
}

export interface ChangeRow {
  id: number;
  field: string;
  old_value: string | null;
  new_value: string | null;
  changed_at: string;
  brands: { name: string } | null;
}

/** Recent approved changes from the audit log (edit_history is world-readable). */
export async function fetchRecentChanges(limit = 30): Promise<ChangeRow[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("edit_history")
    .select("id,field,old_value,new_value,changed_at,brands(name)")
    .order("changed_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data as unknown as ChangeRow[]) ?? [];
}
