import { useEffect, useState } from "react";
import type { AuthState } from "../lib/useSession";
import {
  fetchPendingSubmissions,
  approveSubmission,
  rejectSubmission,
  fetchRecentChanges,
  type PendingSubmission,
  type ChangeRow,
} from "../data/submissions";

interface Props {
  auth: AuthState;
  open: boolean;
  onClose: () => void;
  onApplied: () => void; // refetch the map after an approval
}

/**
 * Role-based sidebar (SPEC §6). Everyone gets one:
 * - contributor / signed-out: informational, no actions;
 * - moderator: the unresolved moderation queue (approve / reject);
 * - admin: the queue plus a recent-changes (edit_history) feed.
 */
export function Sidebar({ auth, open, onClose, onApplied }: Props) {
  const role = auth.profile?.role;
  const isMod = auth.isModerator;
  const isAdmin = role === "admin";

  const [pending, setPending] = useState<PendingSubmission[] | null>(null);
  const [changes, setChanges] = useState<ChangeRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setErr(null);
    if (isMod) fetchPendingSubmissions().then(setPending).catch(showErr);
    if (isAdmin) fetchRecentChanges().then(setChanges).catch(showErr);
    function showErr(e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }, [open, isMod, isAdmin]);

  async function act(id: string, fn: () => Promise<void>) {
    setBusyId(id);
    setErr(null);
    try {
      await fn();
      setPending(await fetchPendingSubmissions());
      if (isAdmin) setChanges(await fetchRecentChanges());
      onApplied();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-[1550] bg-black/20"
          onClick={onClose}
        />
      )}
      <aside
        className={
          "fixed right-0 top-0 z-[1600] flex h-dvh w-72 flex-col bg-white shadow-xl transition-transform " +
          (open ? "translate-x-0" : "translate-x-full")
        }
      >
        <header className="flex items-center justify-between border-b border-slate-100 p-3">
          <span className="text-sm font-semibold text-slate-800">Menu</span>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-slate-400 hover:text-slate-600"
          >
            ✕
          </button>
        </header>

        <div className="flex-1 space-y-4 overflow-auto p-3">
          {err && <p className="text-[11px] text-red-600">{err}</p>}

          {/* Contributor / signed-out: nothing to manage */}
          {!isMod && (
            <p className="text-[12px] leading-relaxed text-slate-500">
              {auth.session
                ? "You’re signed in. Use “Suggest classification” on any stall to contribute — there’s nothing to manage here."
                : "Sign in to suggest classifications for local businesses."}
            </p>
          )}

          {/* Moderator + admin: the unresolved queue */}
          {isMod && (
            <section>
              <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Unresolved ({pending?.length ?? "…"})
              </h3>
              {!pending ? (
                <p className="text-[11px] text-slate-400">Loading…</p>
              ) : pending.length === 0 ? (
                <p className="text-[11px] text-slate-400">All clear. 🎉</p>
              ) : (
                <ul className="space-y-2">
                  {pending.map((s) => (
                    <li
                      key={s.id}
                      className="rounded-lg border border-slate-200 p-2 text-[12px]"
                    >
                      <div className="font-medium text-slate-800">
                        {s.brands?.name ??
                          (s.business_id ? "(outlet edit)" : "(new)")}
                      </div>
                      <div className="text-[11px] text-slate-600">
                        {summarize(s)}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        source: {s.source}
                      </div>
                      <div className="mt-1.5 flex gap-2">
                        <button
                          disabled={busyId === s.id}
                          onClick={() => act(s.id, () => approveSubmission(s.id))}
                          className="rounded bg-green-700 px-2 py-0.5 text-[11px] text-white disabled:opacity-50"
                        >
                          Approve
                        </button>
                        <button
                          disabled={busyId === s.id}
                          onClick={() => act(s.id, () => rejectSubmission(s.id))}
                          className="rounded bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600 disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {/* Admin only: recent changes */}
          {isAdmin && (
            <section>
              <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Recent changes
              </h3>
              {!changes ? (
                <p className="text-[11px] text-slate-400">Loading…</p>
              ) : changes.length === 0 ? (
                <p className="text-[11px] text-slate-400">No changes yet.</p>
              ) : (
                <ul className="space-y-1.5">
                  {changes.map((c) => (
                    <li key={c.id} className="text-[11px] text-slate-600">
                      <span className="font-medium text-slate-800">
                        {c.brands?.name ?? "—"}
                      </span>{" "}
                      {c.field === "*"
                        ? "created"
                        : `${c.field}: ${c.old_value ?? "∅"} → ${c.new_value ?? "∅"}`}
                      <span className="ml-1 text-[10px] text-slate-400">
                        {c.changed_at.slice(0, 10)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>
      </aside>
    </>
  );
}

function summarize(s: PendingSubmission): string {
  const p = s.payload;
  const parts: string[] = [];
  if (p.independence) parts.push(`independence → ${p.independence}`);
  if (p.origin_country) parts.push(`origin → ${p.origin_country}`);
  return parts.join(", ") || s.kind;
}
