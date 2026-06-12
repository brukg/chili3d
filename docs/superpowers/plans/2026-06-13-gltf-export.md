# glTF Export (A8) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Checkbox (`- [ ]`) steps.

**Goal:** Add glTF export (binary `.glb` and JSON `.gltf`) to Chili3D, mirroring the existing OBJ/PLY mesh export via Three.js's `GLTFExporter`.

**Architecture:** Add `exportToGltf(nodes, binary): Promise<Result<BlobPart>>` to the `IMeshExporter` interface (core) and implement it in `ThreeMeshExporter` (three) using `GLTFExporter.parseAsync`. Then register `.gltf`/`.glb` in `DefaultDataExchange.exportFormats()` and dispatch them in the already-`async` `export()` method. PURE TYPESCRIPT — no WASM rebuild.

**Why this is distinct (not redundant):** the roadmap's A4 "pipe" was dropped — chili3d already has `PipeNode` + `sweep()`. glTF export is genuinely new (current exports: STEP/IGES/BREP/STL/PLY/OBJ) and high-value for web/robotics viewers.

**References:** `packages/three/src/meshExporter.ts` (the `exportToObj`/`exportToPly` pattern + `parseNodeToGroup`/`disposeObject` helpers), `packages/core/src/visual/meshExporter.ts` (interface), `packages/builder/src/defaultDataExchange.ts:22` (`exportFormats`) + `:88` (`export` dispatch). `ThreeMeshExporter` is the ONLY implementer of `IMeshExporter` (verified). `GLTFExporter` headless feasibility (binary + JSON in Happy-DOM/Node) was probe-verified to pass.

**Note on async:** `exportToGltf` is async (GLTFExporter is async; the others are sync). `export()` is already `async`, so awaiting fits cleanly. The interface gains one Promise-returning method alongside the sync ones — acceptable.

---

## File Structure
| File | Action |
|------|--------|
| `packages/three/test/gltfExport.test.ts` | Create (test) |
| `packages/core/src/visual/meshExporter.ts` | Modify (interface method) |
| `packages/three/src/meshExporter.ts` | Modify (impl + import) |
| `packages/builder/src/defaultDataExchange.ts` | Modify (format list + dispatch) |

---

## Task 1: Failing test
Create `packages/three/test/gltfExport.test.ts`:
```ts
// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import type { VisualNode } from "@chili3d/core";
import { describe, expect, test } from "@rstest/core";
import { BoxGeometry, Mesh, MeshStandardMaterial } from "three";
import { ThreeMeshExporter } from "../src/meshExporter";
import type { ThreeVisualContext } from "../src/threeVisualContext";

// parseNodeToGroup() calls content.getVisual(node) and collects Mesh children,
// so a stub context returning a Three.js Mesh exercises the real export wrapper
// without needing the full WASM-meshed visual pipeline.
function makeExporter() {
    const mesh = new Mesh(new BoxGeometry(10, 10, 10), new MeshStandardMaterial());
    const content = { getVisual: () => mesh } as unknown as ThreeVisualContext;
    return new ThreeMeshExporter(content);
}
const fakeNode = {} as VisualNode;

describe("glTF export", () => {
    test("exports a non-empty binary .glb (ArrayBuffer)", async () => {
        const result = await makeExporter().exportToGltf([fakeNode], true);
        expect(result.isOk).toBe(true);
        expect((result.value as ArrayBuffer).byteLength).toBeGreaterThan(0);
    });

    test("exports a JSON .gltf string containing the glTF asset header", async () => {
        const result = await makeExporter().exportToGltf([fakeNode], false);
        expect(result.isOk).toBe(true);
        expect(typeof result.value).toBe("string");
        expect(result.value as string).toContain("asset");
    });
});
```
Run `npx rstest packages/three/test/gltfExport.test.ts` → FAIL (`exportToGltf` does not exist).

## Task 2: Interface method
In `packages/core/src/visual/meshExporter.ts`, add to the `IMeshExporter` interface (after `exportToObj`):
```ts
    exportToGltf(node: VisualNode[], binary: boolean): Promise<Result<BlobPart>>;
```

## Task 3: Implementation
In `packages/three/src/meshExporter.ts`:
- Add the import (with the other exporter imports):
```ts
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
```
- Add the method to `ThreeMeshExporter` (after `exportToObj`, before the private `disposeObject`):
```ts
    async exportToGltf(nodes: VisualNode[], binary: boolean): Promise<Result<BlobPart>> {
        const exporter = new GLTFExporter();
        const group = this.parseNodeToGroup(nodes);
        try {
            const result = await exporter.parseAsync(group, { binary });
            return Result.ok(binary ? (result as ArrayBuffer as BlobPart) : (JSON.stringify(result) as BlobPart));
        } catch (e) {
            return Result.err(`can not export to gltf: ${e}`);
        } finally {
            this.disposeObject(group);
        }
    }
```
`Result`, `VisualNode`, `parseNodeToGroup`, `disposeObject` are already in this file. Run `npx rstest packages/three/test/gltfExport.test.ts` → both tests PASS.

## Task 4: Register the export formats + dispatch
In `packages/builder/src/defaultDataExchange.ts`:
- In `exportFormats()` (line ~22), append `".gltf"` and `".glb"`:
```ts
    exportFormats(): string[] {
        return [".step", ".iges", ".brep", ".stl", ".stl binary", ".ply", ".ply binary", ".obj", ".gltf", ".glb"];
    }
```
- In `export()` (line ~88), add two branches immediately after the `else if (type === ".obj")` branch and before the final `else {`:
```ts
        } else if (type === ".gltf") {
            shapeResult = await document.visual.meshExporter.exportToGltf(nodes, false);
        } else if (type === ".glb") {
            shapeResult = await document.visual.meshExporter.exportToGltf(nodes, true);
```
(`export()` is already `async`, so `await` is valid. `shapeResult` is `Result<BlobPart> | undefined`; the awaited `Result<BlobPart>` assigns cleanly.)

## Task 5: Verify + commit
- `npx rstest packages/three/test/gltfExport.test.ts` → PASS (2 tests).
- `npm run build 2>&1 | grep -iE "error|gltf" | head` → no `error` lines.
- `npm run check` → ⚠️ reformats unrelated files repo-wide; `git status --short` and `git add` ONLY the 4 intended files.
```bash
git add packages/three/test/gltfExport.test.ts packages/core/src/visual/meshExporter.ts packages/three/src/meshExporter.ts packages/builder/src/defaultDataExchange.ts
git commit -m "✨ feat(three): add glTF/GLB export"
```

---

## Self-Review
- **Spec coverage:** interface (T2), impl (T3), format registration + dispatch (T4), test (T1/3). ✅
- **Placeholders:** none; `GLTFExporter` headless behavior probe-verified; single `IMeshExporter` implementer confirmed (no other class breaks).
- **Type consistency:** `exportToGltf(node: VisualNode[], binary: boolean): Promise<Result<BlobPart>>` identical in interface (T2), impl (T3), and both call sites in `export()` (T4). Binary→ArrayBuffer, JSON→`JSON.stringify(...)` string — both valid `BlobPart`.
- **Known notes (no fix):** export only (no glTF import); textures/PBR materials beyond what the Three.js visual carries are out of scope; `.glb` is the binary single-file form, `.gltf` the JSON form (no external .bin — GLTFExporter embeds buffers).
