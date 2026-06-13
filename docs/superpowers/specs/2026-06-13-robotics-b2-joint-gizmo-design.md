# Robotics B2 — 3D Joint Actuation Gizmo (Design)

**Date:** 2026-06-13
**Status:** Approved design (TransformControls-based gizmo + manual-verification reality accepted).
**Scope:** Second sub-project of Tier B. Make a selected `JointNode` actuable by **dragging a 3D handle in the viewport** (vs editing the `value` field). Builds directly on B1's `JointNode`.

---

## 1. Goal & scope

When a single `JointNode` is selected, show a constrained drag handle on its axis in the 3D view: a **rotation ring** (revolute/continuous) or **translation arrow** (prismatic), hidden for `fixed`. Dragging it sets `joint.value` (clamped to limits), and B1's FK setter moves the child sub-tree live.

**In scope (B2):** the gizmo (built on Three.js `TransformControls`), the selection-driven lifecycle, and the value↔proxy frame math (unit-tested). **Out of scope:** multi-joint posing, a property-panel slider (rejected alternative), saving named poses, URDF (B3).

---

## 2. Approach — `TransformControls` constrained to one DOF

Three.js `TransformControls` (`three/examples/jsm/controls/TransformControls.js`, confirmed available) provides a ready-made rotate/translate gizmo with drag handling and grab geometry. We **constrain** it to the joint's single DOF rather than build hit-testing from scratch:

- Attach to a proxy `Object3D` placed at the joint's **world frame** (the joint's `worldTransform`).
- Orient the proxy so its local **Z** aligns with the joint `axis`; then `setMode("rotate")` (revolute/continuous) or `setMode("translate")` (prismatic), `setSpace("local")`, and show **only the Z handle** (`showX=showY=false`, `showZ=true`). `fixed` → no gizmo.
- On the control's `objectChange` event, read the proxy's local rotation/translation about Z and map it to `joint.value`.

Rejected: a from-scratch ring/arrow mesh + custom `IEventHandler` drag math (more code, reinvents `TransformControls`); a property-panel slider (the user chose the 3D gizmo).

---

## 3. Components

### 3.1 `jointGizmoMath` — pure functions (`packages/three/src/jointGizmoMath.ts`)
Isolates the **risky frame math** so it is headlessly unit-testable:
- `proxyToValue(jointType, proxyLocalMatrix): number` — extract the signed rotation angle about local Z (→ **degrees** for revolute/continuous) or the translation along local Z (→ **mm** for prismatic) from the proxy's local transform.
- `valueToProxy(jointType, value): Matrix4` — the inverse: the proxy's local transform for a given value (used to initialize the proxy to the joint's current value so the handle starts in the right place).
- These mirror B1's `dofMatrix` conventions (degrees/mm; rotation/translation about the local Z axis), so the gizmo and the joint agree.

### 3.2 `JointGizmo` (`packages/three/src/jointGizmo.ts`)
Owns a `TransformControls` instance for one joint on one view. Responsibilities:
- Build the proxy `Object3D`, orient local Z → joint `axis`, place at the joint world frame, initialize with `valueToProxy(joint.value)`.
- Construct `new TransformControls(view.camera, view.renderer.domElement)`; configure mode/space/visible-axis per joint type; add the control's helper object to the view scene; `attach(proxy)`.
- On `objectChange`: `joint.value = proxyToValue(joint.jointType, proxy.matrix)` (the `value` setter clamps + drives FK). Guard against feedback loops (only write when dragging).
- On `dragging-changed`: **suspend the camera controller** while dragging so the orbit control doesn't fight the gizmo, and re-enable after.
- `dispose()`: detach, remove the helper from the scene, dispose the control, release listeners.

### 3.3 `JointGizmoController` (`packages/three/src/jointGizmoController.ts`)
A small service that subscribes to the `selectionChanged` PubSub event (mirroring `showPropertyEventHandler.ts`). On each change: if the selection is exactly one `JointNode`, create a `JointGizmo` on the active view for it (disposing any prior one); otherwise dispose the active gizmo. **Must live in `three`** (not `app`) because it constructs a `JointGizmo` — and `app` does not depend on `three` (the dependency graph is `builder → three → core` and `builder → app → core`). It is instantiated/registered by the **builder** (`packages/builder`, which wires both `three` and `app`), and obtains the active `ThreeView` from the document/application.

---

## 4. Data flow
`drag the ring → TransformControls mutates the proxy → "objectChange" → proxyToValue → joint.value setter clamps → updateTransform writes joint.transform → "transform" propertyChanged → Three.js recomposes the child sub-tree → viewport updates.`
Reverse (init / external value edit): `select joint → JointGizmoController creates JointGizmo → valueToProxy(joint.value) places the handle at the current pose.`

---

## 5. Error handling & edge cases
- `fixed` joint → no gizmo shown.
- `continuous` → rotate gizmo with no clamp (value unbounded); revolute/prismatic clamp via the existing `value` setter.
- Feedback-loop guard: the gizmo writes `value` only during an active drag; it does not re-place the proxy from `value` mid-drag (avoids jitter). On non-drag value changes (e.g. property-panel edit while selected), re-initialize the proxy from `valueToProxy`.
- Camera-controller suspension must be **restored** even if a drag ends abnormally (use the `dragging-changed` false edge).
- Disposing the gizmo on deselection / view change / document close must not leak the `TransformControls` or its scene helper.

---

## 6. Testing strategy (HONEST: largely manual for the drag)
- **Headless (Rstest):** `jointGizmoMath` — `proxyToValue`/`valueToProxy` round-trip and sign/units for revolute (degrees) and prismatic (mm), via constructed `Matrix4`s. And the `JointGizmoController` lifecycle using the existing `TestView`/`TestDocument` mocks: selecting one `JointNode` creates a gizmo; selecting a non-joint / multiple / nothing disposes it.
- **Manual (in-browser, `npm run dev`):** the actual drag feel — select a joint, drag the ring/arrow, confirm the child sub-tree articulates, limits stop it, the camera doesn't orbit mid-drag, and deselecting removes the gizmo. **This cannot be headlessly tested** (needs real pointer events + WebGL); it is verified by running the app.

---

## 7. Key risks (this is the highest-risk feature so far)
1. **Frame mapping** (`proxyToValue`/`valueToProxy`) — sign and axis conventions are fiddly; mitigated by isolating + unit-testing this math.
2. **Event conflict** — `TransformControls` attaches its own pointer listeners to `view.renderer.domElement`; chili3d has its own view event handling. Risk of double-handling / the gizmo not receiving events. May need to coordinate with the view's `eventHandler`/`viewHandler`, or rely on `TransformControls`' `dragging-changed` to gate. To be resolved during implementation; flagged as the top integration risk.
3. **Camera-controller suspension** — must reliably disable orbit during drag and restore after.
4. **Coordinate frame** — the proxy must sit at the joint's *world* frame and track camera/view changes; `TransformControls` handles its own camera tracking, but the proxy placement must use the joint `worldTransform`.

---

## 8. Files
| File | Action |
|------|--------|
| `packages/three/src/jointGizmoMath.ts` | Create (pure value↔proxy math) |
| `packages/three/test/jointGizmoMath.test.ts` | Create (headless math tests) |
| `packages/three/src/jointGizmo.ts` | Create (`TransformControls` wrapper) |
| `packages/three/src/index.ts` | Export |
| `packages/three/src/jointGizmoController.ts` | Create (selection lifecycle) |
| `packages/three/test/jointGizmoController.test.ts` | Create (lifecycle test, TestView) |
| `packages/builder` service registration | Register the controller (builder wires three + app) |

---

## 9. Decomposition within B2
- **Unit A:** `jointGizmoMath` + headless tests (the testable core).
- **Unit B:** `JointGizmo` (`TransformControls` integration) — manual-verified.
- **Unit C:** `JointGizmoController` (selection lifecycle) + registration + lifecycle test.
Unit B is the risky/manual one; A and C are testable and de-risk the surrounding contract.
