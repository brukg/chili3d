// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { describe, expect, test } from "@rstest/core";
import { findMotorPreset, MotorPresets } from "../src/robot/motorPresets";

describe("motor presets", () => {
    test("every preset has a unique id and physically sensible fields", () => {
        const ids = new Set<string>();
        for (const p of MotorPresets) {
            expect(ids.has(p.id)).toBe(false);
            ids.add(p.id);
            expect(p.ratedTorque).toBeGreaterThan(0);
            expect(p.gearRatio).toBeGreaterThan(0);
            expect(p.rotorInertia).toBeGreaterThanOrEqual(0);
            expect(p.maxVelocity).toBeGreaterThan(0);
            expect(p.efficiency).toBeGreaterThan(0);
            expect(p.efficiency).toBeLessThanOrEqual(1);
        }
    });

    test("steppers are direct-drive and geared actuators are not", () => {
        expect(findMotorPreset("nema17-stepper")?.gearRatio).toBe(1);
        expect(findMotorPreset("harmonic-drive")?.gearRatio).toBeGreaterThan(1);
    });

    test("lookup is case-insensitive and returns undefined for unknown ids", () => {
        expect(findMotorPreset("MICRO-SERVO")?.id).toBe("micro-servo");
        expect(findMotorPreset("warp-core")).toBeUndefined();
    });
});
