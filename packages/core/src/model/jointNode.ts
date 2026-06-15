// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import type { PropertyChangedHandler } from "../foundation";
import { MathUtils, Matrix4, XYZ } from "../math";
import { property } from "../property";
import { serializable, serialize } from "../serialize";
import type { FolderNodeOptions } from "./folderNode";
import { GroupNode } from "./groupNode";

// The full set of URDF joint types: 1-DOF revolute/continuous/prismatic, 0-DOF fixed, and the
// multi-DOF planar (3-DOF in a plane) and floating (6-DOF). The single `value` slider actuates the
// 1-DOF types; planar/floating are valid for export and structure but are not single-value actuated.
export type JointType = "revolute" | "continuous" | "prismatic" | "planar" | "floating" | "fixed";

const JOINT_TYPES: readonly JointType[] = [
    "revolute",
    "continuous",
    "prismatic",
    "planar",
    "floating",
    "fixed",
];

export interface JointNodeOptions extends FolderNodeOptions {
    jointType?: JointType;
    axis?: XYZ;
    pivot?: XYZ;
    orientation?: XYZ;
}

@serializable()
export class JointNode extends GroupNode {
    /**
     * The point the joint rotates about (for prismatic joints, an unused reference point), in the
     * joint's own coordinate space. It is the CENTRE OF ROTATION, not a placement: at value 0 the
     * transform is identity, so setting the pivot changes only where rotation happens — it never
     * moves the part.
     */
    @serialize()
    @property("joint.pivot")
    get pivot(): XYZ {
        return this.getPrivateValue("pivot", XYZ.zero);
    }
    set pivot(value: XYZ) {
        this.setProperty("pivot", value, (_p, _old) => this.updateTransform());
    }

    @serialize()
    @property("joint.type", { type: "select", options: JOINT_TYPES })
    get jointType(): JointType {
        return this.getPrivateValue("jointType", "revolute");
    }
    set jointType(value: JointType) {
        if (!JOINT_TYPES.includes(value)) return;
        this.setProperty("jointType", value, (_p, _old) => this.updateTransform());
    }

    @serialize()
    @property("joint.axis")
    get axis(): XYZ {
        return this.getPrivateValue("axis", XYZ.unitZ);
    }
    set axis(value: XYZ) {
        const normalized = value.normalize();
        if (normalized === undefined) return;
        this.setProperty("axis", normalized, (_p, _old) => this.updateTransform());
    }

    /**
     * Static orientation of the joint frame, as a URDF roll-pitch-yaw triple in DEGREES (x=roll,
     * y=pitch, z=yaw), applied about the pivot. Identity by default, so it never moves an existing
     * in-place model; it exists so a URDF `<origin rpy>` survives an import → export round-trip and so
     * oriented joints can be authored. Maps to the rotation part of the joint's URDF `<origin>`.
     */
    @serialize()
    @property("joint.orientation")
    get orientation(): XYZ {
        return this.getPrivateValue("orientation", XYZ.zero);
    }
    set orientation(value: XYZ) {
        this.setProperty("orientation", value, (_p, _old) => this.updateTransform());
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
    @property("joint.maxVelocity")
    get maxVelocity(): number {
        return this.getPrivateValue("maxVelocity", 10);
    }
    set maxVelocity(value: number) {
        this.setProperty("maxVelocity", value);
    }

    @serialize()
    @property("joint.maxEffort")
    get maxEffort(): number {
        return this.getPrivateValue("maxEffort", 100);
    }
    set maxEffort(value: number) {
        this.setProperty("maxEffort", value);
    }

    @serialize()
    @property("joint.damping")
    get damping(): number {
        return this.getPrivateValue("damping", 0);
    }
    set damping(value: number) {
        this.setProperty("damping", value);
    }

    @serialize()
    @property("joint.friction")
    get friction(): number {
        return this.getPrivateValue("friction", 0);
    }
    set friction(value: number) {
        this.setProperty("friction", value);
    }

    @serialize()
    @property("joint.value", { type: "slider", min: "lowerLimit", max: "upperLimit", step: 1 })
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
        this.setProperty("value", clamped, (_p, _old) => this.updateTransform());
    }

    /**
     * Mimic: this joint follows another joint's value as `master.value * multiplier + offset`
     * (URDF `<mimic>`). Used for coupled mechanisms — grippers, parallel linkages, gears. Empty =
     * not mimicking.
     */
    @serialize()
    @property("joint.mimicJoint")
    get mimicJoint(): string {
        return this.getPrivateValue("mimicJoint", "");
    }
    set mimicJoint(value: string) {
        this.setProperty("mimicJoint", value, (_p, _old) => this.subscribeMimic());
    }

    @serialize()
    @property("joint.mimicMultiplier")
    get mimicMultiplier(): number {
        return this.getPrivateValue("mimicMultiplier", 1);
    }
    set mimicMultiplier(value: number) {
        this.setProperty("mimicMultiplier", value, (_p, _old) => this.applyMimic());
    }

    @serialize()
    @property("joint.mimicOffset")
    get mimicOffset(): number {
        return this.getPrivateValue("mimicOffset", 0);
    }
    set mimicOffset(value: number) {
        this.setProperty("mimicOffset", value, (_p, _old) => this.applyMimic());
    }

    private masterSubscription?: { master: JointNode; handler: PropertyChangedHandler<any, any> };

    /** (Re)subscribe to the mimicked joint's value so this joint follows it. Public for the rebuild
     * service to re-wire after a document load (the serializer bypasses the constructor). */
    subscribeMimic(): void {
        if (this.masterSubscription) {
            this.masterSubscription.master.removePropertyChanged(this.masterSubscription.handler);
            this.masterSubscription = undefined;
        }
        if (!this.mimicJoint) return;
        const master = this.document.modelManager.findNode(
            (n) => n.id === this.mimicJoint && n instanceof JointNode,
        ) as JointNode | undefined;
        if (!master) return;
        const handler: PropertyChangedHandler<any, any> = (property) => {
            if (property === "value") this.applyMimic();
        };
        master.onPropertyChanged(handler);
        this.masterSubscription = { master, handler };
        this.applyMimic();
    }

    private applyMimic(): void {
        const master = this.masterSubscription?.master;
        if (master) this.value = master.value * this.mimicMultiplier + this.mimicOffset;
    }

    /** Re-wire the mimic subscription after a document load: the serializer restores `mimicJoint` via
     * setPrivateValue (bypassing the setter), and the master joint only exists once the whole tree is
     * deserialized — so the constructor's subscribeMimic() saw an empty id and did nothing. */
    onDeserialized(): void {
        this.subscribeMimic();
    }

    override disposeInternal(): void {
        if (this.masterSubscription) {
            this.masterSubscription.master.removePropertyChanged(this.masterSubscription.handler);
            this.masterSubscription = undefined;
        }
        super.disposeInternal();
    }

    constructor(options: JointNodeOptions) {
        super(options);
        this.setPrivateValue("jointType", options.jointType ?? "revolute");
        this.setPrivateValue("axis", options.axis ?? XYZ.unitZ);
        this.setPrivateValue("pivot", options.pivot ?? XYZ.zero);
        this.setPrivateValue("orientation", options.orientation ?? XYZ.zero);
        this.updateTransform();
        this.subscribeMimic();
    }

    // `transform` (inherited from GroupNode) is DERIVED state: the joint's parameters
    // (origin, jointType, axis, value) are the single source of truth, and this is the
    // ONLY writer of `transform` — every parameter setter routes through here. It is
    // written (rather than computed on read) so the "transform" property-change event
    // drives the viewport's transform sync (threeVisualObject), and serialized so the
    // loaded frame matches the inputs without a post-deserialize recompute hook (the
    // serializer restores fields via setPrivateValue, which does not re-run setters).
    // Invariant: never assign `transform` directly on a JointNode — actuate via `value`.
    private updateTransform() {
        // The transform is the static frame orientation (about the pivot) composed with the actuation
        // (a rotation about the axis-through-pivot for revolute, or a translation along the axis for
        // prismatic). With the default zero orientation and value 0 it is identity — the part does not
        // move, and changing the pivot only changes the centre of rotation.
        this.transform = this.frameOrientation().multiply(this.dofMatrix());
    }

    // The static URDF `<origin>` rotation, applied about the pivot so a zero orientation is exactly
    // identity (and never disturbs an in-place model). Built from single-axis rotations in URDF order
    // — roll(X) then pitch(Y) then yaw(Z) — rather than Matrix4.fromEuler, whose Rx·Ry·Rz convention
    // differs from URDF's Rz·Ry·Rx.
    private frameOrientation(): Matrix4 {
        const o = this.orientation;
        if (o.x === 0 && o.y === 0 && o.z === 0) return Matrix4.identity();
        const rx = Matrix4.fromAxisRad(this.pivot, XYZ.unitX, MathUtils.degToRad(o.x));
        const ry = Matrix4.fromAxisRad(this.pivot, XYZ.unitY, MathUtils.degToRad(o.y));
        const rz = Matrix4.fromAxisRad(this.pivot, XYZ.unitZ, MathUtils.degToRad(o.z));
        return rx.multiply(ry).multiply(rz);
    }

    private dofMatrix(): Matrix4 {
        switch (this.jointType) {
            case "revolute":
            case "continuous":
                return Matrix4.fromAxisRad(this.pivot, this.axis, MathUtils.degToRad(this.value));
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
