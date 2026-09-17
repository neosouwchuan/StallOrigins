import { useState } from "react";
import { Modal } from "./Modal";
import { submitFlag, FLAG_REASONS, type FlagReason } from "../data/flags";
import type { Business } from "../domain/classification";

interface Props {
  business: Business;
  userId: string;
  onClose: () => void;
  onDone: () => void;
}

/** Report a problem with an outlet (goes to the moderator flag queue). */
export function FlagForm({ business, userId, onClose, onDone }: Props) {
  const [reason, setReason] = useState<FlagReason>(FLAG_REASONS[0]);
  const [detail, setDetail] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await submitFlag(userId, { businessId: business.id, reason, detail });
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  const inputCls = "w-full rounded border border-slate-200 px-2 py-1 text-[13px]";

  return (
    <Modal title={`Report: ${business.name}`} onClose={onClose}>
      <p className="mb-3 text-[11px] text-slate-500">
        Tell us what’s wrong. A moderator reviews reports before anything
        changes.
      </p>
      <form onSubmit={submit} className="space-y-3">
        <label className="block">
          <span className="mb-1 block text-[11px] font-medium text-slate-600">
            What’s the problem?
          </span>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value as FlagReason)}
            className={inputCls}
          >
            {FLAG_REASONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-[11px] font-medium text-slate-600">
            Details <span className="text-slate-400">(optional)</span>
          </span>
          <textarea
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            rows={3}
            placeholder="Anything that helps a moderator verify"
            className={inputCls}
          />
        </label>

        {err && <p className="text-[11px] text-red-600">{err}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="rounded px-3 py-1 text-[12px] text-slate-500 hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            disabled={busy}
            className="rounded bg-amber-600 px-3 py-1 text-[12px] font-medium text-white disabled:opacity-50"
          >
            {busy ? "Submitting…" : "Report"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
