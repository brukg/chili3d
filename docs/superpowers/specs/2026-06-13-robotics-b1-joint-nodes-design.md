# Robotics B1 — Kinematic Joint/Link Nodes (Design)

**Date:** 2026-06-13
**Status:** Approved design (nested-containment approach + components).
**Scope:** First sub-project of Tier B (robotics). Goal: **actuate joints in-app** — build a kinematic assembly in chili3d and interactively pose it. Defer mass/inertia/collision and URDF I/O.

---

## 1. Goal & scope

Add a minimal kinematic-articulation model so a user can make part of the model tree *articulated* and pose it: a joint with a type (revolute/continuous/prismatic/fixed), an axis, a fixed mount origin, limits, and an actuated value. Changing the value moves the articulated sub-tree (forward kinematics).

**In scope (B1):** `JointNode`, `LinkNode`, a "Create Joint" command, and value-driven actuation via the existing property panel; a headless unit test of the joint transform math.

**Deferred (later Tier B):** explicit multi-body FK evaluator (not needed — see §3), URDF import/export (B3), a drag-slider / 3D actuation gizmo, mass/inertia/collision and the rest of URDF fidelity, branching-chain authoring conveniences.

---

## 2. Approach — nested containment (chosen)

A kinematic chain maps onto chili3d's existing node tree by **nesting the articulated sub-tree inside the joint**:

```
LinkNode (parent body)            ← GroupNode, transform = its placement
└── JointNode                     ← GroupNode, transform = origin × DOF(type, axis, value)
    └── LinkNode (child body)     ← GroupNode, holds the child geometry
        └── ...geometry / next JointNode...
```

Because the Three.js visual layer already auto-composes parent×child world transforms, and a `GroupNode`'s visual object already re-reads `node.transform` on every `"transform"` property change (`packages/three/src/threeVisualObject.ts:300-306`), **writing a new `transform` on the joint moves its entire child sub-tree with no custom evaluator.** URDF is itself a tree of links connected by joints, so nothing is lost (closed kinematic loops are not URDF-representable anyway).

Rejected alternatives: (B) flat links + parent/child references with a bespoke FK evaluator — more faithful to URDF's literal structure but adds a recompute engine and derived-state bookkeeping for no benefit at this scope; (C) joints as link properties — not selectable/editable as tree entities.

---

## 3. Components

### 3.1 `JointNode extends GroupNode` — `packages/core/src/model/jointNode.ts`
The one substantive new abstraction.

Serialized / editable fields:
- `@serialize() origin: Matrix4` — fixed mount: parent-link frame → joint frame. Default `Matrix4.identity()`.
- `@property @serialize() jointType: JointType` — `"revolute" | "continuous" | "prismatic" | "fixed"`.
- `@property @serialize() axis: XYZ` — unit axis in the joint frame. Default `XYZ.unitZ`.
- `@property @serialize() lowerLimit: number`, `@property @serialize() upperLimit: number` — DOF limits (ignored for `fixed`; `continuous` is unbounded).
- `@property @serialize() value: number` — the actuated DOF state.

**Unit convention:** `value`, `lowerLimit`, `upperLimit` are in **degrees** for angular joints (revolute/continuous) and **millimetres** for prismatic — consistent with the app's degrees/mm conventions and the property panel. (URDF export in B3 converts angular values to radians.)

**The actuation mechanism** — a private `updateTransform()` recomputes and writes the inherited `transform`; every parameter setter calls it:
```
private updateTransform() {
    this.transform = this.origin.multiply(this.dofMatrix());
}
private dofMatrix(): Matrix4 {
    switch (this.jointType) {
        case "revolute":
        case "continuous":
            return Matrix4.fromAxisRad(XYZ.zero, this.axis, MathUtils.degToRad(this.value));
        case "prismatic":
            return Matrix4.fromTranslation(this.axis.x * this.value, this.axis.y * this.value, this.axis.z * this.value);
        case "fixed":
            return Matrix4.identity();
    }
}
```
The `value` setter **clamps to `[lowerLimit, upperLimit]`** (except `continuous`) before `setProperty("value", clamped)` + `updateTransform()`. Writing `transform` reuses the existing visual-sync path → the child sub-tree moves immediately. `dofMatrix` rotates/translates about the **joint-frame origin** (local `XYZ.zero`), since `origin` already places that frame. `display()` returns a `"body.joint"` i18n key.

### 3.2 `LinkNode extends GroupNode` — `packages/core/src/model/linkNode.ts`
A thin, named container for one rigid body's geometry. For B1 it adds nothing beyond `GroupNode` except `display()` → `"body.link"` and identity as a kinematic-chain element (so the tree reads as links-and-joints and URDF export has a home later). Mass/inertia/collision are deferred.

### 3.3 "Create Joint" command — `packages/app/src/commands/modify/createJoint.ts`
Key `modify.createJoint`. Wraps a selected node in a new `JointNode` (reparents the selection under a fresh `JointNode` inserted at the selection's old tree position), defaulting to `revolute` / `axis = Z` / `origin = identity`. The selected sub-tree becomes the joint's articulated child. Recorded in a `Transaction` (undoable). Added to the existing `ribbon.group.modify` group (no new ribbon group for v1) + i18n (en/zh-cn/pt-br) like every other command.

### 3.4 Actuation (v1)
Selecting a `JointNode` shows its `@property` fields in the existing property panel; editing `value` (a number input, in degrees/mm) runs the setter → FK moves the sub-tree live. A drag-slider and a 3D actuation gizmo are explicit follow-ups, not v1.

---

## 4. Data flow

`edit value in property panel → JointNode.value setter clamps → setProperty("value") + updateTransform() → this.transform = origin × dofMatrix() → "transform" propertyChanged → GroupVisualObject re-reads transform (threeVisualObject.ts:304) → Three.js recomposes the child sub-tree's world matrices → viewport updates.`

Serialization: `@serializable()` on both classes; `origin`, `jointType`, `axis`, limits, and `value` are `@serialize()`d. On load, the constructor calls `updateTransform()` so the stored transform reflects the saved `value`.

---

## 5. Error handling & edge cases
- `value` clamped to limits (revolute/prismatic); `continuous` unbounded; `fixed` ignores value (DOF matrix is identity).
- Degenerate/zero `axis`: `Matrix4.fromAxisRad` relies on a non-zero normal — the `axis` setter normalizes and rejects a zero-length axis (keep previous axis, no throw). Document that the axis must be non-zero.
- `lowerLimit > upperLimit`: clamp uses `min/max` defensively so it never produces NaN.

---

## 6. Testing
Headless unit test (`packages/core/test/jointNode.test.ts`, `TestDocument`):
- revolute: set axis Z, sweep `value` 0→90°, assert the resulting `transform` rotates a test point by the expected angle about the origin axis (within tolerance).
- prismatic: set axis X, `value` 10mm, assert `transform` translates by (10,0,0).
- fixed: `transform` equals `origin` regardless of `value`.
- limits: setting `value` beyond `[lower, upper]` clamps; `continuous` does not clamp.
- origin compose: non-identity `origin` × DOF composes in the right order.
(ROS/RViz/`check_urdf` validation belongs to B3, not here.)

---

## 7. Decomposition / sequencing within Tier B
- **B1 (this spec):** JointNode + LinkNode + Create Joint + property-panel actuation + unit test.
- **B2 (later):** richer actuation UX (slider, gizmo), and an explicit FK/named-pose API only if a need beyond tree-composition appears.
- **B3 (later):** URDF (and glТF, done in A8) import/export — invoke `roboforge:urdf-and-kinematics-changes` and validate with `check_urdf`/RViz. The B1 field set (types, axis, origin, limits) is chosen to map cleanly to URDF `<joint>` then.

---

## 8. Conventions carried from robotics domain (for B3 compatibility)
Per `roboforge:urdf-and-kinematics-changes`: joint types revolute/continuous/prismatic/fixed; per-joint position limits now (velocity/effort deferred); URDF `<origin>` = parent-frame→joint-frame (xyz+rpy) — our `origin: Matrix4` captures this; axis expressed in the joint frame — matches. Mass/inertia/collision and the full validation checklist apply when B3 produces an actual URDF, not at B1.

---

## 9. Files
| File | Action |
|------|--------|
| `packages/core/src/model/jointNode.ts` | Create (`JointNode`, `JointType`) |
| `packages/core/src/model/linkNode.ts` | Create (`LinkNode`) |
| `packages/core/src/model/index.ts` | Export both |
| `packages/core/test/jointNode.test.ts` | Create (unit test) |
| `packages/app/src/commands/modify/createJoint.ts` | Create command (key `modify.createJoint`) |
| `packages/app/src/commands/modify/index.ts` + `packages/builder/src/ribbon.ts` | Register (modify group) |
| `packages/core/src/i18n/keys.ts` + en/zh-cn/pt-br | `body.joint`, `body.link`, `command.modify.createJoint`, joint property labels (`joint.type`, `joint.axis`, `joint.lowerLimit`, `joint.upperLimit`, `joint.value`) |
