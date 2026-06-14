# Robotics B3b — URDF Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Checkbox (`- [ ]`) steps.

**Goal:** Import the URDF ZIP that B3a export produces back into an editable `LinkNode`/`JointNode` tree (full round-trip).

**Architecture:** A pure `importUrdf(urdf, meshes, document, converter)` parses the URDF XML (DOMParser), rebuilds `LinkNode`s (with STL geometry via `convertFromSTL`) and `JointNode`s (inverse units: m→mm, rad→deg) nested `parentLink → joint → childLink`; `DefaultDataExchange` unzips the `.urdf` file and adds the base link. No WASM rebuild.

**Tech Stack:** TypeScript, DOMParser, jszip, OCCT/WASM `convertFromSTL`, Rstest. Design ref: `docs/superpowers/specs/2026-06-14-robotics-b3b-urdf-import-design.md`.

**Verified/assumed APIs:** `IShapeConverter.convertFromSTL(document, bytes): Result<FolderNode>`; `MathUtils.radToDeg`; `Matrix4.fromTranslation`, `Matrix4.fromEuler(x,y,z)`, `Matrix4.translationPart()`; `JointNode`/`LinkNode` constructors (`{document, name, jointType?, axis?, origin?}`); `XYZ`; `FolderNode.add`/`firstChild`/`nextSibling`. `DOMParser` is native (browser) and provided by happy-dom (tests).

---

## UNIT A — `importUrdf` (the core, round-trip tested)

**Files:** Create `packages/builder/src/urdf/urdfImporter.ts`; test `packages/builder/test/urdfImporter.test.ts`.

### Task 1: Failing round-trip test
`packages/builder/test/urdfImporter.test.ts`:
```ts
// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { readFileSync } from "node:fs";
import path from "node:path";
import { EditableShapeNode, JointNode, LinkNode, Matrix4, type INode, Plane } from "@chili3d/core";
import { initWasm, ShapeFactory } from "@chili3d/wasm";
import { describe, expect, test } from "@rstest/core";
import { TestDocument } from "../../core/test/testDocument";
import { exportUrdf } from "../src/urdf/urdfExporter";
import { importUrdf } from "../src/urdf/urdfImporter";

const WASM_BINARY = readFileSync(path.join(process.cwd(), "packages/wasm/lib/chili-wasm.wasm"));

function hasGeometry(node: INode): boolean {
    let n = (node as any).firstChild as INode | undefined;
    while (n) {
        if ((n as any).mesh?.faces?.position?.length > 0) return true;
        if (hasGeometry(n)) return true;
        n = n.nextSibling;
    }
    return false;
}
function firstChildOfType<T>(node: INode, ctor: new (...a: any[]) => T): T | undefined {
    let n = (node as any).firstChild as INode | undefined;
    while (n) {
        if (n instanceof ctor) return n as unknown as T;
        n = n.nextSibling;
    }
    return undefined;
}

describe("importUrdf (round-trip)", () => {
    test("export then import rebuilds the Link/Joint tree with mm + degrees", async () => {
        await initWasm({ wasmBinary: WASM_BINARY });
        const factory = new ShapeFactory();
        const doc = new TestDocument() as any;

        const base = new LinkNode({ document: doc, name: "base_link" });
        base.add(new EditableShapeNode({ document: doc, name: "g", shape: factory.box(Plane.XY, 20, 20, 20) }));
        const child = new LinkNode({ document: doc, name: "child_link" });
        child.add(new EditableShapeNode({ document: doc, name: "g", shape: factory.box(Plane.XY, 10, 10, 10) }));
        const joint = new JointNode({
            document: doc,
            name: "j1",
            jointType: "revolute",
            origin: Matrix4.fromTranslation(100, 0, 0),
        });
        joint.lowerLimit = -90;
        joint.upperLimit = 90;
        joint.add(child);
        base.add(joint);

        const { urdf, meshes } = exportUrdf(base, "robot", factory.converter);

        const doc2 = new TestDocument() as any;
        const base2 = importUrdf(urdf, meshes, doc2, factory.converter);

        expect(base2).toBeInstanceOf(LinkNode);
        expect(base2!.name).toBe("base_link");
        expect(hasGeometry(base2!)).toBe(true);

        const j = firstChildOfType(base2!, JointNode);
        expect(j).toBeDefined();
        expect(j!.jointType).toBe("revolute");
        expect(j!.axis.z).toBeCloseTo(1, 6);
        expect(j!.lowerLimit).toBeCloseTo(-90, 1); // rad -> deg
        expect(j!.upperLimit).toBeCloseTo(90, 1);
        expect(j!.origin.translationPart().x).toBeCloseTo(100, 1); // m -> mm

        const c = firstChildOfType(j!, LinkNode);
        expect(c).toBeDefined();
        expect(c!.name).toBe("child_link");
        expect(hasGeometry(c!)).toBe(true);
    });
});
```
Run `npx rstest packages/builder/test/urdfImporter.test.ts` → FAIL (module not found). (If the `../../core/test/testDocument` import doesn't resolve, match `urdfExporter.test.ts`'s path — it uses the same.)

### Task 2: Implement `importUrdf`
`packages/builder/src/urdf/urdfImporter.ts`:
```ts
// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    type IDocument,
    type IShapeConverter,
    JointNode,
    type JointType,
    LinkNode,
    MathUtils,
    Matrix4,
    XYZ,
} from "@chili3d/core";

const M_TO_MM = 1000;

export function importUrdf(
    urdf: string,
    meshes: Map<string, Uint8Array>,
    document: IDocument,
    converter: IShapeConverter,
): LinkNode | undefined {
    const xml = new DOMParser().parseFromString(urdf, "application/xml");
    const robot = xml.querySelector("robot");
    if (!robot) return undefined;

    const direct = (tag: string) => Array.from(robot.children).filter((c) => c.tagName.toLowerCase() === tag);

    const links = new Map<string, LinkNode>();
    for (const el of direct("link")) {
        const name = el.getAttribute("name") ?? "link";
        const link = new LinkNode({ document, name });
        const massEl = el.querySelector("inertial mass");
        if (massEl) link.mass = Number(massEl.getAttribute("value") ?? "1");
        const filename = el.querySelector("visual mesh")?.getAttribute("filename");
        if (filename) {
            const file = filename.split("/").pop() ?? filename;
            const bytes = meshes.get(file);
            if (bytes) {
                const result = converter.convertFromSTL(document, bytes);
                if (result.isOk) link.add(result.value);
            }
        }
        links.set(name, link);
    }

    const childNames = new Set<string>();
    for (const el of direct("joint")) {
        const name = el.getAttribute("name") ?? "joint";
        const type = (el.getAttribute("type") ?? "fixed") as JointType;
        const parent = links.get(el.querySelector("parent")?.getAttribute("link") ?? "");
        const child = links.get(el.querySelector("child")?.getAttribute("link") ?? "");
        if (!parent || !child) continue;
        childNames.add(child.name);

        const joint = new JointNode({
            document,
            name,
            jointType: type,
            axis: parseVec(el.querySelector("axis")?.getAttribute("xyz"), 0, 0, 1),
            origin: parseOrigin(el.querySelector("origin")),
        });
        const angular = type === "revolute" || type === "continuous";
        const limit = el.querySelector("limit");
        if (limit) {
            const lo = Number(limit.getAttribute("lower") ?? "0");
            const hi = Number(limit.getAttribute("upper") ?? "0");
            joint.lowerLimit = angular ? MathUtils.radToDeg(lo) : lo * M_TO_MM;
            joint.upperLimit = angular ? MathUtils.radToDeg(hi) : hi * M_TO_MM;
        }
        joint.add(child);
        parent.add(joint);
    }

    for (const [name, link] of links) {
        if (!childNames.has(name)) return link;
    }
    return undefined;
}

function parseVec(s: string | null | undefined, dx: number, dy: number, dz: number): XYZ {
    if (!s) return new XYZ({ x: dx, y: dy, z: dz });
    const p = s.trim().split(/\s+/).map(Number);
    return new XYZ({ x: p[0] ?? dx, y: p[1] ?? dy, z: p[2] ?? dz });
}

function parseOrigin(el: Element | null): Matrix4 {
    const xyz = (el?.getAttribute("xyz") ?? "0 0 0").trim().split(/\s+/).map(Number);
    const rpy = (el?.getAttribute("rpy") ?? "0 0 0").trim().split(/\s+/).map(Number);
    const t = Matrix4.fromTranslation((xyz[0] ?? 0) * M_TO_MM, (xyz[1] ?? 0) * M_TO_MM, (xyz[2] ?? 0) * M_TO_MM);
    const [r, p, y] = [rpy[0] ?? 0, rpy[1] ?? 0, rpy[2] ?? 0];
    if (r === 0 && p === 0 && y === 0) return t;
    // rpy = roll(X) pitch(Y) yaw(Z); Matrix4.multiply applies `this` first, so rot.multiply(t) = t·rot (standard).
    return Matrix4.fromEuler(r, p, y).multiply(t);
}
```
VERIFY: `convertFromSTL(document, bytes): Result<FolderNode>` (`.isOk`/`.value`); `link.add(result.value)` nests the imported geometry folder under the link (the round-trip test only requires geometry to be PRESENT, not a direct child — re-export of imported STL geometry is a deferred limit). `DOMParser` parses in happy-dom; if `parseFromString(urdf, "application/xml")` misbehaves in the test env, confirm with a quick console check and, only if broken, fall back to a minimal regex parse — but try DOMParser first. `Matrix4.fromEuler` is only exercised by rotated origins (the test origin is a pure translation → `t` returned directly).
- [ ] Run `npx rstest packages/builder/test/urdfImporter.test.ts` → PASS.
- [ ] `npm run check` (stage only the 2 files). Commit:
```bash
git add packages/builder/src/urdf/urdfImporter.ts packages/builder/test/urdfImporter.test.ts
git commit -m "✨ feat(builder): add importUrdf (URDF + meshes → Link/Joint tree)"
```

---

## UNIT B — `.urdf` import wiring

**Files:** Modify `packages/builder/src/defaultDataExchange.ts`.

### Task 3: Unzip + import
READ the `import(document, files)` method and `importFormats()` first.
- [ ] Add `".urdf"` to `importFormats()`.
- [ ] Add the import import: `import { importUrdf } from "./urdf/urdfImporter";`.
- [ ] In `import(document, files)`, dispatch `.urdf` files to a new helper. The existing import reads file content per extension; add a `.urdf` branch (matching how the method detects extension — mirror the `.stl`/`.step` dispatch) that calls:
```ts
    private async importUrdfZip(document: IDocument, file: File): Promise<void> {
        const JSZip = (await import("jszip")).default;
        const zip = await JSZip.loadAsync(await file.arrayBuffer());
        const urdfEntry = zip.file(/\.urdf$/i)[0] ?? zip.file("robot.urdf");
        if (!urdfEntry) {
            PubSub.default.pub("showToast", "error.import.unsupportedFileType:{0}", file.name);
            return;
        }
        const urdf = await urdfEntry.async("string");
        const meshes = new Map<string, Uint8Array>();
        const entries = zip.file(/meshes\//i);
        for (const e of entries) {
            const name = e.name.split("/").pop()!;
            meshes.set(name, await e.async("uint8array"));
        }
        const base = importUrdf(urdf, meshes, document, document.application.shapeFactory.converter);
        if (base) {
            document.modelManager.addNode(base);
            document.visual.update();
        }
    }
```
and wire the `.urdf` extension to call `await this.importUrdfZip(document, file)` inside `import()`'s per-file handling (match the existing extension-check pattern; the existing code uses helpers like `extensionIs(fileName, ".stl")` — use the same to detect `.urdf` and route to `importUrdfZip`).
VERIFY against the file: how `import()` iterates files and checks extensions; `PubSub`/`error.import.unsupportedFileType:{0}` usage; `document.application.shapeFactory.converter` (matches `exportStl`/`importStl`); `zip.file(regex)` returns an array in jszip. Adapt to the real method shape if it differs.
- [ ] `npm run build 2>&1 | grep -iE "error|urdf" | head` → no `error` lines. `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -i defaultDataExchange || echo clean`.
- [ ] `npm run check` (stage only `defaultDataExchange.ts`). Commit:
```bash
git add packages/builder/src/defaultDataExchange.ts
git commit -m "✨ feat(builder): register .urdf import (unzip + importUrdf)"
```

---

## Self-Review
- **Spec coverage:** importUrdf parse/links/joints/units (§3.1 → Task 2), round-trip test (§6 → Task 1), unzip+wiring (§3.2 → Task 3). ✅
- **Placeholders:** none; complete code. Genuine risks flagged with concrete checks: DOMParser-in-happy-dom (try first, regex fallback only if broken), `Matrix4.fromEuler` ordering (not exercised by the translation-only test), and the `import()` dispatch shape (verify against the real method).
- **Type consistency:** `importUrdf(urdf: string, meshes: Map<string,Uint8Array>, document: IDocument, converter: IShapeConverter): LinkNode | undefined` identical across test, impl, and the wiring call site. Inverse units mirror B3a (×1000, radToDeg).
- **Known v1 limits (do not fix here):** imported STL geometry is nested under the link (re-export of *imported* meshes deferred — export reads B-rep ShapeNodes, STL import yields mesh nodes); rotated joint origins rely on `fromEuler` inverting `getEulerAngles` (translation-only authored case covered); only the chili3d-exported zip structure (not arbitrary external URDFs).
