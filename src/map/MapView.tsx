import { useMemo } from "react";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
  Tooltip,
  Polygon,
  Marker,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import { getTileSource } from "./tileSource";
import { PILOT } from "../config/pilot";
import type { BuildingShape } from "../data/buildings";
import {
  type Business,
  INDEPENDENCE_META,
  CATEGORY_META,
  originColor,
  flagEmoji,
} from "../domain/classification";

/** Small draggable handle for editing polygon vertices (no image needed). */
const VTX_ICON = L.divIcon({
  className: "vtx-handle",
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

/** Draft pin for proposing a new shop (draggable to fine-tune). */
const DRAFT_ICON = L.divIcon({
  className: "draft-pin",
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

interface MapViewProps {
  businesses: Business[];
  /** When set, cards show a "Suggest classification" action for signed-in users. */
  onClassify?: (b: Business) => void;
  /** Collapse each building's stalls into one marker. */
  groupByBuilding?: boolean;
  /** When set (admin boundary editing), render editable building polygons. */
  editBuildings?: BuildingShape[];
  onVertexDrag?: (buildingId: string, index: number, lat: number, lng: number) => void;
  /** When placing a new shop: capture map clicks and show a draggable draft pin. */
  placing?: boolean;
  draftPin?: { lat: number; lng: number } | null;
  onMapClick?: (lat: number, lng: number) => void;
}

/** Invisible helper: reports map clicks while in placement mode. */
function ClickCatcher({ onClick }: { onClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click: (e) => onClick(e.latlng.lat, e.latlng.lng),
  });
  return null;
}

interface BuildingGroup {
  id: string;
  name: string;
  center: [number, number];
  members: Business[];
}

/** Split businesses into building groups (by building.id) and ungrouped pins. */
function groupBusinesses(businesses: Business[]): {
  groups: BuildingGroup[];
  ungrouped: Business[];
} {
  const byBuilding = new Map<string, Business[]>();
  const ungrouped: Business[] = [];
  for (const b of businesses) {
    if (b.building) {
      const arr = byBuilding.get(b.building.id) ?? [];
      arr.push(b);
      byBuilding.set(b.building.id, arr);
    } else {
      ungrouped.push(b);
    }
  }
  const groups: BuildingGroup[] = [];
  for (const [id, members] of byBuilding) {
    const lat = members.reduce((s, m) => s + m.lat, 0) / members.length;
    const lng = members.reduce((s, m) => s + m.lng, 0) / members.length;
    groups.push({ id, name: members[0].building!.name, center: [lat, lng], members });
  }
  return { groups, ungrouped };
}

export default function MapView({
  businesses,
  onClassify,
  groupByBuilding,
  editBuildings,
  onVertexDrag,
  placing,
  draftPin,
  onMapClick,
}: MapViewProps) {
  const tiles = useMemo(() => getTileSource(), []);
  const grouped = useMemo(() => groupBusinesses(businesses), [businesses]);
  const editing = !!editBuildings;

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

      {/* New-shop placement: capture clicks + show a draggable draft pin */}
      {placing && onMapClick && <ClickCatcher onClick={onMapClick} />}
      {placing && draftPin && (
        <Marker
          position={[draftPin.lat, draftPin.lng]}
          draggable
          icon={DRAFT_ICON}
          eventHandlers={{
            dragend: (e) => {
              const ll = (e.target as L.Marker).getLatLng();
              onMapClick?.(ll.lat, ll.lng);
            },
          }}
        />
      )}

      {/* Admin boundary editor overlay */}
      {editBuildings?.map((bld) => (
        <BuildingEditShape
          key={bld.id}
          bld={bld}
          onVertexDrag={onVertexDrag}
        />
      ))}

      {editing ? (
        // While editing, show plain reference pins (no grouping, no popups).
        businesses.map((b) => (
          <CircleMarker
            key={b.id}
            center={[b.lat, b.lng]}
            radius={5}
            pathOptions={{
              color: "#ffffff",
              weight: 1,
              fillColor: originColor(b.origin),
              fillOpacity: 0.7,
            }}
          />
        ))
      ) : groupByBuilding ? (
        <>
          {grouped.groups.map((g) => (
            <CircleMarker
              key={g.id}
              center={g.center}
              radius={15}
              pathOptions={{
                color: "#ffffff",
                weight: 2,
                fillColor: "#0f766e",
                fillOpacity: 0.92,
              }}
            >
              <Tooltip permanent direction="center" className="bld-count">
                {g.members.length}
              </Tooltip>
              <Popup>
                <BuildingCard
                  name={g.name}
                  members={g.members}
                  onClassify={onClassify}
                />
              </Popup>
            </CircleMarker>
          ))}
          {grouped.ungrouped.map((b) => (
            <OutletMarker key={b.id} b={b} onClassify={onClassify} />
          ))}
        </>
      ) : (
        businesses.map((b) => (
          <OutletMarker key={b.id} b={b} onClassify={onClassify} />
        ))
      )}
    </MapContainer>
  );
}

function OutletMarker({
  b,
  onClassify,
}: {
  b: Business;
  onClassify?: (b: Business) => void;
}) {
  return (
    <CircleMarker
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
  );
}

function BuildingEditShape({
  bld,
  onVertexDrag,
}: {
  bld: BuildingShape;
  onVertexDrag?: (id: string, i: number, lat: number, lng: number) => void;
}) {
  return (
    <>
      <Polygon
        positions={bld.coords}
        pathOptions={{
          color: "#7c3aed",
          weight: 2,
          fillColor: "#7c3aed",
          fillOpacity: 0.08,
        }}
      >
        <Tooltip permanent direction="center" className="bld-name">
          {bld.name}
        </Tooltip>
      </Polygon>
      {bld.coords.map((pos, i) => (
        <Marker
          key={i}
          position={pos}
          draggable
          icon={VTX_ICON}
          eventHandlers={{
            drag: (e) => {
              const ll = (e.target as L.Marker).getLatLng();
              onVertexDrag?.(bld.id, i, ll.lat, ll.lng);
            },
          }}
        />
      ))}
    </>
  );
}

function BuildingCard({
  name,
  members,
  onClassify,
}: {
  name: string;
  members: Business[];
  onClassify?: (b: Business) => void;
}) {
  const sg = members.filter((m) => m.origin?.code === "SG").length;
  return (
    <div className="min-w-[220px] space-y-2">
      <div className="text-sm font-semibold text-slate-900">🏬 {name}</div>
      <div className="text-[11px] text-slate-500">
        {members.length} stalls · {sg} Singaporean-owned
      </div>
      <ul className="max-h-40 space-y-1 overflow-auto">
        {members.map((m) => (
          <li key={m.id} className="flex items-center gap-1 text-[12px]">
            <span>{m.origin ? flagEmoji(m.origin.code) : "❔"}</span>
            <span className="truncate text-slate-700">{m.name}</span>
            {onClassify && m.brandId && (
              <button
                onClick={() => onClassify(m)}
                className="ml-auto shrink-0 text-[10px] text-green-700 hover:underline"
              >
                classify
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
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
        {b.building ? ` · ${b.building.name}` : ""}
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
