import type { Business } from "../domain/classification";

/**
 * Sample data for Phase 0/1 development only. Illustrative points inside
 * Bukit Panjang Plaza + Hillion Mall (the pilot area, SPEC §2) to exercise the
 * map, badges and filters — NOT a verified dataset. Real data will be seeded
 * from OSM (Overpass, confined to the pilot bounds) + manual curation.
 */
export const SAMPLE_BUSINESSES: Business[] = [
  {
    id: "sample-1",
    name: "Kopitiam food court stall",
    lat: 1.3787,
    lng: 103.7626,
    address: "Bukit Panjang Plaza, 1 Jelebu Rd",
    category: "fnb",
    subcategory: "hawker_stall",
    independence: "independent",
    origin: { code: "SG", name: "Singapore" },
    updatedAt: "2026-09-04",
  },
  {
    id: "sample-2",
    name: "Neighbourhood minimart",
    lat: 1.3789,
    lng: 103.7629,
    address: "Bukit Panjang Plaza",
    category: "retail",
    subcategory: "minimart",
    independence: "chain_small",
    origin: { code: "SG", name: "Singapore" },
    updatedAt: "2026-09-04",
  },
  {
    id: "sample-3",
    name: "International fast-food outlet",
    lat: 1.3783,
    lng: 103.764,
    address: "Hillion Mall, 17 Petir Rd",
    category: "fnb",
    subcategory: "restaurant",
    independence: "franchise",
    origin: { code: "US", name: "United States" },
    updatedAt: "2026-09-04",
  },
  {
    id: "sample-4",
    name: "Indie bubble tea stall",
    lat: 1.378,
    lng: 103.7638,
    address: "Hillion Mall",
    category: "fnb",
    subcategory: "cafe",
    independence: "independent",
    // origin omitted → unverified
  },
  {
    id: "sample-5",
    name: "Neighbourhood barber",
    lat: 1.3785,
    lng: 103.7624,
    address: "Bukit Panjang Plaza",
    category: "services",
    subcategory: "barber",
    independence: "independent",
    origin: { code: "SG", name: "Singapore" },
    updatedAt: "2026-09-04",
  },
  {
    id: "sample-6",
    name: "Local bakery chain",
    lat: 1.3781,
    lng: 103.7642,
    address: "Hillion Mall",
    category: "fnb",
    subcategory: "bakery",
    independence: "chain",
    origin: { code: "SG", name: "Singapore" },
    updatedAt: "2026-09-04",
  },
];
