import { useEffect, useMemo, useState } from "react";
import MapView from "./map/MapView";
import { BRAND } from "../brand.config";
import { isUsingDevTiles } from "./map/tileSource";
import { isSupabaseConfigured } from "./lib/supabase";
import { fetchBusinesses } from "./data/businesses";
import { SAMPLE_BUSINESSES } from "./data/sampleBusinesses";
import {
  type Business,
  type Category,
  type Origin,
  CATEGORY_META,
  ORIGIN_META,
} from "./domain/classification";

const CATEGORIES: Category[] = ["fnb", "retail", "services"];
const ORIGINS: Origin[] = ["local", "foreign", "unverified"];

export default function App() {
  const [categories, setCategories] = useState<Set<Category>>(
    new Set(CATEGORIES),
  );
  const [origins, setOrigins] = useState<Set<Origin>>(new Set(ORIGINS));

  // Live data from Supabase when configured; bundled sample data otherwise so
  // the app always runs. See src/lib/supabase.ts + src/data/businesses.ts.
  const [businesses, setBusinesses] = useState<Business[]>(
    isSupabaseConfigured ? [] : SAMPLE_BUSINESSES,
  );
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    fetchBusinesses()
      .then(setBusinesses)
      .catch((e) => setLoadError(e instanceof Error ? e.message : String(e)));
  }, []);

  const filtered = useMemo(
    () =>
      businesses.filter(
        (b) => categories.has(b.category) && origins.has(b.origin),
      ),
    [businesses, categories, origins],
  );

  function toggle<T>(set: Set<T>, value: T, setter: (s: Set<T>) => void) {
    const next = new Set(set);
    next.has(value) ? next.delete(value) : next.add(value);
    setter(next);
  }

  return (
    <div className="relative h-dvh w-screen overflow-hidden">
      {/* Header + filters */}
      <header className="pointer-events-none absolute inset-x-0 top-0 z-[1000] p-3">
        <div className="pointer-events-auto mx-auto max-w-2xl rounded-2xl bg-white/95 p-3 shadow-lg ring-1 ring-black/5 backdrop-blur">
          <div className="flex items-baseline justify-between">
            <h1 className="text-base font-bold text-green-800">{BRAND.name}</h1>
            <span className="text-[11px] text-slate-400">
              Tiong Bahru pilot
            </span>
          </div>
          <p className="mt-0.5 text-[11px] text-slate-500">{BRAND.tagline}</p>

          <div className="mt-2 flex flex-wrap gap-1.5">
            {CATEGORIES.map((c) => (
              <Chip
                key={c}
                active={categories.has(c)}
                onClick={() => toggle(categories, c, setCategories)}
              >
                {CATEGORY_META[c].emoji} {CATEGORY_META[c].label}
              </Chip>
            ))}
            <span className="mx-1 self-center text-slate-300">|</span>
            {ORIGINS.map((o) => (
              <Chip
                key={o}
                active={origins.has(o)}
                onClick={() => toggle(origins, o, setOrigins)}
              >
                {ORIGIN_META[o].emoji} {ORIGIN_META[o].label}
              </Chip>
            ))}
          </div>
        </div>
      </header>

      <MapView businesses={filtered} />

      <div className="absolute bottom-2 left-2 z-[1000] flex flex-col gap-1">
        {!isSupabaseConfigured && (
          <Banner tone="amber">
            Sample data — set VITE_SUPABASE_URL / _ANON_KEY to load live data
          </Banner>
        )}
        {loadError && (
          <Banner tone="red">Couldn’t load businesses: {loadError}</Banner>
        )}
        {isUsingDevTiles() && (
          <Banner tone="amber">
            Dev tiles (public OSM) — set VITE_TILE_URL before deploying
          </Banner>
        )}
      </div>
    </div>
  );
}

function Banner({
  tone,
  children,
}: {
  tone: "amber" | "red";
  children: React.ReactNode;
}) {
  const tones = {
    amber: "bg-amber-100 text-amber-800 ring-amber-300",
    red: "bg-red-100 text-red-800 ring-red-300",
  } as const;
  return (
    <div
      className={`rounded-md px-2 py-1 text-[10px] ring-1 ${tones[tone]}`}
    >
      {children}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={
        "rounded-full px-2.5 py-1 text-[11px] font-medium transition " +
        (active
          ? "bg-green-700 text-white"
          : "bg-slate-100 text-slate-500 hover:bg-slate-200")
      }
    >
      {children}
    </button>
  );
}
