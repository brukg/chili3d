# Hole Feature (A1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Hole" modify command that drills a blind cylindrical hole into a selected solid, using OCCT's `BRepFeat_MakeCylindricalHole`.

**Architecture:** New bound C++ factory op `makeHole` (location + direction + radius + depth) → exposed via Emscripten → wrapped in the TS `ShapeFactory` and `IShapeFactory` interface → driven by a `HoleCommand` (a `MultistepCommand`: select a face for direction + which solid, pick a point for location, with `diameter`/`depth` properties). Result replaces the original node with an `EditableShapeNode`, exactly mirroring the existing destructive Fillet/Chamfer pattern (this is consistent with the current geometry-snapshot model; non-destructive parametric history is the separate Tier-C track).

**Tech Stack:** C++/OCCT v8 + Emscripten (CMake), TypeScript npm-workspace monorepo, Rstest (Happy-DOM/Node), Biome.

**Reference patterns to mirror:**
- C++ binding + EMSCRIPTEN registration: `cpp/src/factory.cpp:522-539` (fillet) and `:651` (binding line)
- TS wrapper: `packages/wasm/src/factory.ts:79-91` (fillet)
- Interface: `packages/core/src/shape/shapeFactory.ts:49`
- Command: `packages/app/src/commands/modify/fillet.ts` (entire file)
- Kernel test harness: `packages/wasm/test/box.test.ts` (entire file)
- `shapeFactory` is a global (defined in `packages/core/src/application.ts:56`), used unimported inside commands.

**One-time environment note (read before Task 3):** The OCCT/Emscripten toolchain is already downloaded under `cpp/build/emsdk` and `cpp/build/occt`. `emcc` is NOT on `$PATH`, but the CMake preset (`cpp/CMakePresets.json`) references the toolchain file directly, so `npm run build:wasm` works without manually activating emsdk. If the build cannot find emscripten, run `source cpp/build/emsdk/emsdk_env.sh` first. The OCCT libraries are prebuilt; only `chili-wasm` sources recompile + link (minutes, not the full OCCT build).

---

## File Structure

| File | Responsibility | Action |
|------|----------------|--------|
| `packages/wasm/test/hole.test.ts` | Headless kernel test: drill a hole, assert volume drops | Create |
| `cpp/src/factory.cpp` | `makeHole` static method + EMSCRIPTEN binding | Modify |
| `packages/wasm/lib/chili-wasm.{wasm,js,d.ts}` | Rebuilt kernel artifact + generated types | Regenerated (build output) |
| `packages/core/src/shape/shapeFactory.ts` | `makeHole` on `IShapeFactory` interface | Modify |
| `packages/wasm/src/factory.ts` | `makeHole` wrapper impl | Modify |
| `packages/app/src/commands/modify/hole.ts` | `HoleCommand` | Create |
| `packages/app/src/commands/modify/index.ts` | Export `HoleCommand` | Modify |
| `packages/builder/src/ribbon.ts` | Add `modify.hole` to the modify group | Modify |
| `packages/i18n/src/en.ts` | English strings | Modify |
| `packages/i18n/src/zh-cn.ts` | Chinese strings | Modify |
| `packages/i18n/src/pt-br.ts` | Portuguese strings | Modify |

---

## Task 1: Failing kernel test (TDD red)

**Files:**
- Test: `packages/wasm/test/hole.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/wasm/test/hole.test.ts`:

```ts
// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { readFileSync } from "node:fs";
import path from "node:path";
import { Plane, type ISolid } from "@chili3d/core";
import { initWasm, ShapeFactory } from "@chili3d/wasm";
import { describe, expect, test } from "@rstest/core";

// Under Node there is no fetch for the .wasm; read it from disk (tests run from
// the repo root) and hand the bytes to Emscripten via Module.wasmBinary.
const WASM_BINARY = readFileSync(path.join(process.cwd(), "packages/wasm/lib/chili-wasm.wasm"));

describe("Hole feature (headless)", () => {
    test("drills a blind hole into a box, reducing its volume", async () => {
        await initWasm({ wasmBinary: WASM_BINARY });

        const factory = new ShapeFactory();
        const box = factory.box(Plane.XY, 20, 20, 20);
        expect(box.isOk).toBe(true);
        const before = (box.value as ISolid).volume();

        // Drill from the top face centre (10,10,20) downward (0,0,-1),
        // radius 3, depth 10.
        const holed = factory.makeHole(box.value, { x: 10, y: 10, z: 20 }, { x: 0, y: 0, z: -1 }, 3, 10);
        expect(holed.isOk).toBe(true);

        const after = (holed.value as ISolid).volume();
        expect(after).toBeLessThan(before);
        // a 3mm-radius, 10mm-deep hole removes ~282.7 mm^3
        expect(before - after).toBeGreaterThan(200);
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx rstest packages/wasm/test/hole.test.ts`
Expected: FAIL — TypeScript/runtime error that `factory.makeHole is not a function` (the wrapper and binding do not exist yet).

---

## Task 2: C++ binding `makeHole`

**Files:**
- Modify: `cpp/src/factory.cpp` (add method near fillet at `:522-539`; add binding near `:651`; add include at top with the other `#include`s)

- [ ] **Step 1: Add the OCCT include**

At the top of `cpp/src/factory.cpp`, with the other `#include <...>` lines, add:

```cpp
#include <BRepFeat_MakeCylindricalHole.hxx>
#include <BRepFeat_Status.hxx>
```

- [ ] **Step 2: Add the `makeHole` static method**

Immediately after the `fillet` method (after the closing brace of `fillet`, before `chamfer`) in `cpp/src/factory.cpp`, add:

```cpp
    static ShapeResult makeHole(const TopoDS_Shape& base, const Vector3& location, const Vector3& direction, double radius, double depth)
    {
        gp_Ax1 axis(Vector3::toPnt(location), Vector3::toDir(direction));
        BRepFeat_MakeCylindricalHole hole;
        hole.Init(base, axis);
        hole.PerformBlind(radius, depth);
        if (hole.Status() != BRepFeat_NoError) {
            return ShapeResult { TopoDS_Shape(), false, "Failed to make hole" };
        }
        return ShapeResult { hole.Shape(), true, "" };
    }
```

> API verified against `cpp/build/occt/src/ModelingAlgorithms/TKFeat/BRepFeat/BRepFeat_MakeCylindricalHole.hxx`: `Init(const TopoDS_Shape&, const gp_Ax1&)` and `PerformBlind(const double Radius, const double Length, ...)`. `Vector3::toPnt/toDir` are defined in `cpp/src/shared.hpp:51,61`.

- [ ] **Step 3: Register the Emscripten binding**

In the `EMSCRIPTEN_BINDINGS(ShapeFactory)` block, immediately after the `.class_function("fillet", &ShapeFactory::fillet)` line (`cpp/src/factory.cpp:651`), add:

```cpp
        .class_function("makeHole", &ShapeFactory::makeHole)
```

(Place it so it does not break the trailing `;` — it goes between `fillet` and `chamfer`, both of which keep their own lines.)

---

## Task 3: Rebuild the WASM kernel

**Files:**
- Regenerates: `packages/wasm/lib/chili-wasm.{wasm,js,d.ts}`

- [ ] **Step 1: Build**

Run: `npm run build:wasm`
Expected: CMake configures and builds; completes without compile/link errors. (If it reports emscripten not found, run `source cpp/build/emsdk/emsdk_env.sh` and retry.)

- [ ] **Step 2: Verify the generated TypeScript declaration now includes makeHole**

Run: `grep -n "makeHole" packages/wasm/lib/chili-wasm.d.ts`
Expected: one match, e.g. `makeHole(_0: TopoDS_Shape, _1: Vector3, _2: Vector3, _3: number, _4: number): ShapeResult;`

- [ ] **Step 3: Commit the kernel change**

```bash
git add cpp/src/factory.cpp packages/wasm/lib/chili-wasm.wasm packages/wasm/lib/chili-wasm.js packages/wasm/lib/chili-wasm.d.ts
git commit -m "✨ feat(wasm): bind OCCT makeHole (cylindrical hole)"
```

---

## Task 4: Core interface + TS wrapper (TDD green)

**Files:**
- Modify: `packages/core/src/shape/shapeFactory.ts:49`
- Modify: `packages/wasm/src/factory.ts` (after the `fillet` wrapper, `:79-91`)
- Test: `packages/wasm/test/hole.test.ts` (from Task 1)

- [ ] **Step 1: Add `makeHole` to the `IShapeFactory` interface**

In `packages/core/src/shape/shapeFactory.ts`, immediately after the `fillet(...)` line (`:49`), add:

```ts
    makeHole(
        shape: IShape,
        location: XYZLike,
        direction: XYZLike,
        radius: number,
        depth: number,
    ): Result<IShape>;
```

If `XYZLike` is not already imported in this file, add it to the existing `@chili3d/core`-relative math import (it is exported from `packages/core/src/math/xyz.ts`). Verify with `grep -n "XYZLike" packages/core/src/shape/shapeFactory.ts`; if absent, add `import type { XYZLike } from "../math";` alongside the other type imports.

- [ ] **Step 2: Implement the wrapper**

In `packages/wasm/src/factory.ts`, immediately after the closing brace of the `fillet(...)` method, add:

```ts
    makeHole(
        shape: IShape,
        location: XYZLike,
        direction: XYZLike,
        radius: number,
        depth: number,
    ): Result<IShape> {
        if (radius < Precision.Distance) {
            return Result.err("The radius is too small.");
        }
        if (depth < Precision.Distance) {
            return Result.err("The depth is too small.");
        }
        if (shape instanceof OccShape) {
            return convertShapeResult(
                wasm.ShapeFactory.makeHole(shape.shape, location, direction, radius, depth),
            );
        }
        return Result.err("Not OccShape");
    }
```

`Precision`, `Result`, `OccShape`, `convertShapeResult`, and `wasm` are already imported in this file (used by `fillet`). `XYZLike` is already imported (`packages/wasm/src/factory.ts:23`).

- [ ] **Step 3: Run the kernel test to verify it passes**

Run: `npx rstest packages/wasm/test/hole.test.ts`
Expected: PASS (1 test). The box volume drops by >200 mm³ after drilling.

- [ ] **Step 4: Lint**

Run: `npm run check`
Expected: no errors on the modified files.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/shape/shapeFactory.ts packages/wasm/src/factory.ts packages/wasm/test/hole.test.ts
git commit -m "✨ feat(wasm): add makeHole factory wrapper + headless test"
```

---

## Task 5: `HoleCommand`

**Files:**
- Create: `packages/app/src/commands/modify/hole.ts`

**Design:** Two steps — (1) select a planar face (gives drill direction + the owning solid), (2) pick a point on the solid (hole centre). `diameter` and `depth` are editable command properties shown live in the property panel. Everything is computed in world space, then stored as an `EditableShapeNode` with identity transform; the original node is removed (mirroring Fillet).

- [ ] **Step 1: Write the command**

Create `packages/app/src/commands/modify/hole.ts`:

```ts
// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    command,
    EditableShapeNode,
    type IFace,
    type IShape,
    PointStep,
    property,
    SelectShapeStep,
    type ShapeNode,
    ShapeTypes,
    Transaction,
    VisualStates,
} from "@chili3d/core";
import { MultistepCommand } from "../multistepCommand";

@command({
    key: "modify.hole",
    icon: "icon-hole",
})
export class HoleCommand extends MultistepCommand {
    @property("circle.radius")
    get diameter() {
        return this.getPrivateValue("diameter", 6);
    }
    set diameter(value: number) {
        this.setProperty("diameter", value);
    }

    @property("common.length")
    get depth() {
        return this.getPrivateValue("depth", 10);
    }
    set depth(value: number) {
        this.setProperty("depth", value);
    }

    protected override getSteps() {
        return [
            new SelectShapeStep(ShapeTypes.face, "prompt.select.faces", {
                selectedState: VisualStates.faceTransparent,
            }),
            new PointStep("prompt.pickHoleLocation"),
        ];
    }

    protected override executeMainTask() {
        Transaction.execute(this.document, `execute ${Object.getPrototypeOf(this).data.name}`, () => {
            const selected = this.stepDatas[0].shapes[0];
            const node = selected.owner.node as ShapeNode;

            // Work in world space: transform the local solid + face by the node transform.
            const worldSolid: IShape = node.shape.value.transformedMul(node.transform);
            const worldFace = selected.shape.transformedMul(node.transform) as IFace;
            const [, normal] = worldFace.normal(0, 0);

            const location = this.stepDatas[1].point!;
            const direction = normal.multiply(-1); // drill inward, opposite the outward face normal

            const holed = shapeFactory.makeHole(
                worldSolid,
                location,
                direction,
                this.diameter / 2,
                this.depth,
            );
            if (!holed.isOk) {
                return;
            }

            const model = new EditableShapeNode({
                document: this.document,
                name: node.name,
                shape: holed,
                materialId: node.materialId,
            });
            (node.parent ?? this.document.modelManager.rootNode).add(model);
            node.parent?.remove(node);
            this.document.visual.update();
        });
    }
}
```

> Notes verified against the codebase: `EditableShapeNode`, `SelectShapeStep`, `ShapeTypes`, `Transaction`, `VisualStates`, `property` are all exported from `@chili3d/core` (see `fillet.ts` imports). `PointStep` is exported from `@chili3d/core` (`packages/core/src/step/pointStep.ts`). `shapeFactory` is the global from `application.ts:56`. `IFace.normal(u,v)` returns `[point, normal]` (`shape.ts:87`). `IShape.transformedMul(matrix)` exists (`shape.ts:18`). The `EditableShapeNode({ shape })` accepts a `Result<IShape>` (Fillet passes the raw factory `Result`, so passing `holed` directly is correct).

- [ ] **Step 2: Typecheck the new file**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -i "hole.ts" || echo "no hole.ts type errors"`
Expected: `no hole.ts type errors`.

---

## Task 6: Register command + ribbon + i18n

**Files:**
- Modify: `packages/app/src/commands/modify/index.ts`
- Modify: `packages/builder/src/ribbon.ts:43`
- Modify: `packages/i18n/src/en.ts`, `packages/i18n/src/zh-cn.ts`, `packages/i18n/src/pt-br.ts`

- [ ] **Step 1: Export the command**

In `packages/app/src/commands/modify/index.ts`, add an export line alongside the other modify exports:

```ts
export * from "./hole";
```

(Match the existing export style in that file — if it uses named re-exports like `export { FilletCommand } from "./fillet";`, then add `export { HoleCommand } from "./hole";` instead. Verify with `head packages/app/src/commands/modify/index.ts`.)

- [ ] **Step 2: Add to the ribbon**

In `packages/builder/src/ribbon.ts`, in the `ribbon.group.modify` group (the row at `:43` containing fillet/chamfer/explode), add `"modify.hole"` to that array:

```ts
                    ["modify.fillet", "modify.chamfer", "modify.hole", "modify.explode"],
```

- [ ] **Step 3: Add English strings**

In `packages/i18n/src/en.ts`, add (next to the existing `"command.modify.fillet"` entry and the prompt block):

```ts
        "command.modify.hole": "Hole",
```

And next to `"prompt.select.edges"` / `"prompt.select.faces"`, add:

```ts
        "prompt.pickHoleLocation": "Pick the hole location",
```

(`"circle.radius"`, `"common.length"`, and `"prompt.select.faces"` already exist and are reused — verify `"prompt.select.faces"` is present with `grep -n "prompt.select.faces" packages/i18n/src/en.ts`; if absent, add `"prompt.select.faces": "Please select faces",`.)

- [ ] **Step 4: Add Chinese strings**

In `packages/i18n/src/zh-cn.ts`, add next to `"command.modify.fillet"`:

```ts
        "command.modify.hole": "孔",
```

And add the prompt key:

```ts
        "prompt.pickHoleLocation": "拾取孔的位置",
```

- [ ] **Step 5: Add Portuguese strings**

In `packages/i18n/src/pt-br.ts`, add next to the other `command.modify.*` entries:

```ts
        "command.modify.hole": "Furo",
```

And the prompt key:

```ts
        "prompt.pickHoleLocation": "Selecione a posição do furo",
```

(If `pt-br.ts` is missing some of the reused keys like `prompt.select.faces`, add them following that file's existing structure so the build's i18n key-completeness check passes.)

- [ ] **Step 6: Build to verify wiring + i18n key types**

Run: `npm run build 2>&1 | grep -iE "error|hole" | head` (expect no `error` lines; the i18n `CommandKeys` type is generated from these keys, so a missing/typo'd key surfaces here as a type error).
Then run: `npm run check`
Expected: build compiles (only the pre-existing asset-size warning), lint clean.

- [ ] **Step 7: Commit**

```bash
git add packages/app/src/commands/modify/hole.ts packages/app/src/commands/modify/index.ts packages/builder/src/ribbon.ts packages/i18n/src/en.ts packages/i18n/src/zh-cn.ts packages/i18n/src/pt-br.ts
git commit -m "✨ feat(app): add Hole modify command (ribbon + i18n)"
```

---

## Task 7: Manual verification

**Files:** none (runtime check)

- [ ] **Step 1: Run the dev server**

Run: `npm run dev` → open `http://localhost:8080` (or the printed port).

- [ ] **Step 2: Exercise the feature**

1. Create a Box (Draw/primitives).
2. Click the new **Hole** button in the Model tab → Modify group.
3. Select a top planar face of the box → pick a point near its centre.
4. Adjust **Radius** (diameter/2 input labelled "Radius") and **Length** (depth) in the property panel.
5. Confirm a cylindrical blind hole is cut into the solid and the model updates.

Expected: a visible hole; no console errors. Undo (Ctrl+Z) restores the original box (the command runs inside a `Transaction`).

- [ ] **Step 3: Note known v1 limitations (do not fix here)**

- Designed for **planar** target faces (uses the face normal at param (0,0) as the drill axis). Curved faces are out of scope for v1.
- Destructive (replaces the node with an `EditableShapeNode`), consistent with Fillet/Chamfer. Non-destructive parametric history is the separate Tier-C track.
- The `icon-hole` glyph may not exist in the icon font yet; the button still functions (renders without/with a fallback glyph). Adding the SVG glyph is a trivial follow-up.

---

## Self-Review

**Spec coverage (against roadmap A1 "Hole feature"):** ✅ kernel binding (`BRepFeat_MakeCylindricalHole`, Task 2), ✅ TS factory exposure (Task 4), ✅ user-facing command + ribbon + i18n (Tasks 5–6), ✅ test (Task 1/4), ✅ manual verification (Task 7). The roadmap's "exercise the full C++→command→ribbon pipeline" goal is met end-to-end.

**Placeholder scan:** No TBD/TODO; every code step shows complete code; the one API I could not see without the header (`PerformBlind`) was verified directly against the OCCT header and cited.

**Type consistency:** `makeHole(shape, location: XYZLike, direction: XYZLike, radius: number, depth: number): Result<IShape>` is identical across the interface (Task 4 Step 1), the wrapper (Task 4 Step 2), the test call (Task 1, positional args match), and the command call site (Task 5, passes `diameter/2` as `radius`). The C++ signature `makeHole(base, location, direction, radius, depth)` matches the generated `.d.ts` shape asserted in Task 3 Step 2.

**Known assumptions flagged for the implementer:** the `index.ts`/`pt-br.ts` export- and key-style notes instruct verifying the file's existing convention before editing, since those two were not exhaustively read.
