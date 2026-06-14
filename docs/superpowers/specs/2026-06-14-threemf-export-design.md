# 3MF Export (Design)

**Date:** 2026-06-14
**Status:** Approved (proceeding under standing "continue, you are the expert" authorization).
**Scope:** Tier A roadmap item A8 — add `.3mf` (3D Manufacturing Format) export. Makes chili3d models (incl. robot links) directly 3D-printable in the modern, color/units-aware successor to STL.

---

## 1. Goal & scope
Export selected solids to a valid 3MF package (a ZIP of XML parts). **In scope:** geometry — a single merged mesh object, `millimeter` units, the three required OPC parts. **Out of scope (v1):** per-shape objects, color/materials, build transforms, beam/lattice extensions.

## 2. Architecture
Follow the **headless STL philosophy** already in the codebase (`exportStl` uses the OCCT converter, not the Three.js visual exporter, "so the same path works in the browser and the MCP server"). A pure, kernel-backed pipeline:

`shapes → converter.convertToSTL(binary) → parse triangles → dedup into an indexed mesh → 3MF model XML → ZIP the OPC parts → Uint8Array`.

This is fully headless and unit-testable with the real WASM kernel (mirrors `urdfExporter.test.ts`).

## 3. Components
### 3.1 `packages/builder/src/threemf/threeMfExporter.ts`
- `stlToIndexedMesh(stl: Uint8Array): { vertices: number[]; triangles: number[] }` — parse binary STL (80-byte header, `uint32` triangle count, then 50-byte records: normal[3]+v1[3]+v2[3]+v3[3] float32 LE + 2-byte attr), dedup coincident vertices via a `Map` keyed by exact `x,y,z`, emit flat `vertices` (x,y,z,…) and `triangles` (i,j,k,…).
- `buildModelXml({ vertices, triangles }): string` — the `3D/3dmodel.model` content: `<model unit="millimeter" …>` with one `<object id="1" type="model"><mesh>` of `<vertex>`/`<triangle>`, and a `<build><item objectid="1"/></build>`.
- `exportThreeMf(shapes, converter): Promise<Result<Uint8Array>>` — orchestrates the pipeline and ZIPs the parts (`[Content_Types].xml`, `_rels/.rels`, `3D/3dmodel.model`) via `jszip`.

### 3.2 Wiring — `packages/builder/src/defaultDataExchange.ts`
- Add `".3mf"` to `exportFormats()`.
- In `export(type, nodes)`: `else if (type === ".3mf") return await this.exportThreeMfFile(nodes);` — a helper that pulls shapes via `getExportShapes(nodes)`, gets the converter, calls `exportThreeMf`, and returns `[bytes]` (mirrors `exportUrdfZip`).

## 4. Units & format
chili3d is mm; 3MF default/declared unit `millimeter` → coordinates emitted as-is. Coordinates formatted to ≤6 decimals.

## 5. Error handling
- `convertToSTL` failure → propagate `Result.err`.
- No exportable shapes → toast `error.export.noNodeCanBeExported` (reuse the existing `getExportShapes` path) and return `undefined`.

## 6. Testing
Headless, real WASM: mesh a 10mm box, `exportThreeMf([box], converter)`, unzip, assert `3D/3dmodel.model` contains `unit="millimeter"`, **8 vertices + 12 triangles** (a flat box dedups to 8 corners / 12 facets — verifies the indexing), and that `[Content_Types].xml` and `_rels/.rels` exist. (If OCCT's default deflection subdivides flat faces, relax the counts to `≥8`/`≥12` and document it.)

## 7. Files
| File | Action |
|------|--------|
| `packages/builder/src/threemf/threeMfExporter.ts` | Create |
| `packages/builder/test/threeMfExporter.test.ts` | Create |
| `packages/builder/src/defaultDataExchange.ts` | `.3mf` in `exportFormats()` + `exportThreeMfFile` wiring |
