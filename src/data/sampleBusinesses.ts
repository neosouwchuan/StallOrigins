import type { Business } from "../domain/classification";

/**
 * Sample data for Phase 0/1 development only. These are illustrative points
 * around Tiong Bahru to exercise the map, badges and filters — NOT a verified
 * dataset. Real data will be seeded from data.gov.sg + OSM + manual curation
 * (SPEC §5) and stored in Supabase. Classifications here are placeholders.
 */
export const SAMPLE_BUSINESSES: Business[] = [
  {
    id: "sample-1",
    name: "Tiong Bahru Market (hawker centre)",
    lat: 1.2848,
    lng: 103.8317,
    address: "30 Seng Poh Rd",
    category: "fnb",
    subcategory: "hawker_centre",
    independence: "independent",
    origin: "local",
    updatedAt: "2026-09-04",
  },
  {
    id: "sample-2",
    name: "Traditional provision shop",
    lat: 1.2861,
    lng: 103.8329,
    category: "retail",
    subcategory: "provision_shop",
    independence: "independent",
    origin: "local",
    updatedAt: "2026-09-04",
  },
  {
    id: "sample-3",
    name: "Indie specialty cafe",
    lat: 1.2857,
    lng: 103.8341,
    category: "fnb",
    subcategory: "cafe",
    independence: "independent",
    origin: "unverified",
  },
  {
    id: "sample-4",
    name: "International coffee chain outlet",
    lat: 1.2839,
    lng: 103.8302,
    category: "fnb",
    subcategory: "cafe",
    independence: "franchise",
    origin: "foreign",
    updatedAt: "2026-09-04",
  },
  {
    id: "sample-5",
    name: "Neighbourhood barber",
    lat: 1.2852,
    lng: 103.8296,
    category: "services",
    subcategory: "barber",
    independence: "independent",
    origin: "local",
    updatedAt: "2026-09-04",
  },
  {
    id: "sample-6",
    name: "Old-school bakery",
    lat: 1.2866,
    lng: 103.8312,
    category: "fnb",
    subcategory: "bakery",
    independence: "chain_small",
    origin: "local",
    updatedAt: "2026-09-04",
  },
];
