import { useEffect, useState } from "react";
import { Modal } from "./Modal";
import {
  fetchPendingSubmissions,
  approveSubmission,
  rejectSubmission,
  type PendingSubmission,
} from "../data/submissions";

interface Props {
  onClose: () => void;
  onApplied: () => void; // refetch the map after an approval
}

/** Moderator queue: review pending submissions, approve (apply) or reject. */
export function ModerationPanel({ onClose, onApplied }: Props) {
  const [items, setItems] = useState<PendingSubmission[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    try {
      setItems(await fetchPendingSubmissions());
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }
  useEffect(() => {
    void load();
  }, []);

  async function act(id: string, fn: () => Promise<void>) {
    setBusyId(id);
    setErr(null);
    try {
      await fn();
      await load();
      onApplied();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  }

  function summarize(s: PendingSubmission): string {
    const p = s.payload;
    const parts: string[] = [];
    if (p.independence) parts.push(`independence → ${p.independence}`);
    if (p.origin_country) parts.push(`origin → ${p.origin_country}`);
    return parts.join(", ") || s.kind;
  }

  return (
    <Modal title="Moderation queue" onClose={onClose}>
      {err && <p className="mb-2 text-[11px] text-red-600">{err}</p>}
      {!items ? (
        <p className="text-[11px] text-slate-400">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-[11px] text-slate-400">No pending submissions. 🎉</p>
      ) : (
        <ul className="max-h-[60vh] space-y-2 overflow-auto">
          {items.map((s) => (
            <li
              key={s.id}
              className="rounded-lg border border-slate-200 p-2 text-[12px]"
            >
              <div className="font-medium text-slate-800">
                {s.brands?.name ?? (s.business_id ? "(outlet edit)" : "(new)")}
              </div>
              <div className="text-[11px] text-slate-600">{summarize(s)}</div>
              <div className="text-[10px] text-slate-400">source: {s.source}</div>
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
    </Modal>
  );
}
