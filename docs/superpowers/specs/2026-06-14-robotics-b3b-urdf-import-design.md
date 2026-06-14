# Robotics B3b — URDF Import (Design)

**Date:** 2026-06-14
**Status:** Approved design.
**Scope:** Second half of Tier B's URDF round-trip. Import a URDF **package** (the ZIP B3a export produces: `robot.urdf` + `meshes/*.stl`) back into a `LinkNode`/`JointNode` tree — the exact inverse of B3a, against the mapping B3a fixed.

---

## 1. Goal & scope

Load a chili3d-exported URDF ZIP and rebuild the editable kinematic tree, enabling round-trip (export → edit elsewhere → re-import) and loading robots authored in chili3d.

**In scope (B3b):** the chili3d-exported structure — STL meshes under `meshes/`, the link/joint mapping and unit conventions B3a defines. A pure `importUrdf`, the `.urdf` import wiring (unzip → parse → build → add), and a round-trip test.

**Out of scope (v1):** arbitrary external URDFs (DAE/OBJ meshes, `package://` paths, multiple visual/collision per link, Xacro), SRDF, and URDFs whose joints reference links in an order export never emits.

---

## 2. Architecture

A pure `importUrdf(urdf, meshes, document, converter): LinkNode | undefined` (mirrors `exportUrdf`'s injected-converter shape, so it is headlessly testable). The `.urdf` import path in `DefaultDataExchange` does the I/O: read the file → unzip → `{urdf string, meshes map}` → `importUrdf` → add the base link.

---

## 3. Components

### 3.1 `importUrdf` — `packages/builder/src/urdf/urdfImporter.ts`
Signature: `export function importUrdf(urdf: string, meshes: Map<string, Uint8Array>, document: IDocument, converter: IShapeConverter): LinkNode | undefined`.

- **Parse** via `DOMParser` (native in browser; provided by happy-dom in tests): `new DOMParser().parseFromString(urdf, "application/xml")`. Read `<robot>` → `<link>` elements (name; `<visual><geometry><mesh filename mass>`) and `<joint>` elements (name, `type`, `<parent link>`, `<child link>`, `<origin xyz rpy>`, `<axis xyz>`, `<limit lower upper>`).
- **Build links:** per `<link>`, create a `LinkNode` (name, `mass` from `<inertial><mass value>` default 1). For its `<mesh filename="meshes/<f>.stl">`, `converter.convertFromSTL(document, meshes.get("<f>.stl"))` → a `FolderNode` of geometry; move its children into the `LinkNode`. A link with no mesh → empty `LinkNode`.
- **Build joints + tree:** `base_link` = the link that is no joint's `child`. For each `<joint>`: create a `JointNode` (jointType from URDF type; axis from `<axis xyz>`; origin = `Matrix4` from xyz+rpy; limits) and nest `parentLink → JointNode → childLink` (the export tree shape). Return the base `LinkNode`.
- **Units (inverse of export):** xyz and prismatic limits **m→mm (×1000)**; revolute/continuous limits + rpy **rad→deg**. The mm STL + URDF `scale="0.001"` round-trips to mm, so the imported mesh is kept **as-is** (no extra scaling).
- **Origin reconstruction:** `Matrix4` from translation (xyz ×1000) and rotation (rpy). For the common authored case the joint origin is a pure translation (rpy = 0 0 0), so `Matrix4.fromTranslation(...)` suffices; rotated origins compose translation with `Matrix4.fromEuler` — the plan verifies `fromEuler` inverts B3a's `getEulerAngles` ordering. **Note the `Matrix4.multiply` "this-first" convention** (learned in B2) when composing.

### 3.2 Wiring — `packages/builder/src/defaultDataExchange.ts`
- Add `.urdf` to `importFormats()`.
- In `import(document, files)`, when a `.urdf` file is selected: read its bytes (`await file.arrayBuffer()`), `JSZip.loadAsync(bytes)` → extract `robot.urdf` (`.async("string")`) and each `meshes/*` (`.async("uint8array")`) into a `Map`; `importUrdf(...)` → `modelManager.addNode(baseLink)`.
- (The exported file is a zip named `.urdf`; import reads it as a zip. If a future plain `.urdf` is needed, that is a separate enhancement.)

---

## 4. Data flow
`pick .urdf (zip) → arrayBuffer → JSZip.loadAsync → {robot.urdf text, meshes map} → importUrdf: DOMParser → links+joints → LinkNodes (with STL geometry) + JointNodes (m→mm, rad→deg) nested into the tree → modelManager.addNode(base_link).`

---

## 5. Error handling & edge cases
- Not a zip / no `robot.urdf` inside → toast error, abort.
- A `<joint>` referencing an unknown parent/child link name → skip that joint with a warning (don't crash).
- A `<mesh>` whose file is missing from `meshes` → create the link without geometry (kinematic-only) rather than failing.
- No base link found (every link is some joint's child — a cycle, which export never emits) → toast error, abort.
- `convertFromSTL` failure on a mesh → link without geometry + warning.

---

## 6. Testing
**Round-trip** (headless, real WASM kernel, happy-dom DOMParser):
- Build `base_link (LinkNode + 20mm box) → revolute JointNode(axis Z, origin (100,0,0)mm, limits ±90°) → child_link (LinkNode + 10mm box)`.
- `exportUrdf(base, "robot", converter)` → `{urdf, meshes}`.
- `importUrdf(urdf, meshes, doc2, converter)` → `base2: LinkNode`.
- Assert: `base2` is a `LinkNode` named `base_link` with geometry; it has a child `JointNode` of type `revolute`, axis `(0,0,1)`, `lowerLimit ≈ -90` / `upperLimit ≈ 90` (**degrees**), origin translation `≈ (100,0,0)` (**mm**); the joint's child is a `LinkNode` named `child_link` with geometry.
- A parse-only unit test: a hand-written minimal URDF string (one fixed joint) imports to the expected node types without meshes.
(ROS-authored URDFs are a manual follow-up; v1 targets the round-trip.)

---

## 7. Files
| File | Action |
|------|--------|
| `packages/builder/src/urdf/urdfImporter.ts` | Create (`importUrdf`) |
| `packages/builder/test/urdfImporter.test.ts` | Create (round-trip + parse test) |
| `packages/builder/src/defaultDataExchange.ts` | `.urdf` in `importFormats()` + unzip/import wiring |

---

## 8. Completes the round-trip
B3a (export) + B3b (import) = full URDF round-trip on the chili3d-authored kinematic model. General external-URDF import (DAE, package://, xacro) remains a future enhancement beyond Tier B.
