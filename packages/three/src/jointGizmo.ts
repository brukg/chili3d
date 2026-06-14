// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { type IDisposable, type JointNode, type Matrix4, XYZ } from "@chili3d/core";
import { Object3D, Quaternion, Vector3 } from "three";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
import { dofToValue, valueToDof } from "./jointGizmoMath";
import { ThreeHelper } from "./threeHelper";
import type { ThreeView } from "./threeView";

const UNIT_Z = new Vector3(0, 0, 1);

/**
 * A 3D drag handle for actuating a single JointNode. Built on Three.js TransformControls,
 * constrained to the joint's one DOF (rotate-about-axis for revolute/continuous, translate-
 * along-axis for prismatic, hidden for fixed).
 *
 * Frame layout (separates world placement from the canonical-Z DOF that jointGizmoMath reads):
 *   - `frame`  — placed at the joint REST world frame (value 0), oriented so its local Z
 *                aligns with `joint.axis`.
 *   - `proxy`  — child of `frame`; its LOCAL transform is the DOF in the canonical Z frame.
 *                TransformControls drags `proxy` in local space; `proxy.matrix` → dofToValue → value.
 */
export class JointGizmo implements IDisposable {
    private readonly frame = new Object3D();
    private readonly proxy = new Object3D();
    private readonly controls: TransformControls;
    // Second handle: world-aligned translate arrows at the rotation centre, driving joint.pivot.
    private readonly pivotProxy = new Object3D();
    private pivotControls?: TransformControls;
    // The joint's parent world frame (invariant to actuation and pivot). Maps joint-local ⇄ world,
    // so a pivot dragged in world space converts back to the joint's own coordinates.
    private parentWorld?: Matrix4;
    private dragging = false;
    private readonly dom: HTMLElement;

    constructor(
        private readonly view: ThreeView,
        private readonly joint: JointNode,
    ) {
        this.buildRestFrame();
        this.frame.add(this.proxy);
        this.syncProxyToValue();
        this.view.content.scene.add(this.frame);

        // The WebGL canvas is covered by the CSS2DRenderer overlay (position:absolute, top:0,
        // pointer-events:auto), so pointer events never reach the canvas — they bubble to the
        // view container. Attach TransformControls (and our guard) to that container so it
        // actually receives the events. Its getBoundingClientRect matches the render area.
        this.dom = this.view.dom ?? this.view.renderer.domElement;
        this.controls = new TransformControls(this.view.camera, this.dom);
        this.controls.setSpace("local");
        this.controls.showX = false;
        this.controls.showY = false;
        this.controls.showZ = true;
        if (this.joint.jointType === "prismatic") {
            this.controls.setMode("translate");
        } else if (this.joint.jointType === "fixed") {
            this.controls.enabled = false;
            this.controls.showZ = false;
        } else {
            this.controls.setMode("rotate");
            // Enlarge the rotation ring so it sits well outside the compact pivot-translate handles;
            // overlapping them at the same radius let one drag grab both (rotating + moving at once).
            this.controls.size = 1.6;
        }

        this.view.content.scene.add(this.controls.getHelper());
        this.controls.attach(this.proxy);
        this.controls.addEventListener("objectChange", this.onObjectChange);
        this.controls.addEventListener("dragging-changed", this.onDraggingChanged);
        // When the pointer is over a gizmo handle (controls.axis is set during hover),
        // stop the pointerdown from bubbling to chili3d's Viewport handler — otherwise the
        // selection handler treats it as an empty-space click, deselects the joint, and
        // disposes this gizmo before the drag can start. Registered AFTER TransformControls'
        // own canvas listener so `axis` is already updated when this runs.
        this.dom.addEventListener("pointerdown", this.stopWhenOverGizmo);
        this.setupPivotControls();
        this.view.update();
    }

    // A draggable centre-of-rotation handle. Only rotational joints have a meaningful pivot, so the
    // arrows are shown for revolute/continuous; prismatic translates along its axis and fixed has no
    // DOF, so neither exposes a pivot.
    private setupPivotControls() {
        if (this.joint.jointType !== "revolute" && this.joint.jointType !== "continuous") return;
        this.pivotProxy.position.copy(this.frame.position);
        this.pivotProxy.updateMatrixWorld(true);
        this.view.content.scene.add(this.pivotProxy);

        const controls = new TransformControls(this.view.camera, this.dom);
        controls.setMode("translate");
        controls.setSpace("world");
        controls.size = 0.85; // compact, so it stays inside the enlarged rotation ring
        controls.attach(this.pivotProxy);
        controls.addEventListener("objectChange", this.onPivotChange);
        controls.addEventListener("dragging-changed", this.onDraggingChanged);
        this.view.content.scene.add(controls.getHelper());
        this.pivotControls = controls;
    }

    private readonly stopWhenOverGizmo = (event: Event) => {
        if (this.controls.axis || this.pivotControls?.axis) {
            event.stopPropagation();
        }
    };

    // Dragging the pivot handle: convert its world position into the joint's local space and store it
    // as the new centre of rotation, then re-anchor the rotation arc so it follows the centre.
    private readonly onPivotChange = () => {
        if (!this.dragging || !this.parentWorld) return;
        const toLocal = this.parentWorld.invert();
        if (!toLocal) return;
        const p = this.pivotProxy.position;
        this.joint.pivot = toLocal.ofPoint(new XYZ({ x: p.x, y: p.y, z: p.z }));
        this.frame.position.copy(p);
        this.frame.updateMatrixWorld(true);
        this.view.update();
    };

    // The joint's parent world transform = jointWorld · jointLocal⁻¹ (it removes the actuation, so
    // it is the same at any value). JointNode extends GroupNode (not VisualNode), so it has no
    // worldTransform(); read it from the joint's visual object as VisualNode.worldTransform() does.
    private jointWorldTransform(): Matrix4 | undefined {
        return this.view.content.getVisual(this.joint)?.worldTransform();
    }

    private buildRestFrame() {
        const jointWorld = this.jointWorldTransform();
        const inverseLocal = this.joint.transform.invert(); // dof(value)⁻¹
        if (!jointWorld || !inverseLocal) return;
        // Matrix4.multiply applies `this` first, so `b.multiply(a)` yields a·b (standard product).
        const parentWorld = inverseLocal.multiply(jointWorld);
        this.parentWorld = parentWorld;
        // Place the gizmo at the rotation point (pivot) in world space, oriented so its local Z
        // aligns with the joint axis. The pivot is the centre of rotation, so the gizmo sits there
        // regardless of the current value.
        const pivotWorld = parentWorld.ofPoint(this.joint.pivot);
        const axisWorld = parentWorld.ofVector(this.joint.axis);
        this.frame.position.set(pivotWorld.x, pivotWorld.y, pivotWorld.z);
        const axis = new Vector3(axisWorld.x, axisWorld.y, axisWorld.z).normalize();
        this.frame.quaternion.copy(new Quaternion().setFromUnitVectors(UNIT_Z, axis));
        this.frame.updateMatrixWorld(true);
    }

    private syncProxyToValue() {
        const pos = new Vector3();
        const quat = new Quaternion();
        const scale = new Vector3();
        ThreeHelper.fromMatrix(valueToDof(this.joint.jointType, this.joint.value)).decompose(
            pos,
            quat,
            scale,
        );
        this.proxy.position.copy(pos);
        this.proxy.quaternion.copy(quat);
        this.proxy.updateMatrixWorld(true);
    }

    private readonly onDraggingChanged = (event: { value: unknown }) => {
        this.dragging = event.value === true;
        // While one handle is actively dragging, disable the other so a single gesture can't grab
        // both (rotating the joint and moving its centre at the same time).
        if (this.pivotControls && this.joint.jointType !== "fixed") {
            this.controls.enabled = !this.pivotControls.dragging;
            this.pivotControls.enabled = !this.controls.dragging;
            // The rotation centre is defined on the joint's neutral pose. If the joint is actuated
            // when the user grabs the pivot, rotating about a relocated centre by the current angle
            // would fling the part. Return to rest first; then moving the pivot only moves the centre
            // and never the part. (At value 0 the transform is identity for any pivot.)
            if (this.pivotControls.dragging && this.joint.value !== 0) {
                this.joint.value = 0;
                this.syncProxyToValue();
            }
        }
        // Suspend chili3d's own pointer handlers while dragging the gizmo so the camera
        // doesn't orbit and selection doesn't change mid-drag.
        const visual = this.view.document.visual;
        visual.viewHandler.isEnabled = !this.dragging;
        visual.eventHandler.isEnabled = !this.dragging;
        this.view.update();
    };

    private readonly onObjectChange = () => {
        if (!this.dragging) return;
        this.proxy.updateMatrix();
        const dof = ThreeHelper.toMatrix(this.proxy.matrix); // proxy LOCAL transform = canonical-Z DOF
        this.joint.value = dofToValue(this.joint.jointType, dof);
        this.view.update();
    };

    dispose(): void {
        this.dom.removeEventListener("pointerdown", this.stopWhenOverGizmo);
        this.controls.removeEventListener("objectChange", this.onObjectChange);
        this.controls.removeEventListener("dragging-changed", this.onDraggingChanged);
        this.controls.detach();
        this.view.content.scene.remove(this.controls.getHelper());
        this.controls.dispose();
        if (this.pivotControls) {
            this.pivotControls.removeEventListener("objectChange", this.onPivotChange);
            this.pivotControls.removeEventListener("dragging-changed", this.onDraggingChanged);
            this.pivotControls.detach();
            this.view.content.scene.remove(this.pivotControls.getHelper());
            this.pivotControls.dispose();
        }
        this.view.content.scene.remove(this.pivotProxy);
        this.view.content.scene.remove(this.frame);
        // Restore handlers in case disposal happens mid-drag.
        const visual = this.view.document.visual;
        visual.viewHandler.isEnabled = true;
        visual.eventHandler.isEnabled = true;
        this.view.update();
    }
}
