import { useEffect, useMemo, useState } from "react";
import { Modal } from "./Modal";
import { submitNewShop } from "../data/submissions";
import { fetchBrands, type Brand } from "../data/brands";
import {
  type Category,
  CATEGORY_META,
  INDEPENDENCE_META,
  flagEmoji,
} from "../domain/classification";

const CATEGORIES: Category[] = ["fnb", "retail", "services"];

interface Props {
  userId: string;
  pin: { lat: number; lng: number };
  onBack: () => void; // return to the map to reposition the pin
  onClose: () => void;
  onDone: () => void;
}

/**
 * Propose a new shop at the chosen pin. The proposer names the shop, then either
 * attaches it to an existing brand (type-to-search) or creates a new brand.
 * Goes to the moderation queue as a `new` submission.
 */
export function ProposeForm({ userId, pin, onBack, onClose, onDone }: Props) {
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("Ground floor");
  const [address, setAddress] = useState("");
  const [source, setSource] = useState("");

  const [brands, setBrands] = useState<Brand[]>([]);
  const [brandQuery, setBrandQuery] = useState("");
  const [picked, setPicked] = useState<Brand | null>(null);
  const [open, setOpen] = useState(false);
  // Only used when creating a new brand:
  const [newCategory, setNewCategory] = useState<Category>("fnb");

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetchBrands()
      .then(setBrands)
      .catch(() => setBrands([]));
  }, []);

  const q = brandQuery.trim();
  const matches = useMemo(() => {
    const needle = q.toLowerCase();
    if (!needle) return [];
    return brands.filter((b) => b.name.toLowerCase().includes(needle)).slice(0, 40);
  }, [brands, q]);

  // Exact (case-insensitive) name match means "existing brand", so we don't
  // offer to create a duplicate.
  const exact = useMemo(
    () => brands.find((b) => b.name.toLowerCase() === q.toLowerCase()) ?? null,
    [brands, q],
  );
  const creatingNew = !picked && q.length > 0 && !exact;

  function pickBrand(b: Brand) {
    setPicked(b);
    setBrandQuery(b.name);
    setOpen(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const brandName = picked?.name ?? q;
    if (!name.trim()) return setErr("Give the shop a name.");
    if (!brandName) return setErr("Pick an existing brand or type a new one.");
    setBusy(true);
    setErr(null);
    try {
      await submitNewShop(userId, {
        name: name.trim(),
        brandName,
        // category only matters when a new brand is created; harmless otherwise.
        category: picked?.category ?? newCategory,
        lat: pin.lat,
        lng: pin.lng,
        address: address,
        unit,
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
    <Modal title="Propose a shop" onClose={onClose}>
      <p className="mb-3 text-[11px] text-slate-500">
        📍 Pinned at {pin.lat.toFixed(5)}, {pin.lng.toFixed(5)} ·{" "}
        <button
          type="button"
          onClick={onBack}
          className="text-green-700 hover:underline"
        >
          reposition
        </button>
        . A moderator reviews new shops before they go live.
      </p>
      <form onSubmit={submit} className="space-y-3">
        <label className="block">
          <span className="mb-1 block text-[11px] font-medium text-slate-600">
            Shop name
          </span>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Ah Hock Chicken Rice"
            className={inputCls}
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-[11px] font-medium text-slate-600">
            Floor / unit
          </span>
          <input
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            placeholder="e.g. #01-23 (paste from Google Maps)"
            className={inputCls}
          />
          <p className="mt-1 text-[10px] text-slate-400">
            Defaults to the ground floor — paste the unit/address from Google
            Maps to be precise.
          </p>
        </label>

        {/* Brand: search existing, or create a new one from the typed name */}
        <div className="relative">
          <span className="mb-1 block text-[11px] font-medium text-slate-600">
            Brand
          </span>
          <input
            value={brandQuery}
            onChange={(e) => {
              setBrandQuery(e.target.value);
              setPicked(null); // typing clears any pick
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder="Search a brand, or type a new one…"
            className={inputCls}
            autoComplete="off"
          />
          {open && matches.length > 0 && (
            <ul className="absolute z-10 mt-1 max-h-44 w-full overflow-auto rounded-lg border border-slate-200 bg-white text-[13px] shadow-lg">
              {matches.map((b) => (
                <li key={b.id}>
                  <button
                    type="button"
                    onClick={() => pickBrand(b)}
                    className="flex w-full items-center gap-2 px-2 py-1 text-left hover:bg-slate-100"
                  >
                    <span>{b.origin ? flagEmoji(b.origin.code) : "❔"}</span>
                    <span className="truncate">{b.name}</span>
                    <span className="ml-auto text-[10px] text-slate-400">
                      {INDEPENDENCE_META[b.independence].label}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {picked ? (
            <p className="mt-1 text-[10px] text-slate-500">
              Attaching to existing brand{" "}
              <span className="font-medium">{picked.name}</span>.
            </p>
          ) : creatingNew ? (
            <p className="mt-1 text-[10px] text-green-700">
              ➕ Will create a new brand “{q}”.
            </p>
          ) : (
            <p className="mt-1 text-[10px] text-slate-400">
              Every shop belongs to a brand — a single independent stall is its
              own brand.
            </p>
          )}
        </div>

        {/* New brands need a category; existing brands already have one */}
        {creatingNew && (
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium text-slate-600">
              Category (for the new brand)
            </span>
            <select
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value as Category)}
              className={inputCls}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_META[c].emoji} {CATEGORY_META[c].label}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="block">
          <span className="mb-1 block text-[11px] font-medium text-slate-600">
            Address <span className="text-slate-400">(optional)</span>
          </span>
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Unit / street"
            className={inputCls}
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-[11px] font-medium text-slate-600">
            Source (required)
          </span>
          <input
            required
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder="How you know this shop exists"
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
            {busy ? "Submitting…" : "Propose"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
