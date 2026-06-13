# Robotics B1 — Kinematic Joint Node Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Checkbox (`- [ ]`) steps.

**Goal:** Add a `JointNode` (revolute/continuous/prismatic/fixed) whose actuated `value` moves its child sub-tree via forward kinematics, plus a "Create Joint" command to make any node articulable.

**Architecture:** `JointNode extends GroupNode`. Its `value` setter clamps to limits then writes the inherited `transform = origin × dofMatrix(type, axis, value)`. Writing `transform` rides the existing visual-sync path (`packages/three/src/threeVisualObject.ts:304` re-reads `transform` on the `"transform"` property change), so Three.js recomposes the nested child sub-tree — FK with no evaluator. Pure TypeScript (no WASM).

**Tech Stack:** TypeScript npm-workspace monorepo, `@serializable`/`@serialize` + `@property` reactive model, Rstest + `TestDocument`.

**Design ref:** `docs/superpowers/specs/2026-06-13-robotics-b1-joint-nodes-design.md`. **Scope note:** `LinkNode` from the design is DEFERRED — `GroupNode` has no `display()`, so a `LinkNode` here would be a do-nothing marker with no creator command (dead code); it earns its keep at B3 (URDF needs explicit link identity). B1 = `JointNode` + actuation.

**Reference code:** `packages/core/src/model/groupNode.ts` (the `transform` getter/setter + `@serialize` pattern to mirror), `packages/core/test/groupNode.test.ts` (test harness: `new TestDocument() as any`), `packages/app/src/commands/create/group.ts` (`GetOrSelectNodeStep` + `stepDatas[0].nodes` + `Transaction`), `packages/app/src/commands/modify/fillet.ts` (command/ribbon/i18n shape). Verified APIs: `XYZ.zero`/`XYZ.unitZ`/`XYZ.unitX`/`XYZ.normalize(): XYZ|undefined`/`XYZ.distanceTo`; `Matrix4.identity()`/`fromAxisRad(pos, axis, rad)`/`fromTranslation(x,y,z)`/`multiply(other)`/`ofPoint(p)`/`equals(m)`; `MathUtils.degToRad` (exported via `../math`); `INodeLinkedList.insertBefore(target, node)` + `move(child, newParent, prevSibling?)`.

---

## File Structure
| File | Responsibility | Action |
|------|----------------|--------|
| `packages/core/src/model/jointNode.ts` | `JointNode` + `JointType` | Create |
| `packages/core/src/model/index.ts` | export `jointNode` | Modify |
| `packages/core/test/jointNode.test.ts` | headless FK/clamp unit tests | Create |
| `packages/app/src/commands/modify/createJoint.ts` | "Create Joint" command | Create |
| `packages/app/src/commands/modify/index.ts` | export command | Modify |
| `packages/builder/src/ribbon.ts` | ribbon entry | Modify |
| `packages/core/src/i18n/keys.ts` + en/zh-cn/pt-br | i18n keys | Modify |

---

## UNIT A — `JointNode` (core model)

### Task 1: Failing unit test
Create `packages/core/test/jointNode.test.ts`:
```ts
// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { type IDocument, JointNode, Matrix4, XYZ } from "../src";
import { TestDocument } from "./testDocument";

describe("JointNode", () => {
    const doc: IDocument = new TestDocument() as any;

    test("revolute rotates the frame about the axis (value in degrees)", () => {
        const joint = new JointNode({ document: doc, name: "j" });
        joint.jointType = "revolute";
        joint.axis = XYZ.unitZ;
        joint.lowerLimit = -180;
        joint.upperLimit = 180;
        joint.value = 90;
        const p = joint.transform.ofPoint(new XYZ({ x: 10, y: 0, z: 0 }));
        expect(p.distanceTo(new XYZ({ x: 0, y: 10, z: 0 }))).toBeLessThan(1e-6);
    });

    test("prismatic translates along the axis (value in mm)", () => {
        const joint = new JointNode({ document: doc, name: "j", jointType: "prismatic", axis: XYZ.unitX });
        joint.lowerLimit = -100;
        joint.upperLimit = 100;
        joint.value = 10;
        const p = joint.transform.ofPoint(XYZ.zero);
        expect(p.distanceTo(new XYZ({ x: 10, y: 0, z: 0 }))).toBeLessThan(1e-6);
    });

    test("fixed ignores value (transform stays at origin)", () => {
        const joint = new JointNode({ document: doc, name: "j", jointType: "fixed" });
        joint.value = 45;
        expect(joint.transform.equals(Matrix4.identity())).toBe(true);
    });

    test("value clamps to limits for non-continuous joints", () => {
        const joint = new JointNode({ document: doc, name: "j", jointType: "revolute" });
        joint.lowerLimit = -30;
        joint.upperLimit = 30;
        joint.value = 90;
        expect(joint.value).toBe(30);
    });

    test("continuous joint does not clamp", () => {
        const joint = new JointNode({ document: doc, name: "j", jointType: "continuous" });
        joint.lowerLimit = -30;
        joint.upperLimit = 30;
        joint.value = 720;
        expect(joint.value).toBe(720);
    });

    test("origin composes outside the DOF", () => {
        const joint = new JointNode({
            document: doc,
            name: "j",
            jointType: "prismatic",
            axis: XYZ.unitX,
            origin: Matrix4.fromTranslation(0, 0, 5),
        });
        joint.lowerLimit = -100;
        joint.upperLimit = 100;
        joint.value = 10;
        // DOF translates +10 along X in the joint frame, then origin lifts +5 along Z → (10,0,5)
        const p = joint.transform.ofPoint(XYZ.zero);
        expect(p.distanceTo(new XYZ({ x: 10, y: 0, z: 5 }))).toBeLessThan(1e-6);
    });
});
```
- [ ] Run `npx rstest packages/core/test/jointNode.test.ts` → FAIL (`JointNode` not exported / undefined).

### Task 2: Implement `JointNode`
Create `packages/core/src/model/jointNode.ts`:
```ts
// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { MathUtils, Matrix4, XYZ } from "../math";
import { property } from "../property";
import { serializable, serialize } from "../serialize";
import { type FolderNodeOptions } from "./folderNode";
import { GroupNode } from "./groupNode";

export type JointType = "revolute" | "continuous" | "prismatic" | "fixed";

const JOINT_TYPES: JointType[] = ["revolute", "continuous", "prismatic", "fixed"];

export interface JointNodeOptions extends FolderNodeOptions {
    jointType?: JointType;
    axis?: XYZ;
    origin?: Matrix4;
}

@serializable()
export class JointNode extends GroupNode {
    @serialize()
    get origin(): Matrix4 {
        return this.getPrivateValue("origin", Matrix4.identity());
    }
    set origin(value: Matrix4) {
        this.setProperty("origin", value, () => this.updateTransform(), {
            equals: (l, r) => l.equals(r),
        });
    }

    @serialize()
    @property("joint.type")
    get jointType(): JointType {
        return this.getPrivateValue("jointType", "revolute");
    }
    set jointType(value: JointType) {
        if (!JOINT_TYPES.includes(value)) return;
        this.setProperty("jointType", value, () => this.updateTransform());
    }

    @serialize()
    @property("joint.axis")
    get axis(): XYZ {
        return this.getPrivateValue("axis", XYZ.unitZ);
    }
    set axis(value: XYZ) {
        const normalized = value.normalize();
        if (normalized === undefined) return;
        this.setProperty("axis", normalized, () => this.updateTransform());
    }

    @serialize()
    @property("joint.lowerLimit")
    get lowerLimit(): number {
        return this.getPrivateValue("lowerLimit", -180);
    }
    set lowerLimit(value: number) {
        this.setProperty("lowerLimit", value);
    }

    @serialize()
    @property("joint.upperLimit")
    get upperLimit(): number {
        return this.getPrivateValue("upperLimit", 180);
    }
    set upperLimit(value: number) {
        this.setProperty("upperLimit", value);
    }

    @serialize()
    @property("joint.value")
    get value(): number {
        return this.getPrivateValue("value", 0);
    }
    set value(v: number) {
        const clamped =
            this.jointType === "continuous"
                ? v
                : Math.min(
                      Math.max(v, Math.min(this.lowerLimit, this.upperLimit)),
                      Math.max(this.lowerLimit, this.upperLimit),
                  );
        this.setProperty("value", clamped, () => this.updateTransform());
    }

    constructor(options: JointNodeOptions) {
        super(options);
        this.setPrivateValue("jointType", options.jointType ?? "revolute");
        this.setPrivateValue("axis", options.axis ?? XYZ.unitZ);
        this.setPrivateValue("origin", options.origin ?? Matrix4.identity());
        this.updateTransform();
    }

    private updateTransform() {
        this.transform = this.origin.multiply(this.dofMatrix());
    }

    private dofMatrix(): Matrix4 {
        switch (this.jointType) {
            case "revolute":
            case "continuous":
                return Matrix4.fromAxisRad(XYZ.zero, this.axis, MathUtils.degToRad(this.value));
            case "prismatic":
                return Matrix4.fromTranslation(
                    this.axis.x * this.value,
                    this.axis.y * this.value,
                    this.axis.z * this.value,
                );
            default:
                return Matrix4.identity();
        }
    }
}
```
> `setProperty(name, value, onChanged?, equals?)` — the `onChanged` callback runs after the value is stored, so `updateTransform()` reads the new value. `setProperty`/`getPrivateValue`/`setPrivateValue` are inherited from the `Observable` chain (`GroupNode → FolderNode → Node → HistoryObservable → Observable`). No `display()` — `GroupNode` has none; the project tree shows `name`.

### Task 3: Export + make the test pass
- In `packages/core/src/model/index.ts`, add (alphabetical, after `./groupNode`):
```ts
export * from "./jointNode";
```
- [ ] Run `npx rstest packages/core/test/jointNode.test.ts` → all 6 tests PASS.
  > If the `origin composes outside the DOF` test fails (point lands at e.g. (15,0,0) or (10,0,5) swapped), the `Matrix4.multiply` convention is reversed — change `updateTransform` to `this.dofMatrix().multiply(this.origin)` and re-run. The test pins the kinematically-correct result; make it pass without altering the test's expected values.
- [ ] `npm run check` (stage ONLY the 2 intended files; ignore unrelated biome reformats).
- [ ] Commit:
```bash
git add packages/core/src/model/jointNode.ts packages/core/src/model/index.ts packages/core/test/jointNode.test.ts
git commit -m "✨ feat(core): add JointNode kinematic node (revolute/prismatic/fixed/continuous)"
```

---

## UNIT B — "Create Joint" command + wiring

### Task 4: Command
Create `packages/app/src/commands/modify/createJoint.ts`:
```ts
// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    command,
    GetOrSelectNodeStep,
    type IStep,
    JointNode,
    Transaction,
    VisualNode,
} from "@chili3d/core";
import { MultistepCommand } from "../multistepCommand";

@command({
    key: "modify.createJoint",
    icon: "icon-fillet",
})
export class CreateJointCommand extends MultistepCommand {
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
            const joint = new JointNode({ document: this.document, name: "Joint" });
            parent.insertBefore(node, joint);
            parent.move(node, joint);
            this.document.visual.update();
        });
    }
}
```
> VERIFY against `group.ts`: `GetOrSelectNodeStep` is exported from `@chili3d/core` and `stepDatas[0].nodes` is its result; `{ multiple: false }` is a valid option (group.ts uses `{ multiple: true }`). `INodeLinkedList.insertBefore(target, node)` inserts `joint` before `node` under `parent`; `parent.move(node, joint)` then reparents `node` into `joint` (both history-recorded). If `move`'s signature differs, achieve the same end state (parent → joint → node) using the available `INodeLinkedList` methods.

### Task 5: Register + ribbon + i18n
- `packages/app/src/commands/modify/index.ts`: add `export * from "./createJoint";` (match the file's style).
- `packages/builder/src/ribbon.ts`: add `"modify.createJoint"` to the `ribbon.group.modify` group (near `"modify.fillSurface"`).
- `packages/core/src/i18n/keys.ts`: add these to `I18N_KEYS` (alphabetical): `"command.modify.createJoint"`, `"joint.type"`, `"joint.axis"`, `"joint.lowerLimit"`, `"joint.upperLimit"`, `"joint.value"`.
- `packages/i18n/src/en.ts`:
```ts
        "command.modify.createJoint": "Create Joint",
        "joint.type": "Joint Type",
        "joint.axis": "Axis",
        "joint.lowerLimit": "Lower Limit",
        "joint.upperLimit": "Upper Limit",
        "joint.value": "Value",
```
- `packages/i18n/src/zh-cn.ts`:
```ts
        "command.modify.createJoint": "创建关节",
        "joint.type": "关节类型",
        "joint.axis": "轴",
        "joint.lowerLimit": "下限",
        "joint.upperLimit": "上限",
        "joint.value": "值",
```
- `packages/i18n/src/pt-br.ts`:
```ts
        "command.modify.createJoint": "Criar Junta",
        "joint.type": "Tipo de Junta",
        "joint.axis": "Eixo",
        "joint.lowerLimit": "Limite Inferior",
        "joint.upperLimit": "Limite Superior",
        "joint.value": "Valor",
```

### Task 6: Verify + commit
- [ ] `npm run build 2>&1 | grep -iE "error|joint" | head` → NO `error` lines (a missing i18n key shows as a TS error here).
- [ ] `npm run check` (stage ONLY the 7 intended files).
- [ ] Commit:
```bash
git add packages/app/src/commands/modify/createJoint.ts packages/app/src/commands/modify/index.ts packages/builder/src/ribbon.ts packages/core/src/i18n/keys.ts packages/i18n/src/en.ts packages/i18n/src/zh-cn.ts packages/i18n/src/pt-br.ts
git commit -m "✨ feat(app): add Create Joint command (ribbon + i18n)"
```

---

## Self-Review
- **Spec coverage:** JointNode (§3.1 → Task 2), actuation via `value`+`transform` (§3.4/§4 → Task 2 + property panel), Create Joint command (§3.3 → Task 4), tests (§6 → Task 1). `LinkNode` (§3.2) intentionally deferred — noted above. ✅
- **Placeholders:** none; all APIs verified in-repo; the one genuine unknown (`Matrix4.multiply` order) is pinned by the `origin composes` test with an explicit fix instruction.
- **Type consistency:** `JointType` and the field signatures are identical across `jointNode.ts`, the test, and the command (`new JointNode({ document, name })`). `value`/limits are numbers (degrees/mm); `axis` is `XYZ`; `origin` is `Matrix4`.
- **Known v1 limitations (do not fix here):** `jointType` renders as a text input (no enum-select control exists — a select dropdown is a follow-up); actuation is via the property panel `value` field (no slider/gizmo yet); `icon-fillet` placeholder icon; `LinkNode`/URDF deferred to B3.
