// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import type { JointType } from "@chili3d/core";
import { MathUtils, Matrix4, XYZ } from "@chili3d/core";

// The joint's DOF is expressed in a canonical frame whose Z axis is the joint axis:
// revolute/continuous rotate about local Z (value in degrees); prismatic translates
// along local Z (value in mm); fixed has no DOF. JointGizmo orients the proxy so its
// local Z aligns with joint.axis, so this math is axis-agnostic.

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
