import { useMemo } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import { getTileSource } from "./tileSource";
import { PILOT } from "../config/pilot";
import {
  type Business,
  INDEPENDENCE_META,
  CATEGORY_META,
  originColor,
  flagEmoji,
} from "../domain/classification";

interface MapViewProps {
  businesses: Business[];
  /** When set, cards show a "Suggest classification" action for signed-in users. */
  onClassify?: (b: Business) => void;
}

export default function MapView({ businesses, onClassify }: MapViewProps) {
  const tiles = useMemo(() => getTileSource(), []);

  return (
    <MapContainer
      center={PILOT.center}
      zoom={PILOT.zoom}
      className="h-full w-full"
      zoomControl={true}
    >
      {tiles.kind === "raster" && (
        <TileLayer
          url={tiles.url}
          attribution={tiles.attribution}
          maxZoom={tiles.maxZoom}
        />
      )}

      {businesses.map((b) => (
        <CircleMarker
          key={b.id}
          center={[b.lat, b.lng]}
          radius={9}
          pathOptions={{
            color: "#ffffff",
            weight: 2,
            fillColor: originColor(b.origin),
            fillOpacity: 0.95,
          }}
        >
          <Popup>
            <BusinessCard business={b} onClassify={onClassify} />
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}

function BusinessCard({
  business: b,
  onClassify,
}: {
  business: Business;
  onClassify?: (b: Business) => void;
}) {
  const ind = INDEPENDENCE_META[b.independence];
  const originLabel = b.origin
    ? `${flagEmoji(b.origin.code)} ${b.origin.name}`
    : "❔ Unverified";
  const cat = CATEGORY_META[b.category];
  return (
    <div className="min-w-[200px] space-y-2">
      <div className="text-sm font-semibold text-slate-900">{b.name}</div>
      <div className="text-xs text-slate-500">
        {cat.emoji} {cat.label}
        {b.subcategory ? ` · ${b.subcategory.replace(/_/g, " ")}` : ""}
      </div>
      <div className="flex flex-wrap gap-1">
        <Badge>{`${ind.emoji} ${ind.label}`}</Badge>
        <Badge>{originLabel}</Badge>
      </div>
      <div className="text-[11px] leading-tight text-slate-400">
        {b.updatedAt
          ? `Updated ${b.updatedAt}`
          : "Not yet classified — help verify this"}
      </div>
      {onClassify && b.brandId && (
        <button
          onClick={() => onClassify(b)}
          className="w-full rounded bg-green-50 px-2 py-1 text-[11px] font-medium text-green-800 hover:bg-green-100"
        >
          Suggest classification
        </button>
      )}
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
      {children}
    </span>
  );
}
