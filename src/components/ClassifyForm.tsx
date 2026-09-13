import { useEffect, useMemo, useState } from "react";
import { Modal } from "./Modal";
import { submitClassification } from "../data/submissions";
import { fetchCountries, type Country } from "../data/countries";
import {
  type Business,
  type Independence,
  INDEPENDENCE_META,
  flagEmoji,
} from "../domain/classification";

const INDEP: Independence[] = ["independent", "chain_small", "chain", "franchise"];

interface Props {
  business: Business;
  userId: string;
  onClose: () => void;
  onDone: () => void;
}

/** Propose a classification for a business's brand (goes to the review queue). */
export function ClassifyForm({ business, userId, onClose, onDone }: Props) {
  const [independence, setIndependence] = useState<Independence>(
    business.independence === "unverified" ? "independent" : business.independence,
  );
  const [countries, setCountries] = useState<Country[]>([]);
  const [originCode, setOriginCode] = useState<string | null>(
    business.origin?.code ?? null,
  );
  const [query, setQuery] = useState(business.origin?.name ?? "");
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetchCountries()
      .then(setCountries)
      .catch(() => setCountries([]));
  }, []);

  // Filter the official list by the typed query; final value must be from it.
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? countries.filter(
          (c) =>
            c.name.toLowerCase().includes(q) || c.code.toLowerCase() === q,
        )
      : countries;
    return list.slice(0, 60);
  }, [query, countries]);

  function pick(c: Country) {
    setOriginCode(c.code);
    setQuery(c.name);
    setOpen(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!business.brandId) {
      setErr("This business has no brand to classify.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await submitClassification(userId, {
        brandId: business.brandId,
        independence,
        originCode,
        source: source.trim(),
      });
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  const inputCls = "w-full rounded border border-slate-200 px-2 py-1 text-[13px]";

  return (
    <Modal title={`Classify: ${business.name}`} onClose={onClose}>
      <p className="mb-3 text-[11px] text-slate-500">
        Your suggestion applies to the whole brand (every outlet) and is reviewed
        by a moderator before going live.
      </p>
      <form onSubmit={submit} className="space-y-3">
        <label className="block">
          <span className="mb-1 block text-[11px] font-medium text-slate-600">
            Independence
          </span>
          <select
            value={independence}
            onChange={(e) => setIndependence(e.target.value as Independence)}
            className={inputCls}
          >
            {INDEP.map((i) => (
              <option key={i} value={i}>
                {INDEPENDENCE_META[i].emoji} {INDEPENDENCE_META[i].label}
              </option>
            ))}
          </select>
        </label>

        {/* Searchable country picker — value must be from the official list */}
        <div className="relative">
          <span className="mb-1 block text-[11px] font-medium text-slate-600">
            Ownership country
          </span>
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOriginCode(null); // must re-pick from the list
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder="Type to search countries…"
            className={inputCls}
            autoComplete="off"
          />
          {originCode && (
            <span className="absolute right-2 top-[26px] text-[13px]">
              {flagEmoji(originCode)}
            </span>
          )}
          {open && matches.length > 0 && (
            <ul className="absolute z-10 mt-1 max-h-44 w-full overflow-auto rounded-lg border border-slate-200 bg-white text-[13px] shadow-lg">
              {matches.map((c) => (
                <li key={c.code}>
                  <button
                    type="button"
                    onClick={() => pick(c)}
                    className="flex w-full items-center gap-2 px-2 py-1 text-left hover:bg-slate-100"
                  >
                    <span>{flagEmoji(c.code)}</span>
                    <span>{c.name}</span>
                    <span className="ml-auto text-[10px] text-slate-400">
                      {c.code}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {countries.length === 0 && (
            <p className="mt-1 text-[10px] text-amber-700">
              Country list unavailable — apply migration 08 to enable it.
            </p>
          )}
          <p className="mt-1 text-[10px] text-slate-400">
            Leave blank to propose only the independence.
          </p>
        </div>

        <label className="block">
          <span className="mb-1 block text-[11px] font-medium text-slate-600">
            Source (required)
          </span>
          <input
            required
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder="URL, ACRA no., or how you know"
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
            className="rounded bg-green-700 px-3 py-1 text-[12px] font-medium text-white disabled:opacity-50"
          >
            {busy ? "Submitting…" : "Submit"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
