// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { MathUtils, Matrix4, XYZ } from "../math";
import { property } from "../property";
import { serializable, serialize } from "../serialize";
import type { FolderNodeOptions } from "./folderNode";
import { GroupNode } from "./groupNode";

export type JointType = "revolute" | "continuous" | "prismatic" | "fixed";

const JOINT_TYPES: JointType[] = ["revolute", "continuous", "prismatic", "fixed"];

export interface JointNodeOptions extends FolderNodeOptions {
    jointType?: JointType;
    axis?: XYZ;
    pivot?: XYZ;
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
    @property("joint.type")
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
        this.setProperty("value", clamped, (_p, _old) => this.updateTransform());
    }

    constructor(options: JointNodeOptions) {
        super(options);
        this.setPrivateValue("jointType", options.jointType ?? "revolute");
        this.setPrivateValue("axis", options.axis ?? XYZ.unitZ);
        this.setPrivateValue("pivot", options.pivot ?? XYZ.zero);
        this.updateTransform();
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
        // The transform is the actuation alone: a rotation about the axis-through-pivot (revolute)
        // or a translation along the axis (prismatic). At value 0 it is identity — the part does
        // not move, and changing the pivot only changes the centre of rotation.
        this.transform = this.dofMatrix();
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
