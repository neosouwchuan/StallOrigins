import { useState } from "react";
import { Modal } from "./Modal";
import { resolveFlag, type OpenFlag } from "../data/flags";
import type { Business } from "../domain/classification";

interface Props {
  flag: OpenFlag;
  /** The flagged outlet (for prefilling current values), if loaded. */
  business?: Business;
  onClose: () => void;
  onDone: () => void;
}

/**
 * Moderator flag resolution. The moderator can fix the outlet (name / unit /
 * address / mark closed) while resolving; the change is logged and linked to
 * the flag. Or dismiss with no change.
 */
export function ResolveFlagForm({ flag, business, onClose, onDone }: Props) {
  const [name, setName] = useState(business?.name ?? flag.businesses?.name ?? "");
  const [unit, setUnit] = useState(business?.unit ?? "");
  const [address, setAddress] = useState(business?.address ?? "");
  const [markClosed, setMarkClosed] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function run(status: "resolved" | "dismissed", withChanges: boolean) {
    setBusy(true);
    setErr(null);
    try {
      const changes: Record<string, unknown> = {};
      if (withChanges) {
        if (name.trim()) changes.name = name.trim();
        if (unit.trim()) changes.unit = unit.trim();
        changes.address = address.trim() || null;
        if (markClosed) changes.status = "hidden";
      }
      await resolveFlag(flag.id, { status, changes, note: note.trim() || undefined });
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  const inputCls = "w-full rounded border border-slate-200 px-2 py-1 text-[13px]";

  return (
    <Modal title={`Resolve: ${flag.businesses?.name ?? "flag"}`} onClose={onClose}>
      <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50/50 p-2 text-[11px] text-slate-600">
        <span className="font-medium text-amber-800">⚑ {flag.reason}</span>
        {flag.detail && <div className="mt-0.5">“{flag.detail}”</div>}
      </div>

      <form onSubmit={(e) => e.preventDefault()} className="space-y-3">
        <p className="text-[11px] text-slate-500">
          Fix the shop below and choose <b>Resolve with change</b>, or resolve /
          dismiss without editing. Changes are logged and linked to this report.
        </p>

        <label className="block">
          <span className="mb-1 block text-[11px] font-medium text-slate-600">
            Shop name
          </span>
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
        </label>

        <label className="block">
          <span className="mb-1 block text-[11px] font-medium text-slate-600">
            Floor / unit
          </span>
          <input value={unit} onChange={(e) => setUnit(e.target.value)} className={inputCls} />
        </label>

        <label className="block">
          <span className="mb-1 block text-[11px] font-medium text-slate-600">
            Address <span className="text-slate-400">(optional)</span>
          </span>
          <input value={address} onChange={(e) => setAddress(e.target.value)} className={inputCls} />
        </label>

        <label className="flex items-center gap-2 text-[12px] text-slate-700">
          <input
            type="checkbox"
            checked={markClosed}
            onChange={(e) => setMarkClosed(e.target.checked)}
          />
          Mark as closed (hide from the map)
        </label>

        <label className="block">
          <span className="mb-1 block text-[11px] font-medium text-slate-600">
            Resolution note <span className="text-slate-400">(optional)</span>
          </span>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What you did / how you verified"
            className={inputCls}
          />
        </label>

        {err && <p className="text-[11px] text-red-600">{err}</p>}

        <div className="flex flex-wrap justify-end gap-2 pt-1">
          <button
            type="button"
            disabled={busy}
            onClick={() => run("dismissed", false)}
            className="rounded px-3 py-1 text-[12px] text-slate-500 hover:bg-slate-100 disabled:opacity-50"
          >
            Dismiss
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => run("resolved", false)}
            className="rounded bg-slate-100 px-3 py-1 text-[12px] font-medium text-slate-700 disabled:opacity-50"
          >
            Resolve (no change)
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => run("resolved", true)}
            className="rounded bg-green-700 px-3 py-1 text-[12px] font-medium text-white disabled:opacity-50"
          >
            {busy ? "Saving…" : "Resolve with change"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
