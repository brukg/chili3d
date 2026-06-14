# Robotics B3a — LinkNode + URDF Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Checkbox (`- [ ]`) steps.

**Goal:** Author a kinematic robot (links + joints) in chili3d and export it as a URDF ZIP (`.urdf` + per-link STL) that loads in ROS/RViz/sim.

**Architecture:** A `LinkNode` (named rigid body) + a "Create Link" command for authoring, plus a pure `exportUrdf(rootLink, name, converter)` that walks the Link/Joint tree into a URDF XML string + per-link STL bytes; `DefaultDataExchange` packs them into a ZIP via jszip under a new `.urdf` export format. URDF is metres+radians, chili3d is mm+degrees — conversions applied throughout.

**Tech Stack:** TypeScript monorepo, OCCT/WASM `convertToSTL`, jszip, Rstest. Design ref: `docs/superpowers/specs/2026-06-14-robotics-b3a-linknode-urdf-export-design.md`.

**Verified APIs:** `Matrix4.translationPart(): XYZ`, `getEulerAngles(): {pitch,yaw,roll}` (pitch=rotX, yaw=rotY, roll=rotZ); `BoundingBox` (`min`/`max`, `BoundingBox.center`); `IShapeConverter.convertToSTL(shapes, {binary}): Result<Uint8Array>`; jszip via `await import("jszip")` → `new JSZip()`, `zip.file(name, bytes)`, `await zip.generateAsync({type:"uint8array"})`; `MathUtils.degToRad`; `ShapeNode.shape: Result<IShape>`, `VisualNode.transform: Matrix4`; node types `LinkNode`/`JointNode`/`ShapeNode` from `@chili3d/core`.

---

## UNIT A — `LinkNode` + "Create Link" command (authoring)

### Task 1: `LinkNode`
**Files:** Create `packages/core/src/model/linkNode.ts`; modify `packages/core/src/model/index.ts`; test `packages/core/test/linkNode.test.ts`.

- [ ] **Step 1: Failing test** — `packages/core/test/linkNode.test.ts`:
```ts
// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { type IDocument, LinkNode } from "../src";
import { TestDocument } from "./testDocument";

describe("LinkNode", () => {
    const doc: IDocument = new TestDocument() as any;

    test("is a named container with a default mass of 1", () => {
        const link = new LinkNode({ document: doc, name: "base_link" });
        expect(link.name).toBe("base_link");
        expect(link.mass).toBe(1);
        link.mass = 2.5;
        expect(link.mass).toBe(2.5);
    });
});
```
Run `npx rstest packages/core/test/linkNode.test.ts` → FAIL (`LinkNode` undefined).

- [ ] **Step 2: Implement** — `packages/core/src/model/linkNode.ts`:
```ts
// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { property } from "../property";
import { serializable, serialize } from "../serialize";
import { GroupNode } from "./groupNode";

/**
 * A named rigid body in a kinematic tree. Its direct geometry children are the link's
 * visual geometry; its JointNode children connect it to child links. Maps to a URDF <link>.
 */
@serializable()
export class LinkNode extends GroupNode {
    @serialize()
    @property("link.mass")
    get mass(): number {
        return this.getPrivateValue("mass", 1);
    }
    set mass(value: number) {
        this.setProperty("mass", value);
    }
}
```
- [ ] **Step 3:** In `packages/core/src/model/index.ts`, add `export * from "./linkNode";` (alphabetical, after `./jointNode`). Run the test → PASS.
- [ ] **Step 4:** Add `"link.mass"` to `packages/core/src/i18n/keys.ts` (`I18N_KEYS`, alphabetical) and to en/zh-cn/pt-br (`"link.mass": "Mass"` / `"质量"` / `"Massa"`). Run `npm run build 2>&1 | grep -iE "error|link" | head` → no error lines.
- [ ] **Step 5: Commit**
```bash
git add packages/core/src/model/linkNode.ts packages/core/src/model/index.ts packages/core/test/linkNode.test.ts packages/core/src/i18n/keys.ts packages/i18n/src/en.ts packages/i18n/src/zh-cn.ts packages/i18n/src/pt-br.ts
git commit -m "✨ feat(core): add LinkNode (named rigid body for URDF)"
```

### Task 2: "Create Link" command
**Files:** Create `packages/app/src/commands/modify/createLink.ts`; modify `modify/index.ts`, `ribbon.ts`, `keys.ts` + locales.

- [ ] **Step 1: Implement** — `packages/app/src/commands/modify/createLink.ts` (mirrors `createJoint.ts` but no pivot/origin math — a link is just a named wrapper):
```ts
// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { command, GetOrSelectNodeStep, type IStep, LinkNode, Transaction, VisualNode } from "@chili3d/core";
import { MultistepCommand } from "../multistepCommand";

@command({
    key: "modify.createLink",
    icon: "icon-fillet",
})
export class CreateLinkCommand extends MultistepCommand {
    protected override getSteps(): IStep[] {
        return [new GetOrSelectNodeStep("prompt.select.shape", { multiple: false })];
    }

    protected override executeMainTask(): void {
        const nodes = this.stepDatas[0].nodes?.filter((node) => node instanceof VisualNode);
        if (!nodes || nodes.length === 0) {
            return;
        }
        Transaction.execute(this.document, `execute ${Object.getPrototypeOf(this).data.name}`, () => {
            const node = nodes[0];
            const parent = node.parent ?? this.document.modelManager.rootNode;
            const link = new LinkNode({ document: this.document, name: "Link" });
            parent.insertBefore(node, link);
            parent.move(node, link);
            this.document.visual.update();
        });
    }
}
```
VERIFY imports against `createJoint.ts` (which uses the same `GetOrSelectNodeStep`/`VisualNode`/`Transaction`/`insertBefore`+`move` pattern).
- [ ] **Step 2:** `modify/index.ts`: add `export * from "./createLink";`. `ribbon.ts`: add `"modify.createLink"` to the modify group near `"modify.createJoint"` (keep columns ≤3 buttons — add a new short column `["modify.createLink", "modify.createJoint"]` if the current ones are full). i18n: add `"command.modify.createLink"` to `keys.ts` + en ("Create Link") / zh-cn ("创建连杆") / pt-br ("Criar Elo").
- [ ] **Step 3:** `npm run build 2>&1 | grep -iE "error|createLink" | head` → no error lines.
- [ ] **Step 4: Commit**
```bash
git add packages/app/src/commands/modify/createLink.ts packages/app/src/commands/modify/index.ts packages/builder/src/ribbon.ts packages/core/src/i18n/keys.ts packages/i18n/src/en.ts packages/i18n/src/zh-cn.ts packages/i18n/src/pt-br.ts
git commit -m "✨ feat(app): add Create Link command"
```

---

## UNIT B — `exportUrdf` (the core, fully testable)

**Files:** Create `packages/builder/src/urdf/urdfExporter.ts`; test `packages/builder/test/urdfExporter.test.ts`.

The exporter is PURE: it takes the root `LinkNode`, a robot name, and an `IShapeConverter` (so the test supplies `new ShapeFactory().converter` and it does NOT depend on the global `shapeFactory`).

### Task 3: Failing test
`packages/builder/test/urdfExporter.test.ts`:
```ts
// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { readFileSync } from "node:fs";
import path from "node:path";
import { EditableShapeNode, JointNode, LinkNode, Matrix4, Plane } from "@chili3d/core";
import { initWasm, ShapeFactory } from "@chili3d/wasm";
import { describe, expect, test } from "@rstest/core";
import { TestDocument } from "../../core/test/testDocument";
import { exportUrdf } from "../src/urdf/urdfExporter";

const WASM_BINARY = readFileSync(path.join(process.cwd(), "packages/wasm/lib/chili-wasm.wasm"));

describe("exportUrdf", () => {
    test("exports base→revolute→child as a URDF with correct types, frames, and meshes", async () => {
        await initWasm({ wasmBinary: WASM_BINARY });
        const factory = new ShapeFactory();
        const doc = new TestDocument() as any;

        const base = new LinkNode({ document: doc, name: "base_link" });
        base.add(new EditableShapeNode({ document: doc, name: "g", shape: factory.box(Plane.XY, 20, 20, 20) }));

        const child = new LinkNode({ document: doc, name: "child_link" });
        child.add(new EditableShapeNode({ document: doc, name: "g", shape: factory.box(Plane.XY, 10, 10, 10) }));

        // joint at (100,0,0) mm, revolute about Z, limits ±90°, wrapping the child link
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

        expect(urdf).toContain('<robot name="robot">');
        expect(urdf).toContain('<link name="base_link">');
        expect(urdf).toContain('<link name="child_link">');
        expect(urdf).toContain('type="revolute"');
        expect(urdf).toContain('<parent link="base_link"/>');
        expect(urdf).toContain('<child link="child_link"/>');
        expect(urdf).toContain('xyz="0.1 0 0"'); // 100 mm -> 0.1 m
        expect(urdf).toContain('<axis xyz="0 0 1"/>');
        expect(urdf).toMatch(/lower="-1\.5708\d*"/); // -90deg -> -pi/2 rad
        expect(urdf).toContain('scale="0.001 0.001 0.001"');
        expect(meshes.has("base_link.stl")).toBe(true);
        expect(meshes.get("base_link.stl")!.length).toBeGreaterThan(0);
        expect(meshes.has("child_link.stl")).toBe(true);
    });
});
```
Run `npx rstest packages/builder/test/urdfExporter.test.ts` → FAIL (module not found).

### Task 4: Implement `exportUrdf`
`packages/builder/src/urdf/urdfExporter.ts`:
```ts
// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    BoundingBox,
    type IShape,
    type IShapeConverter,
    JointNode,
    LinkNode,
    MathUtils,
    ShapeNode,
    type VisualNode,
} from "@chili3d/core";

const MM_TO_M = 0.001;

export interface UrdfExport {
    urdf: string;
    meshes: Map<string, Uint8Array>;
}

export function exportUrdf(root: LinkNode, robotName: string, converter: IShapeConverter): UrdfExport {
    const meshes = new Map<string, Uint8Array>();
    const used = new Set<string>();
    const links: string[] = [];
    const joints: string[] = [];

    const sanitize = (name: string): string => {
        let base = name.replace(/[^A-Za-z0-9_]/g, "_") || "node";
        let n = base;
        let i = 1;
        while (used.has(n)) n = `${base}_${i++}`;
        used.add(n);
        return n;
    };

    const num = (v: number): string => (Math.abs(v) < 1e-9 ? "0" : `${+v.toFixed(6)}`);

    const walkLink = (link: LinkNode): string => {
        const linkName = sanitize(link.name);
        const shapes = collectLinkShapes(link);
        let visual = "";
        if (shapes.length > 0) {
            const stl = converter.convertToSTL(shapes, { binary: true });
            if (stl.isOk) {
                const file = `${linkName}.stl`;
                meshes.set(file, stl.value);
                const meshTag = `<geometry><mesh filename="meshes/${file}" scale="0.001 0.001 0.001"/></geometry>`;
                const inertial = inertialXml(boundingBoxOf(shapes), link.mass);
                visual = `<visual>${meshTag}</visual><collision>${meshTag}</collision>${inertial}`;
            }
        }
        links.push(`  <link name="${linkName}">${visual}</link>`);

        for (const joint of childJoints(link)) {
            const childLink = childLinkOf(joint);
            if (!childLink) continue;
            const childName = walkLink(childLink);
            joints.push(jointXml(joint, linkName, childName, num));
        }
        return linkName;
    };

    walkLink(root);
    const urdf =
        `<?xml version="1.0"?>\n<robot name="${robotName.replace(/[^A-Za-z0-9_]/g, "_")}">\n` +
        `${links.join("\n")}\n${joints.join("\n")}\n</robot>\n`;
    return { urdf, meshes };

    function jointXml(joint: JointNode, parent: string, child: string, fmt: (v: number) => string): string {
        const t = joint.origin.translationPart();
        const e = joint.origin.getEulerAngles(); // pitch=rotX, yaw=rotY, roll=rotZ
        const xyz = `${fmt(t.x * MM_TO_M)} ${fmt(t.y * MM_TO_M)} ${fmt(t.z * MM_TO_M)}`;
        const rpy = `${fmt(e.pitch)} ${fmt(e.yaw)} ${fmt(e.roll)}`;
        const a = joint.axis;
        const head =
            `  <joint name="${sanitize(joint.name)}" type="${joint.jointType}">\n` +
            `    <parent link="${parent}"/>\n    <child link="${child}"/>\n` +
            `    <origin xyz="${xyz}" rpy="${rpy}"/>\n`;
        if (joint.jointType === "fixed") return `${head}  </joint>`;
        const axis = `    <axis xyz="${fmt(a.x)} ${fmt(a.y)} ${fmt(a.z)}"/>\n`;
        const angular = joint.jointType === "revolute" || joint.jointType === "continuous";
        const lower = angular ? MathUtils.degToRad(joint.lowerLimit) : joint.lowerLimit * MM_TO_M;
        const upper = angular ? MathUtils.degToRad(joint.upperLimit) : joint.upperLimit * MM_TO_M;
        const limit =
            joint.jointType === "continuous"
                ? `    <limit effort="100" velocity="10"/>\n`
                : `    <limit lower="${fmt(lower)}" upper="${fmt(upper)}" effort="100" velocity="10"/>\n`;
        return `${head}${axis}${limit}  </joint>`;
    }
}

// A link's geometry = its direct ShapeNode children (transformed into the link frame).
function collectLinkShapes(link: LinkNode): IShape[] {
    const shapes: IShape[] = [];
    let n = link.firstChild;
    while (n) {
        if (n instanceof ShapeNode && n.shape.isOk) {
            shapes.push(n.shape.value.transformedMul((n as VisualNode).transform));
        }
        n = n.nextSibling;
    }
    return shapes;
}

function childJoints(link: LinkNode): JointNode[] {
    const out: JointNode[] = [];
    let n = link.firstChild;
    while (n) {
        if (n instanceof JointNode) out.push(n);
        n = n.nextSibling;
    }
    return out;
}

function childLinkOf(joint: JointNode): LinkNode | undefined {
    let n = joint.firstChild;
    while (n) {
        if (n instanceof LinkNode) return n;
        n = n.nextSibling;
    }
    return undefined;
}

function boundingBoxOf(shapes: IShape[]): BoundingBox | undefined {
    let box: BoundingBox | undefined;
    for (const s of shapes) {
        box = BoundingBox.combine(box, s.boundingBox());
    }
    return box;
}

// Box-approximation inertia (metres), non-degenerate. dims = bbox extents in mm -> m.
function inertialXml(box: BoundingBox | undefined, mass: number): string {
    const dx = (box ? box.max.x - box.min.x : 1) * MM_TO_M || 0.001;
    const dy = (box ? box.max.y - box.min.y : 1) * MM_TO_M || 0.001;
    const dz = (box ? box.max.z - box.min.z : 1) * MM_TO_M || 0.001;
    const ixx = (mass / 12) * (dy * dy + dz * dz);
    const iyy = (mass / 12) * (dx * dx + dz * dz);
    const izz = (mass / 12) * (dx * dx + dy * dy);
    const f = (v: number) => `${+v.toFixed(8)}`;
    return (
        `<inertial><mass value="${mass}"/>` +
        `<inertia ixx="${f(ixx)}" ixy="0" ixz="0" iyy="${f(iyy)}" iyz="0" izz="${f(izz)}"/></inertial>`
    );
}
```
> Notes (verified): `IShape.boundingBox(): BoundingBox` (`shape.ts:45`) and `BoundingBox.combine(a, b)` (`boundingBox.ts:215`) both exist. `BoundingBox` is a `{min,max}` shape with `min`/`max` as `XYZLike`. The `transformedMul(node.transform)` shape transform mirrors how `defaultDataExchange.getExportShapes` transforms shapes for export.
- [ ] Run `npx rstest packages/builder/test/urdfExporter.test.ts` → PASS.
  > If the rpy assertion or a frame value is off, check `getEulerAngles` order (pitch=rotX, yaw=rotY, roll=rotZ → URDF rpy = `pitch yaw roll`). The test's joint origin is a pure translation, so rpy should be `0 0 0`; only adjust if a rotated origin test is added.
- [ ] `npm run check` (stage only the 2 files). Commit:
```bash
git add packages/builder/src/urdf/urdfExporter.ts packages/builder/test/urdfExporter.test.ts
git commit -m "✨ feat(builder): add exportUrdf (Link/Joint tree → URDF XML + STL meshes)"
```

---

## UNIT C — ZIP packaging + `.urdf` export format

**Files:** Modify `packages/builder/src/defaultDataExchange.ts`.

### Task 5: Wire `.urdf` into the data exchange
- [ ] In `exportFormats()`, append `".urdf"`.
- [ ] Add a private helper and dispatch branch in `export()`. The export is async (jszip), and `export()` is already `async`. When `type === ".urdf"`, find the first selected `LinkNode` and build the zip:
```ts
// add import at top of defaultDataExchange.ts:
//   import { LinkNode } from "@chili3d/core";
//   import { exportUrdf } from "./urdf/urdfExporter";

// inside export(), add a branch before the final else (mirroring the .obj branch):
        } else if (type === ".urdf") {
            return await this.exportUrdfZip(nodes);
```
and the helper method on the class:
```ts
    private async exportUrdfZip(nodes: VisualNode[]): Promise<BlobPart[] | undefined> {
        const root = nodes.find((n) => n instanceof LinkNode) as LinkNode | undefined;
        if (!root) {
            PubSub.default.pub("showToast", "error.export.noNodeCanBeExported");
            return undefined;
        }
        const converter = root.document.application.shapeFactory.converter;
        const { urdf, meshes } = exportUrdf(root, root.name, converter);
        const JSZip = (await import("jszip")).default;
        const zip = new JSZip();
        zip.file("robot.urdf", urdf);
        for (const [name, bytes] of meshes) zip.file(`meshes/${name}`, bytes);
        const blob = await zip.generateAsync({ type: "uint8array" });
        return [blob as BlobPart];
    }
```
VERIFY: `PubSub`, `VisualNode`, `BlobPart` usage matches the rest of `defaultDataExchange.ts`; `root.document.application.shapeFactory.converter` is the converter (the file already uses `doc.application.shapeFactory.converter` in `exportStl`). The export command downloads the result as `<name>.urdf` — since the payload is a zip, confirm the download suffix; if a `.zip` extension is preferred, that's a one-line follow-up in `importExport.ts` (out of scope here — the zip bytes are correct regardless of extension).
- [ ] `npm run build 2>&1 | grep -iE "error|urdf" | head` → no error lines.
- [ ] Commit:
```bash
git add packages/builder/src/defaultDataExchange.ts
git commit -m "✨ feat(builder): register .urdf export (zip of urdf + meshes)"
```

---

## Self-Review
- **Spec coverage:** LinkNode (§3.1 → Task 1), Create Link (§3.2 → Task 2), UrdfExporter incl. link/joint/origin/units/inertia (§3.3/§4 → Task 4), ZIP + format (§3.4 → Task 5), testing (§6 → Tasks 3-4). ✅
- **Placeholders:** none; complete code throughout. The two genuine implementation risks (`getEulerAngles` order, `IShape.boundingBox` method name) are flagged with concrete checks, and the test's translation-only origin makes rpy trivially `0 0 0`.
- **Type consistency:** `exportUrdf(root: LinkNode, robotName: string, converter: IShapeConverter): UrdfExport` identical across the test, the impl, and the `defaultDataExchange` call site. `LinkNode.mass`, `JointNode.{origin,axis,jointType,lowerLimit,upperLimit}` match B1/B3a.
- **Known v1 limits (do not fix here):** a link's geometry = its DIRECT ShapeNode children (deeper nesting within a link deferred); coarse box inertia; default effort/velocity; download extension is `.urdf` even though the payload is a zip (cosmetic follow-up); ROS `check_urdf`/RViz validation is manual per roboforge.
