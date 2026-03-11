export interface POIProperties {
  id: string;
  category: string;
  name_pl: string;
  name_en: string;
}

export type LngLatTuple = [number, number];

export interface AreaCorners {
  nw: LngLatTuple;
  ne: LngLatTuple;
  se: LngLatTuple;
  sw: LngLatTuple;
}

export interface AreaConfig {
  id: string;
  category: string;
  name_pl: string;
  name_en: string;
  corners: AreaCorners;
}

export interface DisplayConfig {
  enablePoints: boolean;
  enableAreas: boolean;
  pointIds: string[];
  areaIds: string[];
}

export interface EditorPoint {
  id: string;
  category: string;
  name_pl: string;
  name_en: string;
  coordinates: LngLatTuple;
}

export interface EditorExportPayload {
  points: EditorPoint[];
  areas: AreaConfig[];
  displayConfig: DisplayConfig;
}

export interface FestivalPoiFeature {
  type: "Feature";
  properties: POIProperties;
  geometry: {
    type: "Point";
    coordinates: LngLatTuple;
  };
}

export interface FestivalPoisGeoJSON {
  type: "FeatureCollection";
  features: FestivalPoiFeature[];
}

export function isValidLngLat(value: unknown): value is LngLatTuple {
  if (!Array.isArray(value) || value.length !== 2) return false;
  const [lng, lat] = value;
  return (
    typeof lng === "number" &&
    Number.isFinite(lng) &&
    typeof lat === "number" &&
    Number.isFinite(lat)
  );
}

export function clampToBounds(
  [lng, lat]: LngLatTuple,
  bounds: { ne: LngLatTuple; sw: LngLatTuple },
): LngLatTuple {
  const [west, south] = bounds.sw;
  const [east, north] = bounds.ne;
  const clampedLng = Math.min(Math.max(lng, west), east);
  const clampedLat = Math.min(Math.max(lat, south), north);
  return [clampedLng, clampedLat];
}

export interface PayloadValidationIssue {
  path: string;
  message: string;
}

export interface PayloadValidationResult {
  valid: boolean;
  issues: PayloadValidationIssue[];
}

export function validateEditorPayload(
  payload: unknown,
): payload is EditorExportPayload {
  const issues: PayloadValidationIssue[] = [];

  const asAny = payload as Partial<EditorExportPayload> | null | undefined;
  if (!asAny || typeof asAny !== "object") {
    return false;
  }

  if (!Array.isArray(asAny.points)) {
    issues.push({ path: "points", message: "points must be an array" });
  }
  if (!Array.isArray(asAny.areas)) {
    issues.push({ path: "areas", message: "areas must be an array" });
  }
  if (!asAny.displayConfig || typeof asAny.displayConfig !== "object") {
    issues.push({
      path: "displayConfig",
      message: "displayConfig is required",
    });
  }

  const ids = new Set<string>();

  (asAny.points ?? []).forEach((p, index) => {
    const base = `points[${index}]`;
    if (!p || typeof p !== "object") {
      issues.push({ path: base, message: "point must be an object" });
      return;
    }
    const { id, category, name_pl, name_en, coordinates } = p as EditorPoint;
    if (!id) issues.push({ path: `${base}.id`, message: "id is required" });
    if (id && ids.has(id)) {
      issues.push({
        path: `${base}.id`,
        message: "id must be unique across points and areas",
      });
    }
    if (id) ids.add(id);
    if (!category) {
      issues.push({
        path: `${base}.category`,
        message: "category is required",
      });
    }
    if (!name_pl) {
      issues.push({
        path: `${base}.name_pl`,
        message: "name_pl is required",
      });
    }
    if (!name_en) {
      issues.push({
        path: `${base}.name_en`,
        message: "name_en is required",
      });
    }
    if (!isValidLngLat(coordinates)) {
      issues.push({
        path: `${base}.coordinates`,
        message: "coordinates must be [lng, lat] numbers",
      });
    }
  });

  (asAny.areas ?? []).forEach((a, index) => {
    const base = `areas[${index}]`;
    if (!a || typeof a !== "object") {
      issues.push({ path: base, message: "area must be an object" });
      return;
    }
    const { id, category, name_pl, name_en, corners } = a as AreaConfig;
    if (!id) issues.push({ path: `${base}.id`, message: "id is required" });
    if (id && ids.has(id)) {
      issues.push({
        path: `${base}.id`,
        message: "id must be unique across points and areas",
      });
    }
    if (id) ids.add(id);
    if (!category) {
      issues.push({
        path: `${base}.category`,
        message: "category is required",
      });
    }
    if (!name_pl) {
      issues.push({
        path: `${base}.name_pl`,
        message: "name_pl is required",
      });
    }
    if (!name_en) {
      issues.push({
        path: `${base}.name_en`,
        message: "name_en is required",
      });
    }
    if (!corners || typeof corners !== "object") {
      issues.push({
        path: `${base}.corners`,
        message: "corners object is required",
      });
    } else {
      (["nw", "ne", "se", "sw"] as const).forEach((key) => {
        const tuple = (corners as AreaCorners)[key];
        if (!isValidLngLat(tuple)) {
          issues.push({
            path: `${base}.corners.${key}`,
            message: "corner must be [lng, lat] numbers",
          });
        }
      });
    }
  });

  const dc = asAny.displayConfig as DisplayConfig | undefined;
  if (dc) {
    if (typeof dc.enablePoints !== "boolean") {
      issues.push({
        path: "displayConfig.enablePoints",
        message: "enablePoints must be boolean",
      });
    }
    if (typeof dc.enableAreas !== "boolean") {
      issues.push({
        path: "displayConfig.enableAreas",
        message: "enableAreas must be boolean",
      });
    }
    if (!Array.isArray(dc.pointIds)) {
      issues.push({
        path: "displayConfig.pointIds",
        message: "pointIds must be an array of strings",
      });
    }
    if (!Array.isArray(dc.areaIds)) {
      issues.push({
        path: "displayConfig.areaIds",
        message: "areaIds must be an array of strings",
      });
    }
  }

  (payload as any).__validationIssues = issues;

  return issues.length === 0;
}

