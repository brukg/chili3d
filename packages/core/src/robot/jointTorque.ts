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

/**
 * Maximum additional payload mass (kg) a joint can hold, given the torque budget left after the arm's
 * own weight and the horizontal lever arm (mm) at which the payload hangs. `availableTorque` is N·m
 * already net of the self-load (e.g. `maxEffort − |gravityHoldingTorque(...)|`). Returns 0 when no budget
 * remains, and Infinity when the lever arm is ~0 (a payload on the joint axis exerts no torque about it,
 * so gravity never limits it). This is the "how much can this joint lift at arm's length?" check.
 */
export function maxPayloadMass(
    availableTorque: number,
    leverArm: number,
    gravity: number = STANDARD_GRAVITY,
): number {
    if (availableTorque <= 0) return 0;
    const arm = Math.abs(leverArm) * MM_TO_M;
    if (arm < 1e-9 || gravity <= 0) return Number.POSITIVE_INFINITY;
    return availableTorque / (gravity * arm);
}

/**
 * Moment of inertia (kg·m²) of the point masses about the joint axis line through `pivot`, treating each
 * link as a point mass: I = Σ mᵢ·dᵢ² where dᵢ is the perpendicular distance from the mass to the axis.
 * This is the rotational inertia an actuator must accelerate, used in {@link requiredJointTorque}. Masses
 * on the axis contribute nothing. Returns 0 for a degenerate axis.
 */
export function inertiaAboutAxis(axis: XYZLike, pivot: XYZLike, masses: readonly PointMass[]): number {
    const a = new XYZ({ x: axis.x, y: axis.y, z: axis.z }).normalize();
    if (a === undefined) return 0;
    let inertia = 0;
    for (const m of masses) {
        const rx = (m.center.x - pivot.x) * MM_TO_M;
        const ry = (m.center.y - pivot.y) * MM_TO_M;
        const rz = (m.center.z - pivot.z) * MM_TO_M;
        // Perpendicular component of the lever arm = r − (r·â)â.
        const along = rx * a.x + ry * a.y + rz * a.z;
        const px = rx - along * a.x;
        const py = ry - along * a.y;
        const pz = rz - along * a.z;
        inertia += m.mass * (px * px + py * py + pz * pz);
    }
    return inertia;
}

/**
 * Signed actuator torque (N·m) a joint must supply to move its downstream masses at a given angular
 * acceleration (rad/s²), from the equation of motion about the axis: I·α = τ_actuator + τ_gravity, so
 * τ_actuator = I·α − {@link gravityHoldingTorque}. With `angularAccel` = 0 this reduces to the static
 * holding torque (the negative of the gravity moment); |value| is the effort to compare against the
 * joint's rated `maxEffort`. Inertia from {@link inertiaAboutAxis} (point-mass model).
 */
export function requiredJointTorque(
    axis: XYZLike,
    pivot: XYZLike,
    masses: readonly PointMass[],
    angularAccel: number,
    gravity: XYZLike = { x: 0, y: 0, z: -STANDARD_GRAVITY },
): number {
    const inertia = inertiaAboutAxis(axis, pivot, masses);
    const gravityTorque = gravityHoldingTorque(axis, pivot, masses, gravity);
    return inertia * angularAccel - gravityTorque;
}

/**
 * Inertia (kg·m²) a motor's rotor adds at the joint output through a gear reduction: rotorInertia ·
 * gearRatio². A high-ratio gearbox makes a tiny rotor dominate the joint's apparent inertia. A ratio of
 * 0 (or rotor inertia 0) contributes nothing.
 */
export function reflectedInertia(rotorInertia: number, gearRatio: number): number {
    return rotorInertia * gearRatio * gearRatio;
}

/**
 * Torque the motor must produce (N·m) to deliver a given joint-output torque through a gear reduction:
 * jointTorque ÷ (gearRatio · efficiency). The reduction trades speed for torque; a real gearbox is
 * lossy, so a sub-unity `efficiency` (0–1) means the motor must push harder than the ideal. Returns the
 * joint torque unchanged for a non-positive ratio (direct drive); a non-positive efficiency is treated
 * as ideal (1) so callers never divide by zero.
 */
export function motorTorque(jointTorque: number, gearRatio: number, efficiency = 1): number {
    if (gearRatio <= 0) return jointTorque;
    const eff = efficiency > 0 ? efficiency : 1;
    return jointTorque / (gearRatio * eff);
}

/**
 * Peak angular acceleration (rad/s²) a joint can produce from the torque left over after gravity:
 * availableTorque ÷ inertia (Newton's law for rotation). `availableTorque` is the actuator's spare torque
 * (e.g. `maxEffort − |gravityHoldingTorque|`) and `inertia` is the rotational inertia about the axis
 * including the reflected rotor (see {@link inertiaAboutAxis} + {@link reflectedInertia}). Returns 0 with
 * no spare torque, Infinity for zero inertia (nothing to accelerate).
 */
export function maxAngularAcceleration(availableTorque: number, inertia: number): number {
    if (availableTorque <= 0) return 0;
    if (inertia <= 0) return Number.POSITIVE_INFINITY;
    return availableTorque / inertia;
}
