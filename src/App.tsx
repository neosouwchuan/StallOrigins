import { useCallback, useEffect, useMemo, useState } from "react";
import MapView from "./map/MapView";
import { BRAND } from "../brand.config";
import { isUsingDevTiles } from "./map/tileSource";
import { isSupabaseConfigured } from "./lib/supabase";
import { useSession } from "./lib/useSession";
import { fetchBusinesses } from "./data/businesses";
import { SAMPLE_BUSINESSES } from "./data/sampleBusinesses";
import { AuthBar } from "./components/AuthBar";
import { ClassifyForm } from "./components/ClassifyForm";
import { ModerationPanel } from "./components/ModerationPanel";
import {
  type Business,
  type Category,
  type OriginCoarse,
  CATEGORY_META,
  ORIGIN_COARSE_META,
  originCoarse,
} from "./domain/classification";

const CATEGORIES: Category[] = ["fnb", "retail", "services"];
const ORIGINS: OriginCoarse[] = ["singaporean", "foreign", "unverified"];

export default function App() {
  const auth = useSession();
  const [categories, setCategories] = useState<Set<Category>>(
    new Set(CATEGORIES),
  );
  const [origins, setOrigins] = useState<Set<OriginCoarse>>(new Set(ORIGINS));

  const [businesses, setBusinesses] = useState<Business[]>(
    isSupabaseConfigured ? [] : SAMPLE_BUSINESSES,
  );
  const [loadError, setLoadError] = useState<string | null>(null);

  const [classifyTarget, setClassifyTarget] = useState<Business | null>(null);
  const [showModeration, setShowModeration] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!isSupabaseConfigured) return;
    fetchBusinesses()
      .then((b) => {
        setBusinesses(b);
        setLoadError(null);
      })
      .catch((e) => setLoadError(e instanceof Error ? e.message : String(e)));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(
    () =>
      businesses.filter(
        (b) => categories.has(b.category) && origins.has(originCoarse(b.origin)),
      ),
    [businesses, categories, origins],
  );

  function toggle<T>(set: Set<T>, value: T, setter: (s: Set<T>) => void) {
    const next = new Set(set);
    next.has(value) ? next.delete(value) : next.add(value);
    setter(next);
  }

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }

  return (
    <div className="relative h-dvh w-screen overflow-hidden">
      {/* Header + filters */}
      <header className="pointer-events-none absolute inset-x-0 top-0 z-[1000] p-3">
        <div className="pointer-events-auto mx-auto max-w-2xl rounded-2xl bg-white/95 p-3 shadow-lg ring-1 ring-black/5 backdrop-blur">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-baseline gap-2">
                <h1 className="text-base font-bold text-green-800">
                  {BRAND.name}
                </h1>
                <span className="text-[11px] text-slate-400">
                  Bukit Panjang pilot
                </span>
              </div>
              <p className="mt-0.5 text-[11px] text-slate-500">
                {BRAND.tagline}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {auth.isModerator && (
                <button
                  onClick={() => setShowModeration(true)}
                  className="rounded bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800 hover:bg-amber-200"
                >
                  Moderate
                </button>
              )}
              {isSupabaseConfigured && <AuthBar auth={auth} />}
            </div>
          </div>

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
                {ORIGIN_COARSE_META[o].emoji} {ORIGIN_COARSE_META[o].label}
              </Chip>
            ))}
          </div>
        </div>
      </header>

      <MapView
        businesses={filtered}
        onClassify={auth.session ? (b) => setClassifyTarget(b) : undefined}
      />

      {/* Modals */}
      {classifyTarget && auth.session && (
        <ClassifyForm
          business={classifyTarget}
          userId={auth.session.user.id}
          onClose={() => setClassifyTarget(null)}
          onDone={() => {
            setClassifyTarget(null);
            flash("Suggestion submitted for review — thanks!");
          }}
        />
      )}
      {showModeration && auth.isModerator && (
        <ModerationPanel
          onClose={() => setShowModeration(false)}
          onApplied={load}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className="absolute bottom-2 left-1/2 z-[1500] -translate-x-1/2 rounded-md bg-green-700 px-3 py-1.5 text-[12px] text-white shadow-lg">
          {toast}
        </div>
      )}

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
    <div className={`rounded-md px-2 py-1 text-[10px] ring-1 ${tones[tone]}`}>
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
