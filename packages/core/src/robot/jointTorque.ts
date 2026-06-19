// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

// Robot joint torque analysis (robot-building foundation). Pure physics on a kinematic tree: given the
// masses a joint carries downstream, how much static (gravity-holding) torque the actuator must supply
// about its axis. This is the number you size a motor against and compare to JointNode.maxEffort. No
// kernel/geometry dependency — masses and centres of mass come in as plain data — so it is directly
// unit-testable. Lengths are millimetres (Chili3D model units); masses are kilograms; torque is N·m.

import { XYZ, type XYZLike } from "../math";

/** Standard gravitational acceleration (m/s²), CODATA value. */
export const STANDARD_GRAVITY = 9.80665;

/** A lumped point mass: its centre of mass in millimetres (model space) and mass in kilograms. */
export interface PointMass {
    center: XYZLike;
    mass: number;
}

// Model units are millimetres; torque needs lever arms in metres.
const MM_TO_M = 0.001;

/** Total mass (kg) of the collection. */
export function totalMass(masses: readonly PointMass[]): number {
    let total = 0;
    for (const m of masses) total += m.mass;
    return total;
}

/**
 * Mass-weighted combined centre of mass (in millimetres), or undefined when the total mass is zero
 * (nothing to average). This is the effective single point mass equivalent to the whole collection.
 */
export function combinedCenterOfMass(masses: readonly PointMass[]): XYZ | undefined {
    let total = 0;
    let x = 0;
    let y = 0;
    let z = 0;
    for (const m of masses) {
        total += m.mass;
        x += m.center.x * m.mass;
        y += m.center.y * m.mass;
        z += m.center.z * m.mass;
    }
    if (total <= 0) return undefined;
    return new XYZ({ x: x / total, y: y / total, z: z / total });
}

/**
 * Signed static torque (N·m) that gravity exerts on the given masses about the joint axis through
 * `pivot`. The actuator must supply the opposite torque to hold the pose, so |value| is the required
 * holding effort to compare against {@link effortUtilization}. The sign follows the right-hand rule
 * about the (normalized) axis. `gravity` is an acceleration vector (m/s²), defaulting to −Z.
 *
 * Returns 0 for a degenerate (zero-length) axis. The result depends only on the component of each
 * lever arm perpendicular to the axis, so a vertical-axis joint correctly reports ~0 under gravity.
 */
export function gravityHoldingTorque(
    axis: XYZLike,
    pivot: XYZLike,
    masses: readonly PointMass[],
    gravity: XYZLike = { x: 0, y: 0, z: -STANDARD_GRAVITY },
): number {
    const a = new XYZ({ x: axis.x, y: axis.y, z: axis.z }).normalize();
    if (a === undefined) return 0;
    let torque = XYZ.zero;
    for (const m of masses) {
        // Lever arm from the pivot to the mass, in metres.
        const r = new XYZ({
            x: (m.center.x - pivot.x) * MM_TO_M,
            y: (m.center.y - pivot.y) * MM_TO_M,
            z: (m.center.z - pivot.z) * MM_TO_M,
        });
        // Gravitational force on this mass (N) = mass · gravity.
        const force = new XYZ({ x: gravity.x, y: gravity.y, z: gravity.z }).multiply(m.mass);
        torque = torque.add(r.cross(force));
    }
    return a.dot(torque);
}

/**
 * Fraction of a joint's rated effort consumed by a required torque (both N·m). Returns the ratio of
 * magnitudes, Infinity when `maxEffort` is non-positive (no rating to compare against). A value > 1
 * means the joint is under-sized for the load.
 */
export function effortUtilization(requiredTorque: number, maxEffort: number): number {
    if (maxEffort <= 0) return Number.POSITIVE_INFINITY;
    return Math.abs(requiredTorque) / maxEffort;
}
