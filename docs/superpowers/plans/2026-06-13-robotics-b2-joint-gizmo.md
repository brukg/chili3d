# Robotics B2 — 3D Joint Actuation Gizmo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development for **Unit A only** (it is headlessly testable). Units B & C are **interaction/integration work that cannot be headlessly tested** — execute them with live in-browser verification (see each unit's "Verification" section), NOT fire-and-forget subagent TDD.

**Goal:** Drag a 3D handle on a selected `JointNode` (rotation ring for revolute/continuous, translation arrow for prismatic) to actuate it live.

**Architecture:** Three.js `TransformControls` constrained to the joint's single DOF, attached to a proxy at the joint's world frame; the proxy's local-Z rotation/translation maps to `joint.value` (B1's setter drives FK). A selection-driven controller shows/hides the gizmo.

**Tech Stack:** TypeScript, Three.js (`TransformControls`), Rstest. Design ref: `docs/superpowers/specs/2026-06-13-robotics-b2-joint-gizmo-design.md`.

**Convention (matches B1):** the joint's local DOF is about/along **local Z**; `JointGizmo` orients the proxy so local Z = `joint.axis`, so all the value math lives in the canonical local-Z frame. `value` is **degrees** for revolute/continuous, **mm** for prismatic.

---

## UNIT A — `jointGizmoMath` (pure, fully testable) ✅ subagent-TDD

**Files:** Create `packages/three/src/jointGizmoMath.ts`, `packages/three/test/jointGizmoMath.test.ts`.

Verified APIs: `Matrix4.identity()/fromTranslation(x,y,z)/fromAxisRad(pos,axis,rad)/ofPoint(p)/ofVector(v)`; `XYZ.zero/unitZ/unitX`; `MathUtils.degToRad/radToDeg` — all from `@chili3d/core`.

### Task 1: Failing test
Create `packages/three/test/jointGizmoMath.test.ts`:
```ts
// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { MathUtils, Matrix4, XYZ } from "@chili3d/core";
import { describe, expect, test } from "@rstest/core";
import { dofToValue, valueToDof } from "../src/jointGizmoMath";

describe("jointGizmoMath", () => {
    test("prismatic: value↔dof round-trips along local Z (mm)", () => {
        const dof = valueToDof("prismatic", 10);
        // the DOF translates the origin +10 along local Z
        expect(dof.ofPoint(XYZ.zero).distanceTo(new XYZ({ x: 0, y: 0, z: 10 }))).toBeLessThan(1e-6);
        expect(dofToValue("prismatic", dof)).toBeCloseTo(10, 6);
    });

    test("revolute: value↔dof round-trips as rotation about local Z (degrees)", () => {
        const dof = valueToDof("revolute", 90);
        // local X (1,0,0) rotates to (0,1,0)
        expect(dof.ofVector(XYZ.unitX).distanceTo(new XYZ({ x: 0, y: 1, z: 0 }))).toBeLessThan(1e-6);
        expect(dofToValue("revolute", dof)).toBeCloseTo(90, 6);
    });

    test("continuous behaves like revolute", () => {
        expect(dofToValue("continuous", valueToDof("continuous", -45))).toBeCloseTo(-45, 6);
    });

    test("fixed maps to identity / zero", () => {
        expect(valueToDof("fixed", 33).equals(Matrix4.identity())).toBe(true);
        expect(dofToValue("fixed", Matrix4.fromTranslation(0, 0, 5))).toBe(0);
    });

    test("revolute reads a directly-built rotation matrix", () => {
        const dof = Matrix4.fromAxisRad(XYZ.zero, XYZ.unitZ, MathUtils.degToRad(30));
        expect(dofToValue("revolute", dof)).toBeCloseTo(30, 6);
    });
});
```
- [ ] Run `npx rstest packages/three/test/jointGizmoMath.test.ts` → FAIL (module not found).

### Task 2: Implement
Create `packages/three/src/jointGizmoMath.ts`:
```ts
// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { MathUtils, Matrix4, XYZ } from "@chili3d/core";
import type { JointType } from "@chili3d/core";

// The joint's DOF is expressed in a canonical frame whose Z axis is the joint axis:
// revolute/continuous rotate about local Z (value in degrees); prismatic translates
// along local Z (value in mm); fixed has no DOF. JointGizmo is responsible for
// orienting the proxy so its local Z aligns with joint.axis, so this math is axis-agnostic.

export function valueToDof(jointType: JointType, value: number): Matrix4 {
    switch (jointType) {
        case "revolute":
        case "continuous":
            return Matrix4.fromAxisRad(XYZ.zero, XYZ.unitZ, MathUtils.degToRad(value));
        case "prismatic":
            return Matrix4.fromTranslation(0, 0, value);
        default:
            return Matrix4.identity();
    }
}

export function dofToValue(jointType: JointType, dof: Matrix4): number {
    switch (jointType) {
        case "prismatic":
            return dof.ofPoint(XYZ.zero).z;
        case "revolute":
        case "continuous": {
            const rotatedX = dof.ofVector(XYZ.unitX);
            return MathUtils.radToDeg(Math.atan2(rotatedX.y, rotatedX.x));
        }
        default:
            return 0;
    }
}
```
> `JointType` is exported from `@chili3d/core` (Unit B1). `dof` is the joint's DOF transform relative to its rest frame — `JointGizmo` computes it as `restFrame.invert() · proxy.matrixWorld` before calling `dofToValue`.
- [ ] Run `npx rstest packages/three/test/jointGizmoMath.test.ts` → all 5 PASS. `npm run check` (stage only these 2 files). Commit:
```bash
git add packages/three/src/jointGizmoMath.ts packages/three/test/jointGizmoMath.test.ts
git commit -m "✨ feat(three): add jointGizmoMath (value↔DOF conversions)"
```

---

## UNIT B — `JointGizmo` (TransformControls integration) ⚠️ exploratory + manual verify

**Files:** Create `packages/three/src/jointGizmo.ts`; export from `packages/three/src/index.ts`.

**This unit is NOT headlessly testable.** It is implemented against the live app. Below is the concrete starting structure; the items marked **[INVESTIGATE]** are the known unknowns to resolve while running `npm run dev`.

### Starting structure
```ts
// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { type IDisposable, type JointNode, Matrix4 } from "@chili3d/core";
import { Object3D, Quaternion, Vector3 } from "three";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
import { dofToValue, valueToDof } from "./jointGizmoMath";
import { ThreeHelper } from "./threeHelper"; // verify name: helper that converts Matrix4 <-> THREE.Matrix4
import type { ThreeView } from "./threeView";

export class JointGizmo implements IDisposable {
    private readonly proxy = new Object3D();
    private readonly controls: TransformControls;
    private dragging = false;

    constructor(
        private readonly view: ThreeView,
        private readonly joint: JointNode,
    ) {
        this.placeProxyAtJointRestFrame();
        this.controls = new TransformControls(view.camera, view.renderer.domElement);
        this.configureForJointType();
        view.content.scene.add(this.proxy);
        view.content.scene.add(this.controls.getHelper ? this.controls.getHelper() : (this.controls as unknown as Object3D)); // [INVESTIGATE] helper attach API for this three version
        this.controls.attach(this.proxy);
        this.controls.addEventListener("objectChange", this.onObjectChange);
        this.controls.addEventListener("dragging-changed", this.onDraggingChanged);
    }

    private placeProxyAtJointRestFrame() {
        // Rest frame = joint world transform WITHOUT the DOF (i.e. parent.world · origin).
        // Practical approach: proxy world = joint.worldTransform() · valueToDof(type, value)
        // so the handle starts at the current actuated pose. Orient proxy so local Z = joint.axis.
        // [INVESTIGATE] exact composition + Matrix4 <-> THREE.Matrix4 via ThreeHelper.
        const world = this.joint.worldTransform();
        ThreeHelper.applyMatrixToObject(this.proxy, world); // [INVESTIGATE] real helper API
    }

    private configureForJointType() {
        this.controls.setSpace("local");
        this.controls.showX = false;
        this.controls.showY = false;
        this.controls.showZ = true;
        switch (this.joint.jointType) {
            case "revolute":
            case "continuous":
                this.controls.setMode("rotate");
                break;
            case "prismatic":
                this.controls.setMode("translate");
                break;
            default: // fixed → no DOF; hide everything
                this.controls.showZ = false;
                this.controls.enabled = false;
        }
    }

    private readonly onDraggingChanged = (e: { value: boolean }) => {
        this.dragging = e.value;
        // [INVESTIGATE] suspend the chili3d CameraController while dragging so orbit
        // doesn't fight the gizmo, restore on release. CameraController has no obvious
        // `enabled` flag — find how it consumes pointer events and gate it here.
        this.view.update();
    };

    private readonly onObjectChange = () => {
        if (!this.dragging) return; // write value only during an active drag
        const restFrame = this.joint.worldTransform().invert();
        if (!restFrame) return;
        const proxyWorld = ThreeHelper.matrixOfObject(this.proxy); // [INVESTIGATE] real helper API → Matrix4
        const dof = restFrame.multiply(proxyWorld);
        this.joint.value = dofToValue(this.joint.jointType, dof);
        this.view.update();
    };

    dispose(): void {
        this.controls.removeEventListener("objectChange", this.onObjectChange);
        this.controls.removeEventListener("dragging-changed", this.onDraggingChanged);
        this.controls.detach();
        this.controls.dispose();
        this.view.content.scene.remove(this.proxy);
        this.view.update();
    }
}
```

### [INVESTIGATE] checklist (resolve while running the app)
1. **Matrix4 ↔ THREE.Matrix4 bridge** — find the existing helper (`ThreeHelper` is referenced across the three package, e.g. `threeVisualObject.ts` `ThreeHelper.toMatrix`). Use the real method names to set the proxy's matrix from `joint.worldTransform()` and to read it back. Do NOT invent helper methods — grep `ThreeHelper`.
2. **TransformControls helper attach** — in this Three.js version, confirm whether you add `controls` directly to the scene or `controls.getHelper()` (newer API). Grep the installed `TransformControls.js`.
3. **Event conflict** (top risk) — `TransformControls` attaches its own listeners to `renderer.domElement`. Confirm the gizmo actually receives drags given chili3d's own view event handling; if it doesn't, coordinate with the view's `eventHandler`/`viewHandler`.
4. **Camera suspension** — `CameraController` has no obvious enable flag; find how it processes pointer events and suspend orbit/pan during `dragging-changed: true`, restore on `false`.
5. **Rest-frame vs proxy composition** — verify the sign/order so dragging increases `value` in the expected direction; correct against the live FK behavior.

### Verification (manual, in-browser)
`npm run dev` → create a Box, run **Create Joint** (B1) on it, select the joint. Confirm: a ring (revolute) appears on the joint axis; dragging it rotates the child box live; limits stop it; the camera does not orbit while dragging; switching `jointType` to prismatic (property panel) and re-selecting shows an arrow that translates. Record a short GIF (`gif_creator`) of the articulation for the PR.

### Commit (after the app verifies)
```bash
git add packages/three/src/jointGizmo.ts packages/three/src/index.ts
git commit -m "✨ feat(three): add JointGizmo (TransformControls-based joint actuation handle)"
```

---

## UNIT C — `JointGizmoController` (selection lifecycle) — partially testable

**Files:** Create `packages/three/src/jointGizmoController.ts` + `packages/three/test/jointGizmoController.test.ts`; register in `packages/builder/src/appBuilder.ts`.

### Lifecycle (testable with TestView/TestDocument)
```ts
// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { type IApplication, type IDisposable, type INode, JointNode, PubSub } from "@chili3d/core";
import { JointGizmo } from "./jointGizmo";
import type { ThreeView } from "./threeView";

export class JointGizmoController implements IDisposable {
    private gizmo?: JointGizmo;

    constructor(private readonly app: IApplication) {
        PubSub.default.sub("selectionChanged", this.onSelectionChanged);
    }

    private readonly onSelectionChanged = (_doc: unknown, selected: INode[]) => {
        this.gizmo?.dispose();
        this.gizmo = undefined;
        const view = this.app.activeView as ThreeView | undefined;
        if (view && selected.length === 1 && selected[0] instanceof JointNode) {
            this.gizmo = new JointGizmo(view, selected[0]);
        }
    };

    dispose(): void {
        PubSub.default.remove("selectionChanged", this.onSelectionChanged);
        this.gizmo?.dispose();
        this.gizmo = undefined;
    }
}
```
> VERIFY: the `selectionChanged` payload order (`(document, selected, unselected)`) against `pubsub.ts:31`; `IApplication.activeView` exists and is the `ThreeView`; how the builder gets an `IApplication`/document to construct this. [INVESTIGATE] the cleanest registration point — likely alongside the `ShowPropertyEventHandler` creation in `appBuilder.ts:89` (`useThree`), or as a service in `getServices()`. Match whichever fits without forcing `app`→`three` coupling (this controller IS in three, so it's fine).

### Test (headless, lifecycle only — NOT the drag)
Use `TestView`/`TestDocument` (see `packages/three/test/three.test.ts`) + a stub/minimal `JointGizmo` boundary: assert that publishing `selectionChanged` with one `JointNode` creates a gizmo and that publishing with a non-joint / empty selection disposes it. If `JointGizmo`'s constructor can't run under the mocked WebGL `TestView`, refactor `JointGizmoController` to take a gizmo-factory function (injected) so the lifecycle is testable without real `TransformControls` — this dependency injection is the recommended structure.

### Verification & commit
Manual: same in-browser session as Unit B — selecting a joint shows the gizmo, selecting anything else removes it. Then:
```bash
git add packages/three/src/jointGizmoController.ts packages/three/test/jointGizmoController.test.ts packages/builder/src/appBuilder.ts packages/three/src/index.ts
git commit -m "✨ feat(three): add JointGizmoController (show gizmo on joint selection)"
```

---

## Self-Review
- **Spec coverage:** jointGizmoMath (§3.1 → Unit A, fully tested); JointGizmo (§3.2 → Unit B); JointGizmoController (§3.3 → Unit C); data flow §4 (value↔proxy) realized in A+B; testing strategy §6 honored (headless A+C-lifecycle, manual B); risks §7 surfaced as the **[INVESTIGATE]** checklist.
- **Placeholder honesty:** Unit A is complete exact code. Units B/C contain explicit **[INVESTIGATE]** markers — these are deliberate, not lazy placeholders: they are the genuine integration unknowns the design (§7) flagged, and pretending to pre-specify them as exact code would be dishonest. They MUST be resolved against the running app, not guessed.
- **Type consistency:** `valueToDof`/`dofToValue(jointType: JointType, …)` identical across math, test, and `JointGizmo`. `JointGizmo(view: ThreeView, joint: JointNode)` and `JointGizmoController(app)` consistent across Unit C + registration.
- **Execution note:** Unit A → subagent-driven TDD. Units B/C → live in-browser implementation + verification (the main agent drives the browser, or the user runs it); do NOT hand B/C to a fire-and-forget subagent that cannot verify interaction.
