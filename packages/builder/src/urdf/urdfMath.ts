// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { Matrix4 } from "@chili3d/core";

/**
 * URDF/ROS fixed-axis roll-pitch-yaw (REP-103) conversions, kept independent of chili3d's
 * internal Euler convention (which composes Rx·Ry·Rz, NOT the URDF Rz·Ry·Rx). The two agree
 * for single-axis rotations but diverge for compound joint orientations, so URDF I/O must use
 * this module rather than Matrix4.getEulerAngles/fromEuler.
 *
 * URDF rotation: R = Rz(yaw)·Ry(pitch)·Rx(roll), with roll about X, pitch about Y, yaw about Z.
 */

/** Build the rotation Matrix4 (column-major) for a URDF rpy triple, in radians. */
export function rpyToMatrix(roll: number, pitch: number, yaw: number): Matrix4 {
    const cr = Math.cos(roll),
        sr = Math.sin(roll);
    const cp = Math.cos(pitch),
        sp = Math.sin(pitch);
    const cy = Math.cos(yaw),
        sy = Math.sin(yaw);

    // R = Rz(yaw)·Ry(pitch)·Rx(roll), written out (row-major elements R[row][col]).
    const r00 = cy * cp;
    const r01 = cy * sp * sr - sy * cr;
    const r02 = cy * sp * cr + sy * sr;
    const r10 = sy * cp;
    const r11 = sy * sp * sr + cy * cr;
    const r12 = sy * sp * cr - cy * sr;
    const r20 = -sp;
    const r21 = cp * sr;
    const r22 = cp * cr;

    // chili3d Matrix4 stores column-major: array[col*4 + row].
    return Matrix4.fromArray([r00, r10, r20, 0, r01, r11, r21, 0, r02, r12, r22, 0, 0, 0, 0, 1]);
}

/** Extract the URDF rpy triple (radians) from a rotation Matrix4 (the inverse of rpyToMatrix). */
export function matrixToRpy(m: Matrix4): { roll: number; pitch: number; yaw: number } {
    const a = m.toArray();
    // Row-major elements from the column-major array (array[col*4 + row]).
    const r00 = a[0],
        r10 = a[1],
        r20 = a[2];
    const r21 = a[6],
        r22 = a[10];
    const r01 = a[4],
        r11 = a[5];

    const cp = Math.hypot(r21, r22); // |cos(pitch)|
    if (cp > 1e-6) {
        return {
            roll: Math.atan2(r21, r22),
            pitch: Math.atan2(-r20, cp),
            yaw: Math.atan2(r10, r00),
        };
    }
    // Gimbal lock (pitch ≈ ±90°): roll and yaw are coupled; pin roll = 0.
    return {
        roll: 0,
        pitch: Math.atan2(-r20, cp),
        yaw: Math.atan2(-r01, r11),
    };
}
