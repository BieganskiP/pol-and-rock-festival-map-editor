"use client";

import { useEffect, useRef } from "react";
import maplibregl, { Map as MapLibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  MAP_CENTER,
  MAP_MAX_BOUNDS,
  DEFAULT_ZOOM,
  MIN_ZOOM,
  MAX_ZOOM,
  POI_COLORS,
} from "./constants";
import type {
  AreaConfig,
  FestivalPoisGeoJSON,
  LngLatTuple,
} from "./types";

export type EditorTool =
  | "idle"
  | "add-point"
  | "add-area-corners"
  | "edit-attributes"
  | "move-geometry";

export interface EditorMapProps {
  pois: FestivalPoisGeoJSON;
  areas: AreaConfig[];
  activeTool: EditorTool;
  selectedFeatureId?: string | null;
  onMapClick?: (lngLat: LngLatTuple) => void;
  onFeatureSelect?: (featureId: string | null) => void;
  onPointDrag?: (id: string, lngLat: LngLatTuple) => void;
  onAreaCornerDrag?: (
    areaId: string,
    cornerKey: "nw" | "ne" | "se" | "sw",
    lngLat: LngLatTuple,
  ) => void;
}

const POI_SOURCE_ID = "editor-pois";
const POI_LAYER_ID = "editor-pois-layer";
const AREAS_SOURCE_ID = "editor-areas";
const AREAS_FILL_LAYER_ID = "editor-areas-fill";
const AREAS_LINE_LAYER_ID = "editor-areas-outline";
const CORNERS_SOURCE_ID = "editor-area-corners";
const CORNERS_LAYER_ID = "editor-area-corners-layer";

function areaToPolygonCoordinates(area: AreaConfig): LngLatTuple[][] {
  const { nw, ne, se, sw } = area.corners;
  return [[nw, ne, se, sw, nw]];
}

export function EditorMap({
  pois,
  areas,
  activeTool,
  selectedFeatureId,
  onMapClick,
  onFeatureSelect,
  onPointDrag,
  onAreaCornerDrag,
}: EditorMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const activeToolRef = useRef<EditorTool>("idle");
  const onMapClickRef = useRef<((lngLat: LngLatTuple) => void) | undefined>();
  const onFeatureSelectRef = useRef<
    ((featureId: string | null) => void) | undefined
  >();
  const onPointDragRef = useRef<
    ((id: string, lngLat: LngLatTuple) => void) | undefined
  >();
  const onAreaCornerDragRef = useRef<
    (
      areaId: string,
      cornerKey: "nw" | "ne" | "se" | "sw",
      lngLat: LngLatTuple,
    ) => void
  >();

  // Keep refs in sync with latest props
  useEffect(() => {
    activeToolRef.current = activeTool;
  }, [activeTool]);

  useEffect(() => {
    onMapClickRef.current = onMapClick;
  }, [onMapClick]);

  useEffect(() => {
    onFeatureSelectRef.current = onFeatureSelect;
  }, [onFeatureSelect]);

  useEffect(() => {
    onPointDragRef.current = onPointDrag;
  }, [onPointDrag]);

  useEffect(() => {
    onAreaCornerDragRef.current = onAreaCornerDrag;
  }, [onAreaCornerDrag]);

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {
          openstreetmap: {
            type: "raster",
            tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
            tileSize: 256,
            attribution:
              '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          },
        },
        layers: [
          {
            id: "openstreetmap",
            type: "raster",
            source: "openstreetmap",
          },
        ],
      } as any,
      center: MAP_CENTER,
      zoom: DEFAULT_ZOOM,
      maxZoom: MAX_ZOOM,
      minZoom: MIN_ZOOM,
      maxBounds: [MAP_MAX_BOUNDS.sw, MAP_MAX_BOUNDS.ne],
    });

    map.addControl(
      new maplibregl.NavigationControl({ visualizePitch: true }),
      "top-right",
    );

    // Ensure the map matches container size
    map.on("load", () => {
      map.resize();
      // POI source & layer
      if (!map.getSource(POI_SOURCE_ID)) {
        map.addSource(POI_SOURCE_ID, {
          type: "geojson",
          data: pois as any,
        });
      }

      if (!map.getLayer(POI_LAYER_ID)) {
        map.addLayer({
          id: POI_LAYER_ID,
          type: "circle",
          source: POI_SOURCE_ID,
          paint: {
            "circle-radius": 5,
            "circle-color": [
              "coalesce",
              [
                "get",
                ["get", "category"],
                [
                  "literal",
                  Object.fromEntries(
                    Object.entries(POI_COLORS).map(([k, v]) => [k, v]),
                  ),
                ],
              ],
              "#22c55e",
            ],
            "circle-stroke-color": "#020617",
            "circle-stroke-width": 1.5,
          },
        });
      }

      // Areas source & layers
      if (!map.getSource(AREAS_SOURCE_ID)) {
        map.addSource(AREAS_SOURCE_ID, {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: areas.map((area) => ({
              type: "Feature",
              properties: {
                id: area.id,
                category: area.category,
              },
              geometry: {
                type: "Polygon",
                coordinates: areaToPolygonCoordinates(area),
              },
            })),
          } as any,
        });
      }

      if (!map.getLayer(AREAS_FILL_LAYER_ID)) {
        map.addLayer({
          id: AREAS_FILL_LAYER_ID,
          type: "fill",
          source: AREAS_SOURCE_ID,
          paint: {
            "fill-color": [
              "coalesce",
              [
                "get",
                ["get", "category"],
                [
                  "literal",
                  Object.fromEntries(
                    Object.entries(POI_COLORS).map(([k, v]) => [k, v]),
                  ),
                ],
              ],
              "#22c55e",
            ],
            "fill-opacity": 0.18,
          },
        });
      }

      if (!map.getLayer(AREAS_LINE_LAYER_ID)) {
        map.addLayer({
          id: AREAS_LINE_LAYER_ID,
          type: "line",
          source: AREAS_SOURCE_ID,
          paint: {
            "line-color": "#e5e7eb",
            "line-width": 1.2,
          },
        });
      }

      // Corner handles for areas (for dragging)
      if (!map.getSource(CORNERS_SOURCE_ID)) {
        map.addSource(CORNERS_SOURCE_ID, {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: [] as any[],
          },
        });
      }

      if (!map.getLayer(CORNERS_LAYER_ID)) {
        map.addLayer({
          id: CORNERS_LAYER_ID,
          type: "circle",
          source: CORNERS_SOURCE_ID,
          paint: {
            "circle-radius": 4,
            "circle-color": "#f97316",
            "circle-stroke-color": "#0f172a",
            "circle-stroke-width": 1,
          },
        });
      }
    });

    // Resize map when container size changes
    let resizeObserver: ResizeObserver | null = null;
    if (containerRef.current) {
      resizeObserver = new ResizeObserver(() => {
        if (map) {
          map.resize();
        }
      });
      resizeObserver.observe(containerRef.current);
    }

    map.on("click", (event) => {
      const { lng, lat } = event.lngLat;
      const currentTool = activeToolRef.current;
      const handleMapClick = onMapClickRef.current;
      if (
        handleMapClick &&
        (currentTool === "add-point" || currentTool === "add-area-corners")
      ) {
        handleMapClick([lng, lat]);
      }

      // Feature selection for points and areas
      const features = map.queryRenderedFeatures(event.point, {
        layers: [POI_LAYER_ID, AREAS_FILL_LAYER_ID],
      });
      const feature = features[0];
      const handleFeatureSelect = onFeatureSelectRef.current;
      if (handleFeatureSelect) {
        const id =
          (feature?.properties?.id as string | undefined) ?? null;
        handleFeatureSelect(id);
      }
    });

    // Dragging logic for points and corners in move-geometry mode
    let isDragging = false;
    let dragType: "point" | "corner" | null = null;
    let dragPointId: string | null = null;
    let dragAreaId: string | null = null;
    let dragCornerKey: "nw" | "ne" | "se" | "sw" | null = null;

    const beginPointDrag = (event: any) => {
      if (activeToolRef.current !== "move-geometry") return;
      event.preventDefault();
      const feature = event.features?.[0];
      if (!feature) return;
      dragType = "point";
      dragPointId = feature.properties?.id as string;
      isDragging = true;
      map.getCanvas().style.cursor = "grabbing";
    };

    const beginCornerDrag = (event: any) => {
      if (activeToolRef.current !== "move-geometry") return;
      event.preventDefault();
      const feature = event.features?.[0];
      if (!feature) return;
      dragType = "corner";
      dragAreaId = feature.properties?.areaId as string;
      dragCornerKey = feature.properties?.cornerKey as
        | "nw"
        | "ne"
        | "se"
        | "sw";
      isDragging = true;
      map.getCanvas().style.cursor = "grabbing";
    };

    const handleMove = (event: any) => {
      if (!isDragging) return;
      const { lng, lat } = event.lngLat;
      if (dragType === "point" && dragPointId && onPointDragRef.current) {
        onPointDragRef.current(dragPointId, [lng, lat]);
      } else if (
        dragType === "corner" &&
        dragAreaId &&
        dragCornerKey &&
        onAreaCornerDragRef.current
      ) {
        onAreaCornerDragRef.current(dragAreaId, dragCornerKey, [lng, lat]);
      }
    };

    const endDrag = () => {
      if (!isDragging) return;
      isDragging = false;
      dragType = null;
      dragPointId = null;
      dragAreaId = null;
      dragCornerKey = null;
      map.getCanvas().style.cursor = "";
    };

    map.on("mousedown", POI_LAYER_ID, beginPointDrag as any);
    map.on("mousedown", CORNERS_LAYER_ID, beginCornerDrag as any);
    map.on("mousemove", handleMove as any);
    map.on("mouseup", endDrag as any);
    map.on("mouseleave", endDrag as any);

    mapRef.current = map;

    return () => {
      if (resizeObserver && containerRef.current) {
        resizeObserver.disconnect();
      }
      map.off("mousedown", POI_LAYER_ID, beginPointDrag as any);
      map.off("mousedown", CORNERS_LAYER_ID, beginCornerDrag as any);
      map.off("mousemove", handleMove as any);
      map.off("mouseup", endDrag as any);
      map.off("mouseleave", endDrag as any);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update sources when data changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const poiSource = map.getSource(POI_SOURCE_ID) as maplibregl.GeoJSONSource;
    if (poiSource) {
      poiSource.setData(pois as any);
    }

    const areaSource = map.getSource(
      AREAS_SOURCE_ID,
    ) as maplibregl.GeoJSONSource;
    if (areaSource) {
      areaSource.setData({
        type: "FeatureCollection",
        features: areas.map((area) => ({
          type: "Feature",
          properties: {
            id: area.id,
            category: area.category,
          },
          geometry: {
            type: "Polygon",
            coordinates: areaToPolygonCoordinates(area),
          },
        })),
      } as any);
    }

    const cornersSource = map.getSource(
      CORNERS_SOURCE_ID,
    ) as maplibregl.GeoJSONSource;
    if (cornersSource) {
      const cornerFeatures: any[] = [];
      areas.forEach((area) => {
        (["nw", "ne", "se", "sw"] as const).forEach((key) => {
          const [lng, lat] = area.corners[key];
          cornerFeatures.push({
            type: "Feature",
            properties: {
              id: `${area.id}::${key}`,
              areaId: area.id,
              cornerKey: key,
            },
            geometry: {
              type: "Point",
              coordinates: [lng, lat],
            },
          });
        });
      });
      cornersSource.setData({
        type: "FeatureCollection",
        features: cornerFeatures,
      } as any);
    }
  }, [pois, areas]);

  // Update selection-dependent styling without recreating the map
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const selected = selectedFeatureId ?? "";

    if (map.getLayer(POI_LAYER_ID)) {
      map.setPaintProperty(
        POI_LAYER_ID,
        "circle-radius",
        [
          "case",
          ["==", ["get", "id"], selected],
          7,
          5,
        ] as any,
      );
      map.setPaintProperty(
        POI_LAYER_ID,
        "circle-stroke-color",
        [
          "case",
          ["==", ["get", "id"], selected],
          "#ffffff",
          "#020617",
        ] as any,
      );
    }

    if (map.getLayer(AREAS_FILL_LAYER_ID)) {
      map.setPaintProperty(
        AREAS_FILL_LAYER_ID,
        "fill-opacity",
        [
          "case",
          ["==", ["get", "id"], selected],
          0.35,
          0.18,
        ] as any,
      );
    }

    if (map.getLayer(AREAS_LINE_LAYER_ID)) {
      map.setPaintProperty(
        AREAS_LINE_LAYER_ID,
        "line-color",
        [
          "case",
          ["==", ["get", "id"], selected],
          "#f9fafb",
          "#e5e7eb",
        ] as any,
      );
    }
  }, [selectedFeatureId]);

  return <div ref={containerRef} className="h-full w-full" />;
}

