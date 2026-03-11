/**
 * Map constants for the festival area.
 *
 * Bounding box (mandatory coverage area):
 *   NW: 53.527076, 16.260186
 *   SE: 53.513202, 16.303398
 */

/** Exact bounding box for offline tile generation */
export const TILE_BOUNDS = {
    north: 53.527076,
    south: 53.513202,
    west: 16.260186,
    east: 16.303398,
  } as const;
  
  /** MapLibre-style bounds: [lng, lat] pairs */
  export const BOUNDING_BOX = {
    ne: [TILE_BOUNDS.east, TILE_BOUNDS.north] as [number, number],
    sw: [TILE_BOUNDS.west, TILE_BOUNDS.south] as [number, number],
  };
  
  /** Padded bounds for camera constraints (~300m buffer) */
  const BUFFER = 0.003;
  export const MAP_MAX_BOUNDS = {
    ne: [TILE_BOUNDS.east + BUFFER, TILE_BOUNDS.north + BUFFER] as [number, number],
    sw: [TILE_BOUNDS.west - BUFFER, TILE_BOUNDS.south - BUFFER] as [number, number],
  };
  
  /** Center of the festival area [lng, lat] */
  export const MAP_CENTER: [number, number] = [
    (TILE_BOUNDS.west + TILE_BOUNDS.east) / 2,
    (TILE_BOUNDS.south + TILE_BOUNDS.north) / 2,
  ];
  
  export const DEFAULT_ZOOM = 14.5;
  export const MIN_ZOOM = 12;
  export const MAX_ZOOM = 18;
  export const USER_ZOOM = 16;
  export const FIT_PADDING = { paddingTop: 100, paddingRight: 60, paddingBottom: 260, paddingLeft: 60 };
  
  /** POI category → color mapping */
  export const POI_COLORS: Record<string, string> = {
    stage: "#DC2626",
    medical: "#EF4444",
    food: "#F59E0B",
    toilet: "#8B5CF6",
    info: "#3B82F6",
    camping: "#10B981",
    parking: "#6B7280",
    entrance: "#F97316",
    water: "#06B6D4",
    charging: "#EAB308",
  };
  
  /** POI category → Ionicons icon name */
  export const POI_ICONS: Record<string, string> = {
    stage: "musical-notes",
    medical: "medkit",
    food: "restaurant",
    toilet: "water",
    info: "information-circle",
    camping: "bonfire",
    parking: "car",
    entrance: "log-in",
    water: "water-outline",
    charging: "battery-charging",
  };
  