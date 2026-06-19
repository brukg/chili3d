// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

// Actuator (motor) preset library — the joint-side analogue of the material presets. Each preset bundles
// the parameters a JointNode needs to be motorised: rated output torque, gear reduction, rotor inertia,
// max output speed, and transmission efficiency. Values are REPRESENTATIVE NOMINAL figures for each
// actuator class (not a specific datasheet) and are meant as editable starting points for sizing — pick
// the closest class, then refine. Pure data + lookup, so it is directly unit-testable.

export interface MotorPreset {
    /** Stable identifier used for lookup and serialization. */
    id: string;
    /** Human-facing name (the actuator class). */
    name: string;
    /** Rated continuous torque at the joint output, after the gearbox (N·m). Maps to JointNode.maxEffort. */
    ratedTorque: number;
    /** Gear reduction (motor turns per output turn). Maps to JointNode.gearRatio. */
    gearRatio: number;
    /** Motor rotor inertia (kg·m²). Maps to JointNode.rotorInertia. */
    rotorInertia: number;
    /** Max output speed (rad/s). Maps to JointNode.maxVelocity. */
    maxVelocity: number;
    /** Transmission efficiency in (0, 1]. Maps to JointNode.efficiency. */
    efficiency: number;
}

// Nominal figures per actuator class. Hobby servos: high plastic/metal-gear reduction, low efficiency.
// Steppers: direct-drive, high rotor inertia, decent efficiency. BLDC+gearbox and harmonic drives:
// robot-joint actuators with high torque density.
export const MotorPresets: readonly MotorPreset[] = [
    {
        id: "micro-servo",
        name: "Micro Servo (9g class)",
        ratedTorque: 0.18,
        gearRatio: 150,
        rotorInertia: 1e-7,
        maxVelocity: 6.5,
        efficiency: 0.6,
    },
    {
        id: "standard-servo",
        name: "Standard Servo (metal-gear)",
        ratedTorque: 1.0,
        gearRatio: 200,
        rotorInertia: 5e-7,
        maxVelocity: 7.0,
        efficiency: 0.65,
    },
    {
        id: "smart-servo",
        name: "Smart Servo (Dynamixel class)",
        ratedTorque: 2.5,
        gearRatio: 200,
        rotorInertia: 8e-7,
        maxVelocity: 6.0,
        efficiency: 0.7,
    },
    {
        id: "nema17-stepper",
        name: "NEMA 17 Stepper",
        ratedTorque: 0.4,
        gearRatio: 1,
        rotorInertia: 5.4e-5,
        maxVelocity: 30,
        efficiency: 0.9,
    },
    {
        id: "nema23-stepper",
        name: "NEMA 23 Stepper",
        ratedTorque: 1.9,
        gearRatio: 1,
        rotorInertia: 2.8e-4,
        maxVelocity: 25,
        efficiency: 0.9,
    },
    {
        id: "bldc-gearbox",
        name: "BLDC + Planetary Gearbox",
        ratedTorque: 9.0,
        gearRatio: 9,
        rotorInertia: 1e-5,
        maxVelocity: 25,
        efficiency: 0.85,
    },
    {
        id: "harmonic-drive",
        name: "Harmonic-Drive Joint",
        ratedTorque: 40,
        gearRatio: 100,
        rotorInertia: 3e-5,
        maxVelocity: 3.0,
        efficiency: 0.8,
    },
] as const;

/** Look up a motor preset by its id (case-insensitive); undefined when no preset matches. */
export function findMotorPreset(id: string): MotorPreset | undefined {
    const key = id.toLowerCase();
    return MotorPresets.find((p) => p.id === key);
}
