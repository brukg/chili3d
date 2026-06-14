// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { type IDisposable, type JointNode, type Matrix4 } from "@chili3d/core";
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
        this.view.update();
    }

    private readonly stopWhenOverGizmo = (event: Event) => {
        if (this.controls.axis) {
            event.stopPropagation();
        }
    };

    // Rest world frame = parentWorld · origin, where parentWorld = jointWorld · jointLocal⁻¹
    // and jointLocal = origin · dof (so jointWorld · jointLocal⁻¹ · origin = parentWorld · origin).
    // JointNode extends GroupNode (not VisualNode), so it has no worldTransform(); read it
    // from the joint's visual object, exactly as VisualNode.worldTransform() does internally.
    private jointWorldTransform(): Matrix4 | undefined {
        return this.view.content.getVisual(this.joint)?.worldTransform();
    }

    private buildRestFrame() {
        const jointWorld = this.jointWorldTransform();
        const inverseLocal = this.joint.transform.invert(); // (origin · dof(value))⁻¹
        if (!jointWorld || !inverseLocal) return;
        // Matrix4.multiply applies `this` first, so `b.multiply(a)` yields a·b (standard product).
        // parentWorld = jointWorld · jointLocal⁻¹ ; restWorld = parentWorld · origin.
        const parentWorld = inverseLocal.multiply(jointWorld);
        const restWorld = this.joint.origin.multiply(parentWorld);

        const pos = new Vector3();
        const quat = new Quaternion();
        const scale = new Vector3();
        ThreeHelper.fromMatrix(restWorld).decompose(pos, quat, scale);
        const axis = new Vector3(this.joint.axis.x, this.joint.axis.y, this.joint.axis.z).normalize();
        this.frame.position.copy(pos);
        this.frame.quaternion.copy(quat.multiply(new Quaternion().setFromUnitVectors(UNIT_Z, axis)));
        this.frame.updateMatrixWorld(true);
    }

    private syncProxyToValue() {
        const pos = new Vector3();
        const quat = new Quaternion();
        const scale = new Vector3();
        ThreeHelper.fromMatrix(valueToDof(this.joint.jointType, this.joint.value)).decompose(pos, quat, scale);
        this.proxy.position.copy(pos);
        this.proxy.quaternion.copy(quat);
        this.proxy.updateMatrixWorld(true);
    }

    private readonly onDraggingChanged = (event: { value: unknown }) => {
        this.dragging = event.value === true;
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
        this.view.content.scene.remove(this.frame);
        // Restore handlers in case disposal happens mid-drag.
        const visual = this.view.document.visual;
        visual.viewHandler.isEnabled = true;
        visual.eventHandler.isEnabled = true;
        this.view.update();
    }
}
