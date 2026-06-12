# Draft Angle (A3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Checkbox (`- [ ]`) steps.

**Goal:** Add a "Draft" modify command that tapers selected faces of a solid by an angle about a neutral plane, via OCCT `BRepOffsetAPI_DraftAngle`.

**Architecture:** Bind `draftAngle(shape, faces, direction, angle, neutralOrigin, neutralNormal)` → Emscripten → TS factory + interface → `DraftCommand` (select faces to draft → select a neutral face that defines the neutral plane + pull direction; `angle` degrees property). Destructive node replacement mirroring Fillet. Everything operates in the solid's LOCAL frame (face indices and the neutral face both belong to the solid), so no world-space transform juggling. Angle is RADIANS at the factory boundary; the command converts its degrees property.

**References:** `cpp/src/factory.cpp:525` (`fillet` — map-build-guard pattern), `packages/wasm/src/factory.ts:79` (fillet wrapper), `packages/app/src/commands/modify/fillet.ts` + `brush.ts:42` (face-index extraction via `ISubFaceShape`). OCCT API verified: `cpp/build/occt/.../BRepOffsetAPI_DraftAngle.hxx:118` `Add(const TopoDS_Face&, const gp_Dir&, const double Angle, const gp_Pln&, const bool=true)` + `AddDone()`.

**Lesson carried:** `EditableShapeNode`'s constructor bypasses the error path; the command guards the factory `Result` with `displayError` and keeps the original solid on failure.

**Branch:** `feat/tier-a-manufacturing` already has A1 `makeHole` + A2 `variableFillet`. The rebuilt wasm must retain BOTH and add `draftAngle`.

---

## File Structure
| File | Action |
|------|--------|
| `packages/wasm/test/draftAngle.test.ts` | Create |
| `cpp/src/factory.cpp` | Modify (method + binding + include) |
| `packages/wasm/lib/chili-wasm.{wasm,js,d.ts}` | Regenerated |
| `packages/core/src/shape/shapeFactory.ts` | Modify (interface) |
| `packages/wasm/src/factory.ts` | Modify (wrapper) |
| `packages/app/src/commands/modify/draft.ts` | Create |
| `packages/app/src/commands/modify/index.ts` | Modify (export) |
| `packages/builder/src/ribbon.ts` | Modify (ribbon) |
| `packages/core/src/i18n/keys.ts` + 3 locales | Modify (i18n) |

---

## UNIT A — kernel `draftAngle`

### Task 1: Failing test (face-order-robust)
Create `packages/wasm/test/draftAngle.test.ts`:
```ts
// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { readFileSync } from "node:fs";
import path from "node:path";
import { type IFace, type ISolid, Plane, ShapeTypes } from "@chili3d/core";
import { initWasm, ShapeFactory } from "@chili3d/wasm";
import { describe, expect, test } from "@rstest/core";

const WASM_BINARY = readFileSync(path.join(process.cwd(), "packages/wasm/lib/chili-wasm.wasm"));

describe("Draft angle (headless)", () => {
    test("tapers a vertical box face about a horizontal neutral plane, changing volume", async () => {
        await initWasm({ wasmBinary: WASM_BINARY });

        const factory = new ShapeFactory();
        const box = factory.box(Plane.XY, 20, 20, 20);
        expect(box.isOk).toBe(true);
        const before = (box.value as ISolid).volume();

        // Find the +X side face index (face order is implementation-defined, so query it).
        const faces = box.value.findSubShapes(ShapeTypes.face);
        let targetIndex = -1;
        for (let i = 0; i < faces.length; i++) {
            const [, n] = (faces[i] as IFace).normal(0.5, 0.5);
            if (Math.abs(n.x - 1) < 1e-3) {
                targetIndex = i;
                break;
            }
        }
        expect(targetIndex).toBeGreaterThanOrEqual(0);

        // Pull direction +Z, neutral plane z=0 (origin 0,0,0; normal 0,0,1), 5° draft.
        const drafted = factory.draftAngle(
            box.value,
            [targetIndex],
            { x: 0, y: 0, z: 1 },
            (5 * Math.PI) / 180,
            { x: 0, y: 0, z: 0 },
            { x: 0, y: 0, z: 1 },
        );
        expect(drafted.isOk).toBe(true);

        const after = (drafted.value as ISolid).volume();
        expect(Math.abs(after - before)).toBeGreaterThan(1);
    });
});
```
Run `npx rstest packages/wasm/test/draftAngle.test.ts` → FAIL (`draftAngle is not a function`).
(`findSubShapes` is on `IShape` at `packages/core/src/shape/shape.ts:37`; the JS face index from `findSubShapes` corresponds to the C++ `TopExp::MapShapes(...TopAbs_FACE)` 1-based key used in Task 2 — both are TopExp traversal order.)

### Task 2: C++ binding
In `cpp/src/factory.cpp`, add include near the other includes:
```cpp
#include <BRepOffsetAPI_DraftAngle.hxx>
```
After the existing `fillet`/`variableFillet` methods (before `chamfer`), add:
```cpp
    static ShapeResult draftAngle(const TopoDS_Shape& shape, const NumberArray& faces, const Vector3& direction, double angle, const Vector3& neutralOrigin, const Vector3& neutralNormal)
    {
        std::vector<int> faceVec = vecFromJSArray<int>(faces);

        NCollection_IndexedMap<TopoDS_Shape, TopTools_ShapeMapHasher> faceMap;
        TopExp::MapShapes(shape, TopAbs_FACE, faceMap);

        BRepOffsetAPI_DraftAngle draft(shape);
        gp_Dir dir = Vector3::toDir(direction);
        gp_Pln neutral(Vector3::toPnt(neutralOrigin), Vector3::toDir(neutralNormal));
        for (auto f : faceVec) {
            draft.Add(TopoDS::Face(faceMap.FindKey(f + 1)), dir, angle, neutral);
            if (!draft.AddDone()) {
                return ShapeResult { TopoDS_Shape(), false, "Failed to add draft to face" };
            }
        }
        draft.Build();
        if (!draft.IsDone()) {
            return ShapeResult { TopoDS_Shape(), false, "Failed to draft" };
        }

        return ShapeResult { draft.Shape(), true, "" };
    }
```
(`gp_Pln`, `gp_Dir`, `TopExp`, `TopoDS`, `NCollection_IndexedMap`, `Vector3::toPnt/toDir` are already available — `shared.hpp` includes `gp_Pln.hxx`/`gp_Dir.hxx`, and `fillet` already uses the map/`TopoDS`. Only the `BRepOffsetAPI_DraftAngle.hxx` include is new.)

In `EMSCRIPTEN_BINDINGS(ShapeFactory)`, after `.class_function("variableFillet", ...)` add:
```cpp
        .class_function("draftAngle", &ShapeFactory::draftAngle)
```

### Task 3: Rebuild WASM
`npm run build:wasm`. Verify ALL THREE bindings survive: `grep -nE "makeHole|variableFillet|draftAngle" packages/wasm/lib/chili-wasm.d.ts` → all three present. Commit:
```bash
git add cpp/src/factory.cpp packages/wasm/lib/chili-wasm.wasm packages/wasm/lib/chili-wasm.js packages/wasm/lib/chili-wasm.d.ts
git commit -m "✨ feat(wasm): bind OCCT draftAngle (taper faces about a neutral plane)"
```

### Task 4: Interface + wrapper (green)
In `packages/core/src/shape/shapeFactory.ts`, after the `variableFillet(...)` interface line, add:
```ts
    draftAngle(
        shape: IShape,
        faces: number[],
        direction: XYZLike,
        angle: number,
        neutralOrigin: XYZLike,
        neutralNormal: XYZLike,
    ): Result<IShape>;
```
(`XYZLike` is already imported by the A1 `makeHole` interface line — verify; if not, import it from `../math`.)
In `packages/wasm/src/factory.ts`, after the `variableFillet(...)` method, add:
```ts
    draftAngle(
        shape: IShape,
        faces: number[],
        direction: XYZLike,
        angle: number,
        neutralOrigin: XYZLike,
        neutralNormal: XYZLike,
    ): Result<IShape> {
        if (faces.length === 0) {
            return Result.err("The faces is empty.");
        }
        if (shape instanceof OccShape) {
            return convertShapeResult(
                wasm.ShapeFactory.draftAngle(shape.shape, faces, direction, angle, neutralOrigin, neutralNormal),
            );
        }
        return Result.err("Not OccShape");
    }
```
Run `npx rstest packages/wasm/test/draftAngle.test.ts` → PASS. `npm run check` (stage ONLY the 3 intended files; ignore unrelated biome reformats). Commit:
```bash
git add packages/core/src/shape/shapeFactory.ts packages/wasm/src/factory.ts packages/wasm/test/draftAngle.test.ts
git commit -m "✨ feat(wasm): add draftAngle factory wrapper + headless test"
```

---

## UNIT B — `DraftCommand` + wiring

### Task 5: Command
Create `packages/app/src/commands/modify/draft.ts`:
```ts
// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    command,
    EditableShapeNode,
    type IFace,
    type ISubFaceShape,
    MathUtils,
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
    key: "modify.draft",
    icon: "icon-fillet",
})
export class DraftCommand extends MultistepCommand {
    @property("common.angle")
    get angle() {
        return this.getPrivateValue("angle", 5);
    }
    set angle(value: number) {
        this.setProperty("angle", value);
    }

    protected override executeMainTask() {
        Transaction.execute(this.document, `execute ${Object.getPrototypeOf(this).data.name}`, () => {
            const node = this.stepDatas[0].shapes[0].owner.node as ShapeNode;
            const faces = this.stepDatas[0].shapes.map((x) => (x.shape as ISubFaceShape).index);

            const neutralFace = this.stepDatas[1].shapes[0].shape as IFace;
            const [origin, normal] = neutralFace.normal(0.5, 0.5);

            const drafted = shapeFactory.draftAngle(
                node.shape.value,
                faces,
                normal,
                MathUtils.degToRad(this.angle),
                origin,
                normal,
            );
            if (!drafted.isOk) {
                PubSub.default.pub("displayError", drafted.error);
                return;
            }

            const model = new EditableShapeNode({
                document: this.document,
                name: node.name,
                shape: drafted,
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
            new SelectShapeStep(ShapeTypes.face, "prompt.select.faces", {
                multiple: true,
            }),
            new SelectShapeStep(ShapeTypes.face, "prompt.select.neutralFace", {
                keepSelection: true,
            }),
        ];
    }
}
```
VERIFY before trusting: `ISubFaceShape` is exported from `@chili3d/core` (used by `brush.ts`); `MathUtils.degToRad` exists (grep `packages/core/src/math/mathUtils.ts` — if the method has a different name like `degree2Radian`, use that; if no helper exists, inline `(this.angle * Math.PI) / 180` and drop the `MathUtils` import). `SelectShapeStep` with `ShapeTypes.face` + `{multiple}` / `{keepSelection}` options — confirm against fillet's edge step usage. `IFace.normal(u,v)` returns `[point, normal]` (`shape.ts:87`). The two selection steps' faces are assumed to belong to the SAME solid (the neutral face provides a plane+direction in the solid's local frame); both `node.shape.value` and the neutral face are local, and `model.transform = node.transform` reapplies the placement — consistent.

### Task 6: Export + ribbon + i18n
- `index.ts`: `export * from "./draft";`
- `ribbon.ts`: add `"modify.draft"` to the modify group near `"modify.variableFillet"`.
- `packages/core/src/i18n/keys.ts`: add `"command.modify.draft"` AND `"prompt.select.neutralFace"` to `I18N_KEYS` (alphabetical positions). REQUIRED (TS2820 otherwise). Verify `"common.angle"` already exists in `I18N_KEYS` (`grep '"common.angle"' packages/core/src/i18n/keys.ts`); if absent, add it too.
- `en.ts`: `"command.modify.draft": "Draft",` and `"prompt.select.neutralFace": "Select the neutral plane face",` (and `"common.angle": "Angle",` if missing).
- `zh-cn.ts`: `"command.modify.draft": "拔模",` and `"prompt.select.neutralFace": "选择中性面",`.
- `pt-br.ts`: `"command.modify.draft": "Inclinação",` and `"prompt.select.neutralFace": "Selecione a face do plano neutro",`.

Verify `npm run build 2>&1 | grep -iE "error|draft" | head` → no `error` lines. `npm run check` (stage ONLY the 7 intended files). Commit:
```bash
git add packages/app/src/commands/modify/draft.ts packages/app/src/commands/modify/index.ts packages/builder/src/ribbon.ts packages/core/src/i18n/keys.ts packages/i18n/src/en.ts packages/i18n/src/zh-cn.ts packages/i18n/src/pt-br.ts
git commit -m "✨ feat(app): add Draft modify command (ribbon + i18n)"
```

---

## Self-Review
- **Spec coverage:** binding (T2), wrapper/interface (T4), command+wiring (T5–6), test (T1/4). ✅
- **Placeholders:** none; OCCT `Add` signature + `AddDone` verified in-header; `ISubFaceShape.index` confirmed via `brush.ts`.
- **Type consistency:** `draftAngle(shape, faces: number[], direction: XYZLike, angle: number, neutralOrigin: XYZLike, neutralNormal: XYZLike): Result<IShape>` identical across interface, wrapper, test call, and `.d.ts`. Command passes `MathUtils.degToRad(this.angle)` for `angle` (radians at the boundary).
- **Known v1 limitations (do not fix here):** uses `icon-fillet` (no dedicated glyph); destructive replace; the draft faces + neutral face are assumed on the same body; pull direction = neutral-face normal (sign/draft-direction not user-selectable — flip the angle or pick the opposite face if it drafts the wrong way).
