"use client";

import { useState, useMemo } from "react";
import {
  type AreaConfig,
  type EditorExportPayload,
  type EditorPoint,
  type FestivalPoisGeoJSON,
  type LngLatTuple,
  type PayloadValidationIssue,
  clampToBounds,
  validateEditorPayload,
} from "./types";
import { MAP_MAX_BOUNDS, POI_COLORS } from "./constants";
import { EditorMap, type EditorTool } from "./EditorMap";

interface MapEditorShellProps {
  onImportValidation?: (issues: PayloadValidationIssue[]) => void;
}

interface PendingArea {
  id: string;
  category: string;
  name_pl: string;
  name_en: string;
  corners: Partial<AreaConfig["corners"]>;
}

const CATEGORY_OPTIONS = [
  "stage",
  "medical",
  "food",
  "toilet",
  "info",
  "camping",
  "parking",
  "entrance",
  "water",
  "charging",
] as const;

function createEmptyGeoJSON(): FestivalPoisGeoJSON {
  return {
    type: "FeatureCollection",
    features: [],
  };
}

let pointCounter = 1;
let areaCounter = 1;

export function MapEditorShell({ onImportValidation }: MapEditorShellProps) {
  const [points, setPoints] = useState<EditorPoint[]>([]);
  const [areas, setAreas] = useState<AreaConfig[]>([]);
  const [activeTool, setActiveTool] = useState<EditorTool>("edit-attributes");
  const [pendingArea, setPendingArea] = useState<PendingArea | null>(null);
  const [selectedFeatureId, setSelectedFeatureId] = useState<string | null>(
    null,
  );
  const [exportJson, setExportJson] = useState<string>("");

  const poisGeoJSON: FestivalPoisGeoJSON = useMemo(() => {
    if (points.length === 0) return createEmptyGeoJSON();
    return {
      type: "FeatureCollection",
      features: points.map((p) => ({
        type: "Feature" as const,
        properties: {
          id: p.id,
          category: p.category,
          name_pl: p.name_pl,
          name_en: p.name_en,
        },
        geometry: {
          type: "Point" as const,
          coordinates: p.coordinates,
        },
      })),
    };
  }, [points]);

  const handleMapClick = (lngLat: LngLatTuple) => {
    const clamped = clampToBounds(lngLat, MAP_MAX_BOUNDS);

    if (activeTool === "add-point") {
      const id = `poi-${pointCounter++}`;
      const newPoint: EditorPoint = {
        id,
        category: "info",
        name_pl: "",
        name_en: "",
        coordinates: clamped,
      };
      setPoints((prev) => [...prev, newPoint]);
      setSelectedFeatureId(id);
      return;
    }

    if (activeTool === "add-area-corners") {
      setPendingArea((current) => {
        const base: PendingArea =
          current ?? {
            id: `area-${areaCounter}`,
            category: "stage",
            name_pl: "",
            name_en: "",
            corners: {},
          };

        const corners = base.corners;
        const order: (keyof AreaConfig["corners"])[] = ["nw", "ne", "se", "sw"];
        const nextKey = order.find((key) => !corners[key]);

        if (!nextKey) {
          return base;
        }

        const updatedCorners = {
          ...corners,
          [nextKey]: clamped,
        };

        const updated: PendingArea = {
          ...base,
          corners: updatedCorners,
        };

        if (order.every((key) => updatedCorners[key])) {
          const completeCorners = updatedCorners as AreaConfig["corners"];
          const area: AreaConfig = {
            id: updated.id,
            category: updated.category,
            name_pl: updated.name_pl,
            name_en: updated.name_en,
            corners: completeCorners,
          };
          setAreas((prev) => {
            if (prev.some((existing) => existing.id === area.id)) {
              return prev;
            }
            return [...prev, area];
          });
          setSelectedFeatureId(area.id);
          areaCounter += 1;
          setActiveTool("idle");
          return null;
        }

        return updated;
      });
    }
  };

  const handleFeatureSelect = (featureId: string | null) => {
    setSelectedFeatureId(featureId);
  };

  const selectedPoint = points.find((p) => p.id === selectedFeatureId);
  const selectedArea = areas.find((a) => a.id === selectedFeatureId);

  const handlePointChange = (id: string, partial: Partial<EditorPoint>) => {
    setPoints((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...partial } : p)),
    );
  };

  const handleDeletePoint = (id: string) => {
    setPoints((prev) => prev.filter((p) => p.id !== id));
    if (selectedFeatureId === id) {
      setSelectedFeatureId(null);
    }
  };

  const handleAreaChange = (id: string, partial: Partial<AreaConfig>) => {
    setAreas((prev) =>
      prev.map((a) =>
        a.id === id
          ? {
              ...a,
              ...partial,
              corners: partial.corners
                ? { ...a.corners, ...partial.corners }
                : a.corners,
            }
          : a,
      ),
    );
  };

  const handleDeleteArea = (id: string) => {
    setAreas((prev) => prev.filter((a) => a.id !== id));
    if (selectedFeatureId === id) {
      setSelectedFeatureId(null);
    }
  };

  const handlePointDrag = (id: string, lngLat: LngLatTuple) => {
    const clamped = clampToBounds(lngLat, MAP_MAX_BOUNDS);
    setPoints((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, coordinates: clamped } : p,
      ),
    );
  };

  const handleAreaCornerDrag = (
    areaId: string,
    cornerKey: "nw" | "ne" | "se" | "sw",
    lngLat: LngLatTuple,
  ) => {
    const clamped = clampToBounds(lngLat, MAP_MAX_BOUNDS);
    setAreas((prev) =>
      prev.map((area) =>
        area.id === areaId
          ? {
              ...area,
              corners: {
                ...area.corners,
                [cornerKey]: clamped,
              },
            }
          : area,
      ),
    );
  };

  const handleExport = () => {
    const payload: EditorExportPayload = {
      points,
      areas,
      displayConfig: {
        enablePoints: true,
        enableAreas: true,
        pointIds: [],
        areaIds: [],
      },
    };

    const seenIds = new Set<string>();
    const duplicateIds: string[] = [];
    [...points, ...areas].forEach((item) => {
      if (seenIds.has(item.id)) {
        duplicateIds.push(item.id);
      } else {
        seenIds.add(item.id);
      }
    });

    if (duplicateIds.length > 0) {
      alert(
        `Nie można wyeksportować: zduplikowane identyfikatory (${Array.from(
          new Set(duplicateIds),
        ).join(", ")}).`,
      );
      return;
    }

    const pretty = JSON.stringify(payload, null, 2);
    setExportJson(pretty);

    const blob = new Blob([pretty], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "festival-map-config.json";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImportFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const raw = reader.result as string;
        const parsed = JSON.parse(raw);
        const ok = validateEditorPayload(parsed);
        const issues: PayloadValidationIssue[] =
          (parsed as any).__validationIssues ?? [];

        if (!ok) {
          onImportValidation?.(issues);
          alert(
            "Zaimportowany plik ma problemy walidacyjne. Szczegóły w żółtym komunikacie nad mapą.",
          );
        } else {
          onImportValidation?.([]);
        }

        const payload = parsed as EditorExportPayload;
        setPoints(payload.points ?? []);
        setAreas(payload.areas ?? []);
        // displayConfig is always exported with defaults, so we just ignore it here
        setExportJson(JSON.stringify(payload, null, 2));
      } catch (error) {
        console.error(error);
        alert("Nie udało się odczytać pliku JSON.");
      }
    };
    reader.readAsText(file, "utf-8");
  };

  return (
    <div className="relative flex-1 min-h-[calc(100vh-96px)]">
      <div className="absolute inset-0">
        <EditorMap
          pois={poisGeoJSON}
          areas={areas}
          activeTool={activeTool}
          selectedFeatureId={selectedFeatureId}
          onMapClick={handleMapClick}
          onFeatureSelect={handleFeatureSelect}
          onPointDrag={handlePointDrag}
          onAreaCornerDrag={handleAreaCornerDrag}
        />
      </div>

      {/* Right side panel for POIs and areas */}
      <aside className="pointer-events-none absolute inset-y-4 right-4 flex w-80 max-w-full flex-col gap-3">
        <section className="pointer-events-auto max-h-[55vh] overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/90 p-3 backdrop-blur">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
              Punkty
            </h2>
            <span className="text-[10px] text-zinc-500">
              {points.length} element
              {points.length === 1 ? "" : "y"}
            </span>
          </div>
          <div className="max-h-44 space-y-1.5 overflow-auto pr-1">
            {points.map((point) => (
              <button
                key={point.id}
                type="button"
                onClick={() => setSelectedFeatureId(point.id)}
                className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-[11px] ${
                  selectedFeatureId === point.id
                    ? "bg-zinc-800 text-zinc-50"
                    : "bg-zinc-900/40 text-zinc-300 hover:bg-zinc-800/80"
                }`}
              >
                <span className="truncate font-mono text-[10px]">
                  {point.id}
                </span>
                <span className="ml-2 inline-flex items-center gap-1">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{
                      backgroundColor: POI_COLORS[point.category] ?? "#22c55e",
                    }}
                  />
                  <span className="truncate text-[10px] text-zinc-400">
                    {point.category}
                  </span>
                </span>
              </button>
            ))}
            {points.length === 0 && (
              <p className="text-[11px] text-zinc-500">
                Brak punktów. Włącz{" "}
                <span className="font-semibold text-zinc-300">
                  Dodaj punkt
                </span>{" "}
                i kliknij na mapie.
              </p>
            )}
          </div>
          {selectedPoint && (
            <div className="mt-2 space-y-1.5 rounded-md border border-zinc-800 bg-zinc-950/60 p-2">
              <p className="text-[11px] font-medium text-zinc-200">
                Edycja punktu
              </p>
              <label className="flex flex-col gap-0.5 text-[10px] text-zinc-400">
                ID (unikalne)
                <input
                  type="text"
                  value={selectedPoint.id}
                  onChange={(event) =>
                    handlePointChange(selectedPoint.id, {
                      id: event.target.value,
                    })
                  }
                  className="rounded border border-zinc-700 bg-zinc-900 px-1.5 py-1 text-[11px] text-zinc-50 outline-none focus:border-emerald-500"
                />
              </label>
              <label className="flex flex-col gap-0.5 text-[10px] text-zinc-400">
                Kategoria
                <select
                  value={selectedPoint.category}
                  onChange={(event) =>
                    handlePointChange(selectedPoint.id, {
                      category: event.target.value,
                    })
                  }
                  className="rounded border border-zinc-700 bg-zinc-900 px-1.5 py-1 text-[11px] text-zinc-50 outline-none focus:border-emerald-500"
                >
                  {CATEGORY_OPTIONS.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                <label className="flex flex-col gap-0.5 text-[10px] text-zinc-400">
                  Nazwa (PL)
                  <input
                    type="text"
                    value={selectedPoint.name_pl}
                    onChange={(event) =>
                      handlePointChange(selectedPoint.id, {
                        name_pl: event.target.value,
                      })
                    }
                    className="rounded border border-zinc-700 bg-zinc-900 px-1.5 py-1 text-[11px] text-zinc-50 outline-none focus:border-emerald-500"
                  />
                </label>
                <label className="flex flex-col gap-0.5 text-[10px] text-zinc-400">
                  Nazwa (EN)
                  <input
                    type="text"
                    value={selectedPoint.name_en}
                    onChange={(event) =>
                      handlePointChange(selectedPoint.id, {
                        name_en: event.target.value,
                      })
                    }
                    className="rounded border border-zinc-700 bg-zinc-900 px-1.5 py-1 text-[11px] text-zinc-50 outline-none focus:border-emerald-500"
                  />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <label className="flex flex-col gap-0.5 text-[10px] text-zinc-400">
                  Długość (lng)
                  <input
                    type="number"
                    step="0.000001"
                    value={selectedPoint.coordinates[0]}
                    onChange={(event) =>
                      handlePointChange(selectedPoint.id, {
                        coordinates: [
                          Number(event.target.value),
                          selectedPoint.coordinates[1],
                        ],
                      })
                    }
                    className="rounded border border-zinc-700 bg-zinc-900 px-1.5 py-1 text-[11px] text-zinc-50 outline-none focus:border-emerald-500"
                  />
                </label>
                <label className="flex flex-col gap-0.5 text-[10px] text-zinc-400">
                  Szerokość (lat)
                  <input
                    type="number"
                    step="0.000001"
                    value={selectedPoint.coordinates[1]}
                    onChange={(event) =>
                      handlePointChange(selectedPoint.id, {
                        coordinates: [
                          selectedPoint.coordinates[0],
                          Number(event.target.value),
                        ],
                      })
                    }
                    className="rounded border border-zinc-700 bg-zinc-900 px-1.5 py-1 text-[11px] text-zinc-50 outline-none focus:border-emerald-500"
                  />
                </label>
              </div>
              <button
                type="button"
                onClick={() => handleDeletePoint(selectedPoint.id)}
                className="mt-1 inline-flex items-center justify-center rounded-md bg-red-500/90 px-2 py-1 text-[11px] font-semibold text-zinc-50 hover:bg-red-400"
              >
                Usuń punkt
              </button>
            </div>
          )}
        </section>

        <section className="pointer-events-auto max-h-[40vh] overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/90 p-3 backdrop-blur">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
              Strefy
            </h2>
            <span className="text-[10px] text-zinc-500">
              {areas.length} element
              {areas.length === 1 ? "" : "y"}
            </span>
          </div>
          <div className="max-h-40 space-y-1.5 overflow-auto pr-1">
            {areas.map((area) => (
              <button
                key={area.id}
                type="button"
                onClick={() => setSelectedFeatureId(area.id)}
                className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-[11px] ${
                  selectedFeatureId === area.id
                    ? "bg-zinc-800 text-zinc-50"
                    : "bg-zinc-900/40 text-zinc-300 hover:bg-zinc-800/80"
                }`}
              >
                <span className="truncate font-mono text-[10px]">
                  {area.id}
                </span>
                <span className="truncate text-[10px] text-zinc-400">
                  {area.category}
                </span>
              </button>
            ))}
            {areas.length === 0 && (
              <p className="text-[11px] text-zinc-500">
                Brak stref. Użyj{" "}
                <span className="font-semibold text-zinc-300">
                  Dodaj strefę (4 narożniki)
                </span>{" "}
                i kliknij 4 razy na mapie.
              </p>
            )}
          </div>
          {selectedArea && (
            <div className="mt-2 space-y-1.5 rounded-md border border-zinc-800 bg-zinc-950/60 p-2">
              <p className="text-[11px] font-medium text-zinc-200">
                Edycja strefy
              </p>
              <label className="flex flex-col gap-0.5 text-[10px] text-zinc-400">
                ID (unikalne)
                <input
                  type="text"
                  value={selectedArea.id}
                  onChange={(event) =>
                    handleAreaChange(selectedArea.id, {
                      id: event.target.value,
                    })
                  }
                  className="rounded border border-zinc-700 bg-zinc-900 px-1.5 py-1 text-[11px] text-zinc-50 outline-none focus:border-sky-500"
                />
              </label>
              <label className="flex flex-col gap-0.5 text-[10px] text-zinc-400">
                Kategoria
                <select
                  value={selectedArea.category}
                  onChange={(event) =>
                    handleAreaChange(selectedArea.id, {
                      category: event.target.value,
                    })
                  }
                  className="rounded border border-zinc-700 bg-zinc-900 px-1.5 py-1 text-[11px] text-zinc-50 outline-none focus:border-sky-500"
                >
                  {CATEGORY_OPTIONS.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                <label className="flex flex-col gap-0.5 text-[10px] text-zinc-400">
                  Nazwa (PL)
                  <input
                    type="text"
                    value={selectedArea.name_pl}
                    onChange={(event) =>
                      handleAreaChange(selectedArea.id, {
                        name_pl: event.target.value,
                      })
                    }
                    className="rounded border border-zinc-700 bg-zinc-900 px-1.5 py-1 text-[11px] text-zinc-50 outline-none focus:border-sky-500"
                  />
                </label>
                <label className="flex flex-col gap-0.5 text-[10px] text-zinc-400">
                  Nazwa (EN)
                  <input
                    type="text"
                    value={selectedArea.name_en}
                    onChange={(event) =>
                      handleAreaChange(selectedArea.id, {
                        name_en: event.target.value,
                      })
                    }
                    className="rounded border border-zinc-700 bg-zinc-900 px-1.5 py-1 text-[11px] text-zinc-50 outline-none focus:border-sky-500"
                  />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {(["nw", "ne", "se", "sw"] as const).map((key) => (
                  <div key={key} className="space-y-0.5">
                    <p className="text-[10px] font-medium text-zinc-300">
                      Narożnik {key.toUpperCase()}
                    </p>
                    <div className="grid grid-cols-2 gap-1">
                      <input
                        type="number"
                        step="0.000001"
                        value={selectedArea.corners[key][0]}
                        onChange={(event) =>
                          handleAreaChange(selectedArea.id, {
                            corners: {
                              [key]: [
                                Number(event.target.value),
                                selectedArea.corners[key][1],
                              ],
                            } as any,
                          })
                        }
                        className="rounded border border-zinc-700 bg-zinc-900 px-1.5 py-1 text-[11px] text-zinc-50 outline-none focus:border-sky-500"
                      />
                      <input
                        type="number"
                        step="0.000001"
                        value={selectedArea.corners[key][1]}
                        onChange={(event) =>
                          handleAreaChange(selectedArea.id, {
                            corners: {
                              [key]: [
                                selectedArea.corners[key][0],
                                Number(event.target.value),
                              ],
                            } as any,
                          })
                        }
                        className="rounded border border-zinc-700 bg-zinc-900 px-1.5 py-1 text-[11px] text-zinc-50 outline-none focus:border-sky-500"
                      />
                    </div>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => handleDeleteArea(selectedArea.id)}
                className="mt-1 inline-flex items-center justify-center rounded-md bg-red-500/90 px-2 py-1 text-[11px] font-semibold text-zinc-50 hover:bg-red-400"
              >
                Usuń strefę
              </button>
            </div>
          )}
        </section>
      </aside>

      {/* Bottom toolbar */}
      <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center px-4">
        <div className="pointer-events-auto flex w-full max-w-3xl flex-wrap items-center justify-between gap-3 rounded-full border border-zinc-800 bg-zinc-900/90 px-3 py-2 text-[11px] text-zinc-200 backdrop-blur">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                setActiveTool("add-point");
                setPendingArea(null);
              }}
              className={`inline-flex items-center rounded-full px-2.5 py-1 font-medium ${
                activeTool === "add-point"
                  ? "bg-emerald-500 text-zinc-950"
                  : "bg-zinc-800 text-zinc-100 hover:bg-zinc-700"
              }`}
            >
              Dodaj punkt
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTool("add-area-corners");
                setPendingArea(null);
              }}
              className={`inline-flex items-center rounded-full px-2.5 py-1 font-medium ${
                activeTool === "add-area-corners"
                  ? "bg-sky-500 text-zinc-950"
                  : "bg-zinc-800 text-zinc-100 hover:bg-zinc-700"
              }`}
            >
              Dodaj strefę
            </button>
            <button
              type="button"
              onClick={() => setActiveTool("edit-attributes")}
              className={`inline-flex items-center rounded-full px-2.5 py-1 font-medium ${
                activeTool === "edit-attributes"
                  ? "bg-zinc-100 text-zinc-900"
                  : "bg-zinc-800 text-zinc-100 hover:bg-zinc-700"
              }`}
            >
              Edytuj dane
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTool("move-geometry");
                setPendingArea(null);
              }}
              className={`inline-flex items-center rounded-full px-2.5 py-1 font-medium ${
                activeTool === "move-geometry"
                  ? "bg-amber-400 text-zinc-950"
                  : "bg-zinc-800 text-zinc-100 hover:bg-zinc-700"
              }`}
            >
              Przesuwaj punkty / narożniki
            </button>
          </div>
          <div className="flex items-center gap-1.5">
            <label className="inline-flex cursor-pointer items-center rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 font-medium text-zinc-100 hover:border-zinc-500">
              <input
                type="file"
                accept="application/json"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) handleImportFile(file);
                }}
              />
              Importuj JSON
            </label>
            <button
              type="button"
              onClick={handleExport}
              className="inline-flex items-center rounded-full bg-emerald-500 px-3 py-1 font-semibold text-zinc-950 shadow hover:bg-emerald-400"
            >
              Eksportuj JSON
            </button>
          </div>
        </div>
      </div>

      {/* Compact export preview (optional) */}
      <div className="pointer-events-none absolute left-4 top-4 hidden max-w-md md:block">
        <div className="pointer-events-auto max-h-40 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950/90 p-3 text-[10px] text-zinc-300 backdrop-blur">
          <p className="mb-1 font-medium text-zinc-200">
            Podgląd eksportu (tylko do odczytu)
          </p>
          <pre className="max-h-28 overflow-auto whitespace-pre-wrap rounded bg-zinc-900/80 p-2 font-mono text-[9px] text-zinc-300">
            {exportJson ||
              "// Wyeksportowany JSON pojawi się tutaj po wykonaniu eksportu."}
          </pre>
        </div>
      </div>
    </div>
  );
}

