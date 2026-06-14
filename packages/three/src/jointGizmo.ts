// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { type IDisposable, type JointNode, type Matrix4, type Ray, XYZ } from "@chili3d/core";
import {
    BufferGeometry,
    Float32BufferAttribute,
    Object3D,
    Points,
    PointsMaterial,
    Quaternion,
    Vector3,
} from "three";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
import { dofToValue, valueToDof } from "./jointGizmoMath";
import { ThreeHelper } from "./threeHelper";
import type { ThreeView } from "./threeView";

const UNIT_Z = new Vector3(0, 0, 1);
// Screen-pixel radius within which a click counts as grabbing the rotation-centre dot.
const HANDLE_GRAB_PX = 14;

/**
 * Handles for a single JointNode:
 *   - the rotation arc (TransformControls) actuates the joint's one DOF;
 *   - a draggable dot at the rotation centre repositions `joint.pivot`. The dot moves ONLY the centre
 *     point (it slides in the joint's rotation plane); at the rest pose this never moves the part.
 *
 * Frame layout (separates world placement from the canonical-Z DOF that jointGizmoMath reads):
 *   - `frame`  — placed at the joint REST world frame (value 0), oriented so its local Z
 *                aligns with `joint.axis`.
 *   - `proxy`  — child of `frame`; its LOCAL transform is the DOF in the canonical Z frame.
 */
export class JointGizmo implements IDisposable {
    private readonly frame = new Object3D();
    private readonly proxy = new Object3D();
    private readonly controls: TransformControls;
    private dragging = false;
    private readonly dom: HTMLElement;

    // Rotation-centre dot and its drag state.
    private readonly centerHandle?: Points;
    private parentWorld?: Matrix4;
    private centerDragging = false;
    private dragPlanePoint?: XYZ;
    private dragPlaneNormal?: XYZ;

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
        // view container. Attach TransformControls (and our guards) to that container so it
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

        // Only rotational joints have a meaningful rotation centre to reposition.
        if (this.joint.jointType === "revolute" || this.joint.jointType === "continuous") {
            this.centerHandle = this.createCenterHandle();
            this.view.content.scene.add(this.centerHandle);
        }

        // Registered AFTER TransformControls' own canvas listener so `axis` is already updated.
        // Grabbing the centre dot (or a rotation handle) must stop the pointerdown from bubbling to
        // chili3d's Viewport handler — otherwise it treats it as an empty-space click, deselects the
        // joint, and disposes this gizmo before the drag can start.
        this.dom.addEventListener("pointerdown", this.onPointerDown);
        this.view.update();
    }

    private createCenterHandle(): Points {
        const geometry = new BufferGeometry();
        geometry.setAttribute("position", new Float32BufferAttribute([0, 0, 0], 3));
        // Constant screen-size dot (sizeAttenuation: false), drawn on top so it is always grabbable.
        const material = new PointsMaterial({
            size: 13,
            sizeAttenuation: false,
            color: 0xffaa00,
            depthTest: false,
            transparent: true,
        });
        const handle = new Points(geometry, material);
        handle.position.copy(this.frame.position);
        handle.renderOrder = 999;
        return handle;
    }

    private readonly onPointerDown = (event: PointerEvent) => {
        // Grab the rotation-centre dot?
        if (this.centerHandle && this.isOverCenterHandle(event)) {
            event.stopPropagation();
            event.preventDefault();
            this.beginCenterDrag();
            return;
        }
        // Otherwise, if over a rotation handle, just shield it from the viewport selection handler.
        if (this.controls.axis) {
            event.stopPropagation();
        }
    };

    private isOverCenterHandle(event: PointerEvent): boolean {
        const rect = this.dom.getBoundingClientRect();
        const mx = event.clientX - rect.left;
        const my = event.clientY - rect.top;
        const p = this.frame.position;
        const screen = this.view.worldToScreen(new XYZ({ x: p.x, y: p.y, z: p.z }));
        return Math.hypot(screen.x - mx, screen.y - my) <= HANDLE_GRAB_PX;
    }

    private beginCenterDrag() {
        const p = this.frame.position;
        // Drag stays in the plane through the current centre, perpendicular to the joint axis — the
        // only motion that changes a revolute joint's rotation centre. Captured once so it doesn't
        // shift under the cursor mid-drag.
        this.dragPlanePoint = new XYZ({ x: p.x, y: p.y, z: p.z });
        this.dragPlaneNormal = this.parentWorld?.ofVector(this.joint.axis)?.normalize() ?? UNIT_Z_XYZ;
        this.centerDragging = true;
        this.controls.enabled = false; // the rotation arc must not also respond
        this.setViewHandlersEnabled(false);
        window.addEventListener("pointermove", this.onCenterDragMove);
        window.addEventListener("pointerup", this.onCenterDragEnd);
    }

    private readonly onCenterDragMove = (event: PointerEvent) => {
        if (!this.centerDragging || !this.parentWorld || !this.dragPlanePoint || !this.dragPlaneNormal) {
            return;
        }
        const rect = this.dom.getBoundingClientRect();
        const ray = this.view.rayAt(event.clientX - rect.left, event.clientY - rect.top);
        const hit = intersectPlane(ray, this.dragPlanePoint, this.dragPlaneNormal);
        if (!hit) return;

        const toLocal = this.parentWorld.invert();
        if (!toLocal) return;
        // Move ONLY the centre: store the new pivot and slide the dot + arc there. The part is a child
        // of the joint and its transform is identity at rest, so it stays exactly where it is.
        this.joint.pivot = toLocal.ofPoint(hit);
        this.frame.position.set(hit.x, hit.y, hit.z);
        this.frame.updateMatrixWorld(true);
        this.centerHandle?.position.set(hit.x, hit.y, hit.z);
        this.view.update();
    };

    private readonly onCenterDragEnd = () => {
        if (!this.centerDragging) return;
        this.centerDragging = false;
        this.controls.enabled = this.joint.jointType !== "fixed";
        this.setViewHandlersEnabled(true);
        window.removeEventListener("pointermove", this.onCenterDragMove);
        window.removeEventListener("pointerup", this.onCenterDragEnd);
        this.view.update();
    };

    private setViewHandlersEnabled(enabled: boolean) {
        const visual = this.view.document.visual;
        visual.viewHandler.isEnabled = enabled;
        visual.eventHandler.isEnabled = enabled;
    }

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
        // Suspend chili3d's own pointer handlers while dragging the gizmo so the camera
        // doesn't orbit and selection doesn't change mid-drag.
        this.setViewHandlersEnabled(!this.dragging);
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
        this.dom.removeEventListener("pointerdown", this.onPointerDown);
        window.removeEventListener("pointermove", this.onCenterDragMove);
        window.removeEventListener("pointerup", this.onCenterDragEnd);
        this.controls.removeEventListener("objectChange", this.onObjectChange);
        this.controls.removeEventListener("dragging-changed", this.onDraggingChanged);
        this.controls.detach();
        this.view.content.scene.remove(this.controls.getHelper());
        this.controls.dispose();
        if (this.centerHandle) {
            this.view.content.scene.remove(this.centerHandle);
            this.centerHandle.geometry.dispose();
            (this.centerHandle.material as PointsMaterial).dispose();
        }
        this.view.content.scene.remove(this.frame);
        // Restore handlers in case disposal happens mid-drag.
        this.setViewHandlersEnabled(true);
        this.view.update();
    }
}

const UNIT_Z_XYZ = new XYZ({ x: 0, y: 0, z: 1 });

// Intersect a ray with the plane (point, normal); returns the world hit, or undefined if parallel /
// behind the ray origin.
function intersectPlane(ray: Ray, point: XYZ, normal: XYZ): XYZ | undefined {
    const denom = normal.dot(ray.direction);
    if (Math.abs(denom) < 1e-6) return undefined;
    const t = normal.dot(point.sub(ray.point)) / denom;
    if (t < 0) return undefined;
    return new XYZ({
        x: ray.point.x + t * ray.direction.x,
        y: ray.point.y + t * ray.direction.y,
        z: ray.point.z + t * ray.direction.z,
    });
}
