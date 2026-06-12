# Variable Fillet (A2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Add a "Variable Fillet" modify command that rounds selected edges with a radius that transitions from `radius1` (edge start) to `radius2` (edge end), via OCCT `BRepFilletAPI_MakeFillet::Add(R1, R2, edge)`.

**Architecture:** New bound C++ factory op `variableFillet(shape, edges, radius1, radius2)` → Emscripten → TS `ShapeFactory` + `IShapeFactory` → `VariableFilletCommand` (select solid → select edges; `radius1`/`radius2` properties). Destructive node replacement mirroring the existing single-radius Fillet. This is the same end-to-end pattern proven by the A1 Hole feature.

**Reference patterns:** `cpp/src/factory.cpp:525-539` (single-radius `fillet`), `packages/wasm/src/factory.ts:79-91` (fillet wrapper), `packages/core/src/shape/shapeFactory.ts:49` (interface), `packages/app/src/commands/modify/fillet.ts` (command). OCCT overload verified at `cpp/build/occt/src/ModelingAlgorithms/TKFillet/BRepFilletAPI/BRepFilletAPI_MakeFillet.hxx:98`.

**Lesson carried from A1:** `EditableShapeNode`'s constructor assigns `_shape` directly and does NOT surface a failed `Result` via `displayError` (`packages/core/src/model/shapeNode.ts:226-229`). So the command guards the factory `Result` explicitly (publish `displayError`, keep the original solid) rather than passing a possibly-failed Result into the node.

**Environment:** Unit A rebuilds WASM via `npm run build:wasm` (bundled toolchain under `cpp/build/emsdk`; if emcc not found, `source cpp/build/emsdk/emsdk_env.sh`). NOTE: this branch (`feat/tier-a-manufacturing`) already contains the A1 `makeHole` binding — the rebuilt wasm must retain `makeHole` AND add `variableFillet`. Do NOT remove makeHole.

---

## File Structure

| File | Responsibility | Action |
|------|----------------|--------|
| `packages/wasm/test/variableFillet.test.ts` | Headless kernel test | Create |
| `cpp/src/factory.cpp` | `variableFillet` method + binding | Modify |
| `packages/wasm/lib/chili-wasm.{wasm,js,d.ts}` | Rebuilt kernel | Regenerated |
| `packages/core/src/shape/shapeFactory.ts` | interface method | Modify |
| `packages/wasm/src/factory.ts` | wrapper impl | Modify |
| `packages/app/src/commands/modify/variableFillet.ts` | command | Create |
| `packages/app/src/commands/modify/index.ts` | export | Modify |
| `packages/builder/src/ribbon.ts` | ribbon entry | Modify |
| `packages/core/src/i18n/keys.ts` | register i18n keys (generates `I18nKeys` type) | Modify |
| `packages/i18n/src/{en,zh-cn,pt-br}.ts` | locale strings | Modify |

---

## UNIT A — kernel `variableFillet` (plan tasks 1–4)

### Task 1: Failing headless test
Create `packages/wasm/test/variableFillet.test.ts`:
```ts
// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { readFileSync } from "node:fs";
import path from "node:path";
import { Plane, type ISolid } from "@chili3d/core";
import { initWasm, ShapeFactory } from "@chili3d/wasm";
import { describe, expect, test } from "@rstest/core";

const WASM_BINARY = readFileSync(path.join(process.cwd(), "packages/wasm/lib/chili-wasm.wasm"));

describe("Variable fillet (headless)", () => {
    test("rounds a box edge with a transitioning radius, reducing volume", async () => {
        await initWasm({ wasmBinary: WASM_BINARY });

        const factory = new ShapeFactory();
        const box = factory.box(Plane.XY, 20, 20, 20);
        expect(box.isOk).toBe(true);
        const before = (box.value as ISolid).volume();

        // Fillet edge 0 with radius transitioning 2mm -> 4mm along the edge.
        const filleted = factory.variableFillet(box.value, [0], 2, 4);
        expect(filleted.isOk).toBe(true);

        const after = (filleted.value as ISolid).volume();
        // a convex box edge fillet removes material
        expect(after).toBeLessThan(before);
    });
});
```
Run `npx rstest packages/wasm/test/variableFillet.test.ts` → expect FAIL (`factory.variableFillet is not a function`).

### Task 2: C++ binding
In `cpp/src/factory.cpp`, immediately AFTER the existing `fillet` method (ends ~line 539) and before `chamfer`, add:
```cpp
    static ShapeResult variableFillet(const TopoDS_Shape& shape, const NumberArray& edges, double radius1, double radius2)
    {
        std::vector<int> edgeVec = vecFromJSArray<int>(edges);

        NCollection_IndexedMap<TopoDS_Shape, TopTools_ShapeMapHasher> edgeMap;
        TopExp::MapShapes(shape, TopAbs_EDGE, edgeMap);

        BRepFilletAPI_MakeFillet makeFillet(shape);
        for (auto edge : edgeVec) {
            makeFillet.Add(radius1, radius2, TopoDS::Edge(edgeMap.FindKey(edge + 1)));
        }
        makeFillet.Build();
        if (!makeFillet.IsDone()) {
            return ShapeResult { TopoDS_Shape(), false, "Failed to variable fillet" };
        }

        return ShapeResult { makeFillet.Shape(), true, "" };
    }
```
(`BRepFilletAPI_MakeFillet`, `TopExp`, `TopoDS`, `NCollection_IndexedMap` are already included — the existing `fillet` uses them. No new includes needed.)

In the `EMSCRIPTEN_BINDINGS(ShapeFactory)` block, immediately after `.class_function("fillet", &ShapeFactory::fillet)` add:
```cpp
        .class_function("variableFillet", &ShapeFactory::variableFillet)
```

### Task 3: Rebuild WASM
Run `npm run build:wasm`. Then verify BOTH bindings survive:
`grep -nE "makeHole|variableFillet" packages/wasm/lib/chili-wasm.d.ts` → expect both present.
Commit:
```bash
git add cpp/src/factory.cpp packages/wasm/lib/chili-wasm.wasm packages/wasm/lib/chili-wasm.js packages/wasm/lib/chili-wasm.d.ts
git commit -m "✨ feat(wasm): bind OCCT variableFillet (R1→R2 along edge)"
```

### Task 4: Interface + wrapper (green)
In `packages/core/src/shape/shapeFactory.ts`, after the `fillet(...)` interface line, add:
```ts
    variableFillet(shape: IShape, edges: number[], radius1: number, radius2: number): Result<IShape>;
```
In `packages/wasm/src/factory.ts`, after the `fillet(...)` method, add:
```ts
    variableFillet(shape: IShape, edges: number[], radius1: number, radius2: number): Result<IShape> {
        if (radius1 < Precision.Distance || radius2 < Precision.Distance) {
            return Result.err("The radius is too small.");
        }
        if (edges.length === 0) {
            return Result.err("The edges is empty.");
        }
        if (shape instanceof OccShape) {
            return convertShapeResult(
                wasm.ShapeFactory.variableFillet(shape.shape, edges, radius1, radius2),
            );
        }
        return Result.err("Not OccShape");
    }
```
Run `npx rstest packages/wasm/test/variableFillet.test.ts` → PASS. Lint: `npm run check` (only the touched files; if it reformats unrelated files, do NOT stage them — `git add` only the 3 intended files). Commit:
```bash
git add packages/core/src/shape/shapeFactory.ts packages/wasm/src/factory.ts packages/wasm/test/variableFillet.test.ts
git commit -m "✨ feat(wasm): add variableFillet factory wrapper + headless test"
```

---

## UNIT B — `VariableFilletCommand` + wiring (plan tasks 5–6)

### Task 5: Command
Create `packages/app/src/commands/modify/variableFillet.ts`:
```ts
// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    command,
    EditableShapeNode,
    type ISubEdgeShape,
    property,
    PubSub,
    SelectShapeStep,
    type ShapeNode,
    ShapeTypes,
    Transaction,
    VisualStates,
} from "@chili3d/core";
import { MultistepCommand } from "../multistepCommand";

@command({
    key: "modify.variableFillet",
    icon: "icon-fillet",
})
export class VariableFilletCommand extends MultistepCommand {
    @property("common.length")
    get radius1() {
        return this.getPrivateValue("radius1", 5);
    }
    set radius1(value: number) {
        this.setProperty("radius1", value);
    }

    @property("common.length")
    get radius2() {
        return this.getPrivateValue("radius2", 15);
    }
    set radius2(value: number) {
        this.setProperty("radius2", value);
    }

    protected override executeMainTask() {
        Transaction.execute(this.document, `execute ${Object.getPrototypeOf(this).data.name}`, () => {
            const node = this.stepDatas[0].shapes[0].owner.node as ShapeNode;
            const edges = this.stepDatas.at(-1)!.shapes.map((x) => (x.shape as ISubEdgeShape).index);
            const filleted = shapeFactory.variableFillet(node.shape.value, edges, this.radius1, this.radius2);
            if (!filleted.isOk) {
                PubSub.default.pub("displayError", filleted.error);
                return;
            }

            const model = new EditableShapeNode({
                document: this.document,
                name: node.name,
                shape: filleted,
                materialId: node.materialId,
            });
            model.transform = node.transform;
            (node.parent ?? this.document.modelManager.rootNode).add(model);
            node.parent?.remove(node);
            this.document.visual.update();
        });
    }

    protected override getSteps() {
        return [
            new SelectShapeStep(ShapeTypes.shape, "prompt.select.shape", {
                shapeFilter: {
                    allow: (shape) => {
                        return (
                            shape.shapeType === ShapeTypes.solid ||
                            shape.shapeType === ShapeTypes.compound ||
                            shape.shapeType === ShapeTypes.compoundSolid
                        );
                    },
                },
                selectedState: VisualStates.faceTransparent,
            }),
            new SelectShapeStep(ShapeTypes.edge, "prompt.select.edges", {
                multiple: true,
                keepSelection: true,
            }),
        ];
    }
}
```
This mirrors `fillet.ts` exactly (same two steps, same `ISubEdgeShape` index extraction, same `model.transform = node.transform`, destructive replace) — the ONLY differences are: two radius properties instead of one, the `variableFillet` call, and the `displayError` guard. Verify every imported symbol against `fillet.ts` before trusting (especially `ISubEdgeShape`, `SelectShapeStep` options shape). `PubSub` is exported from `@chili3d/core`.

### Task 6: Export + ribbon + i18n
- `packages/app/src/commands/modify/index.ts`: add `export * from "./variableFillet";` (match the file's existing style).
- `packages/builder/src/ribbon.ts`: add `"modify.variableFillet"` to the `ribbon.group.modify` row that contains `"modify.fillet"`, e.g. `["modify.fillet", "modify.variableFillet", "modify.chamfer", "modify.hole", "modify.explode"]`.
- `packages/core/src/i18n/keys.ts`: add `"command.modify.variableFillet"` to the `I18N_KEYS` array (REQUIRED — this array generates the `I18nKeys` type; omission = TS2820 build error). Place it in alphabetical position near `command.modify.fillet`.
- `packages/i18n/src/en.ts`: `"command.modify.variableFillet": "Variable Fillet",` near `"command.modify.fillet"`.
- `packages/i18n/src/zh-cn.ts`: `"command.modify.variableFillet": "变半径圆角",`.
- `packages/i18n/src/pt-br.ts`: `"command.modify.variableFillet": "Filete Variável",`.

(Reused keys `common.length`, `prompt.select.shape`, `prompt.select.edges` already exist.)

Verify: `npm run build 2>&1 | grep -iE "error|variablefillet" | head` → no `error` lines. `npm run check` clean on touched files (do NOT stage reformatted unrelated files).
Commit:
```bash
git add packages/app/src/commands/modify/variableFillet.ts packages/app/src/commands/modify/index.ts packages/builder/src/ribbon.ts packages/core/src/i18n/keys.ts packages/i18n/src/en.ts packages/i18n/src/zh-cn.ts packages/i18n/src/pt-br.ts
git commit -m "✨ feat(app): add Variable Fillet modify command (ribbon + i18n)"
```

---

## Self-Review
- **Spec coverage:** kernel binding (Task 2), wrapper/interface (Task 4), command + wiring (Tasks 5–6), test (Tasks 1/4). ✅
- **Placeholder scan:** none — complete code throughout; OCCT `Add(R1,R2,edge)` overload verified in-header.
- **Type consistency:** `variableFillet(shape, edges: number[], radius1: number, radius2: number): Result<IShape>` identical across interface, wrapper, test call, and `.d.ts` (`variableFillet(_0, _1: Array<number>, _2: number, _3: number)`). Command passes `this.radius1, this.radius2`.
- **Known limitations (v1, do not fix here):** uses `icon-fillet` (no dedicated glyph); destructive replace like Fillet; a single R1→R2 pair applies to all selected edges (per-edge radii is out of scope).
