# Map Config and Data Specification

This document describes how map points and areas are structured in this app, so another tool can place features and export compatible config/data.

## Coordinate Convention

- All coordinates are GeoJSON-style tuples: `[longitude, latitude]`
- Example: `[16.282, 53.5225]`
- Keep all features inside festival bounds defined in `src/map/constants.ts`

## Files Used by Map

- Data (features):
  - `src/map/festivalPois.ts`
- Display filters/toggles:
  - `src/map/displayConfig.ts`
- Rendering logic:
  - `app/(tabs)/map/index.tsx`

## Point Data Structure

Points are stored as GeoJSON Point features in `festivalPoisGeoJSON`.

Type shape:

```ts
interface POIProperties {
  id: string;
  category: string;
  name_pl: string;
  name_en: string;
}
```

Point example:

```json
{
  "type": "Feature",
  "properties": {
    "id": "poi-toilets-a",
    "category": "toilet",
    "name_pl": "Toalety A",
    "name_en": "Toilets A"
  },
  "geometry": {
    "type": "Point",
    "coordinates": [16.27, 53.5205]
  }
}
```

## Area Data Structure (Rotatable)

Areas are configured by 4 corners (supports rotated rectangles).

Type shape:

```ts
interface AreaCorners {
  nw: [number, number];
  ne: [number, number];
  se: [number, number];
  sw: [number, number];
}

interface AreaConfig {
  id: string;
  category: string;
  name_pl: string;
  name_en: string;
  corners: AreaCorners;
}
```

Area config example:

```json
{
  "id": "area-main-stage",
  "category": "stage",
  "name_pl": "Duza Scena",
  "name_en": "Main Stage",
  "corners": {
    "nw": [16.2795, 53.5245],
    "ne": [16.2815, 53.5242],
    "se": [16.2818, 53.5235],
    "sw": [16.2798, 53.5238]
  }
}
```

The app converts each `AreaConfig` into polygon coordinates in this order:

`[nw, ne, se, sw, nw]`

## Display Config Structure

Map can show points and/or areas together. Visibility is controlled in `src/map/displayConfig.ts`.

```ts
export const mapDisplayConfig = {
  enablePoints: true,
  enableAreas: true,
  pointIds: [] as string[], // empty = all points
  areaIds: [] as string[],  // empty = all areas
} as const;
```

Rules:

- `enablePoints: false` hides all points
- `enableAreas: false` hides all areas
- `pointIds` non-empty means whitelist only those point IDs
- `areaIds` non-empty means whitelist only those area IDs

## Categories

Current categories used for styling/icons include:

- `stage`
- `medical`
- `food`
- `toilet`
- `info`
- `camping`
- `parking`
- `entrance`
- `water`
- `charging`

Use these categories when possible so map colors/icons remain consistent.

## Suggested Export Payload (from external tool)

Your external app can export a JSON payload like this:

```json
{
  "points": [
    {
      "id": "poi-...",
      "category": "toilet",
      "name_pl": "...",
      "name_en": "...",
      "coordinates": [16.27, 53.52]
    }
  ],
  "areas": [
    {
      "id": "area-...",
      "category": "stage",
      "name_pl": "...",
      "name_en": "...",
      "corners": {
        "nw": [16.27, 53.52],
        "ne": [16.28, 53.52],
        "se": [16.28, 53.51],
        "sw": [16.27, 53.51]
      }
    }
  ],
  "displayConfig": {
    "enablePoints": true,
    "enableAreas": true,
    "pointIds": [],
    "areaIds": []
  }
}
```

## Integration Mapping

When importing exported JSON into this app:

1. Map `points[]` to `festivalPoisGeoJSON.features` (GeoJSON Point features)
2. Map `areas[]` to `festivalAreaConfigs`
3. Map `displayConfig` to `mapDisplayConfig`

## Validation Recommendations (for external tool)

- Enforce unique IDs across points and areas
- Require all 4 corners for every area
- Validate tuple format `[lng, lat]`
- Ensure polygons are not self-intersecting
- Optionally clip/check against festival bounds

