import { useEffect, useMemo, useState } from "react";
import type { AuthState } from "../lib/useSession";
import {
  fetchPendingSubmissions,
  approveSubmission,
  rejectSubmission,
  fetchRecentChanges,
  type PendingSubmission,
  type ChangeRow,
} from "../data/submissions";
import { fetchBrands, type Brand } from "../data/brands";
import { type Business, INDEPENDENCE_META, flagEmoji } from "../domain/classification";

interface Props {
  auth: AuthState;
  open: boolean;
  onClose: () => void;
  onApplied: () => void; // refetch the map after an approval
  businesses: Business[]; // full (unfiltered) list, for outlet counts
}

type Tab = "unresolved" | "brands" | "changes";
const TABS: { id: Tab; label: string }[] = [
  { id: "unresolved", label: "Unresolved" },
  { id: "brands", label: "All Brands" },
  { id: "changes", label: "Recent" },
];

/**
 * The menu side-panel. Every user gets the same three-tab layout — Unresolved,
 * All Brands, Recent changes. All Brands and Recent are world-readable; the
 * Unresolved queue and its approve/reject actions are moderators-only (RLS).
 */
export function Sidebar({ auth, open, onClose, onApplied, businesses }: Props) {
  const isMod = auth.isModerator;

  const [tab, setTab] = useState<Tab>("brands");
  const [pending, setPending] = useState<PendingSubmission[] | null>(null);
  const [changes, setChanges] = useState<ChangeRow[] | null>(null);
  const [brands, setBrands] = useState<Brand[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  // Outlet count per brand, derived from the loaded businesses.
  const outletCount = useMemo(() => {
    const m = new Map<string, number>();
    for (const b of businesses)
      if (b.brandId) m.set(b.brandId, (m.get(b.brandId) ?? 0) + 1);
    return m;
  }, [businesses]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = brands ?? [];
    if (!q) return list;
    return list.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        b.origin?.name.toLowerCase().includes(q),
    );
  }, [brands, query]);

  useEffect(() => {
    if (!open) return;
    setErr(null);
    // Brands + recent changes are world-readable; the queue needs moderator RLS.
    fetchBrands().then(setBrands).catch(showErr);
    fetchRecentChanges().then(setChanges).catch(showErr);
    if (isMod) fetchPendingSubmissions().then(setPending).catch(showErr);
    function showErr(e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }, [open, isMod]);

  async function act(id: string, fn: () => Promise<void>) {
    setBusyId(id);
    setErr(null);
    try {
      await fn();
      setPending(await fetchPendingSubmissions());
      setChanges(await fetchRecentChanges());
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
        <div className="fixed inset-0 z-[1550] bg-black/20" onClick={onClose} />
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

        {/* Panel switcher */}
        <nav className="flex gap-1 border-b border-slate-100 p-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={
                "flex-1 rounded px-2 py-1 text-[11px] font-medium transition " +
                (tab === t.id
                  ? "bg-green-700 text-white"
                  : "bg-slate-100 text-slate-500 hover:bg-slate-200")
              }
            >
              {t.id === "unresolved"
                ? `${t.label}${isMod && pending ? ` (${pending.length})` : ""}`
                : t.id === "brands"
                  ? `${t.label}${brands ? ` (${brands.length})` : ""}`
                  : t.label}
            </button>
          ))}
        </nav>

        <div className="flex-1 overflow-auto p-3">
          {err && <p className="mb-2 text-[11px] text-red-600">{err}</p>}

          {tab === "unresolved" && (
            <UnresolvedPanel
              isMod={isMod}
              pending={pending}
              busyId={busyId}
              onApprove={(id) => act(id, () => approveSubmission(id))}
              onReject={(id) => act(id, () => rejectSubmission(id))}
            />
          )}

          {tab === "brands" && (
            <div className="space-y-1.5">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name or country…"
                className="w-full rounded border border-slate-200 px-2 py-1 text-[12px] outline-none focus:border-slate-400"
              />
              {!brands ? (
                <p className="text-[11px] text-slate-400">Loading…</p>
              ) : matches.length === 0 ? (
                <p className="text-[11px] text-slate-400">No matches.</p>
              ) : (
                <ul className="space-y-1">
                  {matches.map((b) => {
                    const n = outletCount.get(b.id) ?? 0;
                    return (
                      <li
                        key={b.id}
                        className="rounded border border-slate-100 p-1.5 text-[12px]"
                      >
                        <div className="flex items-center gap-1">
                          <span>{b.origin ? flagEmoji(b.origin.code) : "❔"}</span>
                          <span className="truncate font-medium text-slate-800">
                            {b.name}
                          </span>
                          <span className="ml-auto shrink-0 text-[10px] text-slate-400">
                            {n} outlet{n === 1 ? "" : "s"}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {INDEPENDENCE_META[b.independence].label}
                          {" · "}
                          {b.origin?.name ?? "Unverified"}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}

          {tab === "changes" && (
            <>
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
            </>
          )}
        </div>
      </aside>
    </>
  );
}

function UnresolvedPanel({
  isMod,
  pending,
  busyId,
  onApprove,
  onReject,
}: {
  isMod: boolean;
  pending: PendingSubmission[] | null;
  busyId: string | null;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}) {
  if (!isMod)
    return (
      <p className="text-[12px] leading-relaxed text-slate-500">
        The moderation queue is available to moderators. Use “Suggest
        classification” or “Propose a shop” to contribute — your submissions
        appear here for a moderator to review.
      </p>
    );
  if (!pending) return <p className="text-[11px] text-slate-400">Loading…</p>;
  if (pending.length === 0)
    return <p className="text-[11px] text-slate-400">All clear. 🎉</p>;

  return (
    <ul className="space-y-2">
      {pending.map((s) => (
        <li
          key={s.id}
          className="rounded-lg border border-slate-200 p-2 text-[12px]"
        >
          <div className="font-medium text-slate-800">{title(s)}</div>
          <div className="text-[11px] text-slate-600">{summarize(s)}</div>
          <div className="text-[10px] text-slate-400">source: {s.source}</div>
          <div className="mt-1.5 flex gap-2">
            <button
              disabled={busyId === s.id}
              onClick={() => onApprove(s.id)}
              className="rounded bg-green-700 px-2 py-0.5 text-[11px] text-white disabled:opacity-50"
            >
              Approve
            </button>
            <button
              disabled={busyId === s.id}
              onClick={() => onReject(s.id)}
              className="rounded bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600 disabled:opacity-50"
            >
              Reject
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}

function title(s: PendingSubmission): string {
  if (s.kind === "new") {
    const p = s.payload as { name?: string; brand_name?: string };
    return `🆕 ${p.name ?? p.brand_name ?? "New shop"}`;
  }
  return s.brands?.name ?? (s.business_id ? "(outlet edit)" : "(edit)");
}

function summarize(s: PendingSubmission): string {
  const p = s.payload as Record<string, unknown>;
  if (s.kind === "new") {
    const brand = (p.brand_name as string) ?? "—";
    return `new shop · brand: ${brand}`;
  }
  const parts: string[] = [];
  if (p.independence) parts.push(`independence → ${p.independence}`);
  if (p.origin_country) parts.push(`origin → ${p.origin_country}`);
  return parts.join(", ") || s.kind;
}
