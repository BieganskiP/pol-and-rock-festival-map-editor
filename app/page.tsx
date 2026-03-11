"use client";

import { MapEditorShell } from "@/src/map/MapEditorShell";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-50">
      <header className="border-b border-zinc-800 bg-zinc-900/80 px-6 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <div className="flex flex-col">
            <h1 className="text-lg font-semibold tracking-tight">
              Edytor mapy festiwalu
            </h1>
            <p className="text-xs text-zinc-400">
              Dodawaj punkty i strefy w granicach festiwalu i eksportuj gotową
              konfigurację JSON zgodną z{" "}
              <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px]">
                map-config-spec.md
              </code>
              .
            </p>
          </div>
        </div>
      </header>
      <main className="flex flex-1 flex-col">
        <MapEditorShell />
      </main>
    </div>
  );
}
