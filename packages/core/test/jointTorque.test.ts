// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { describe, expect, test } from "@rstest/core";
import {
    combinedCenterOfMass,
    effortUtilization,
    gravityHoldingTorque,
    maxPayloadMass,
    type PointMass,
    STANDARD_GRAVITY,
    totalMass,
} from "../src/robot/jointTorque";

describe("joint torque analysis", () => {
    test("totalMass sums the collection", () => {
        const masses: PointMass[] = [
            { center: { x: 0, y: 0, z: 0 }, mass: 2 },
            { center: { x: 1, y: 0, z: 0 }, mass: 3 },
        ];
        expect(totalMass(masses)).toBe(5);
        expect(totalMass([])).toBe(0);
    });

    test("combinedCenterOfMass is the mass-weighted average (mm)", () => {
        const com = combinedCenterOfMass([
            { center: { x: 0, y: 0, z: 0 }, mass: 1 },
            { center: { x: 2000, y: 0, z: 0 }, mass: 1 },
        ]);
        expect(com?.x).toBeCloseTo(1000, 6);
        expect(com?.y).toBeCloseTo(0, 6);
        // a 3:1 split pulls the COM toward the heavier mass
        const skewed = combinedCenterOfMass([
            { center: { x: 0, y: 0, z: 0 }, mass: 3 },
            { center: { x: 400, y: 0, z: 0 }, mass: 1 },
        ]);
        expect(skewed?.x).toBeCloseTo(100, 6);
    });

    test("combinedCenterOfMass is undefined with no mass", () => {
        expect(combinedCenterOfMass([])).toBeUndefined();
        expect(combinedCenterOfMass([{ center: { x: 1, y: 2, z: 3 }, mass: 0 }])).toBeUndefined();
    });

    test("horizontal-axis joint: torque is m·g·d about the axis", () => {
        // 1 kg at 1 m along +X, axis +Y (horizontal), gravity −Z → τ = 1·g·1
        const tau = gravityHoldingTorque({ x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: 0 }, [
            { center: { x: 1000, y: 0, z: 0 }, mass: 1 },
        ]);
        expect(tau).toBeCloseTo(STANDARD_GRAVITY, 6);
    });

    test("torque scales with mass and lever arm", () => {
        const tau = gravityHoldingTorque({ x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: 0 }, [
            { center: { x: 500, y: 0, z: 0 }, mass: 2 },
        ]);
        // 2 kg at 0.5 m → 2·g·0.5 = g
        expect(tau).toBeCloseTo(STANDARD_GRAVITY, 6);
    });

    test("the pivot offset sets the lever arm, not the absolute position", () => {
        const masses: PointMass[] = [{ center: { x: 1500, y: 0, z: 0 }, mass: 1 }];
        const tau = gravityHoldingTorque({ x: 0, y: 1, z: 0 }, { x: 500, y: 0, z: 0 }, masses);
        // lever arm = (1500 − 500) mm = 1 m
        expect(tau).toBeCloseTo(STANDARD_GRAVITY, 6);
    });

    test("sign follows the right-hand rule about the axis", () => {
        const left = gravityHoldingTorque({ x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: 0 }, [
            { center: { x: -1000, y: 0, z: 0 }, mass: 1 },
        ]);
        const right = gravityHoldingTorque({ x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: 0 }, [
            { center: { x: 1000, y: 0, z: 0 }, mass: 1 },
        ]);
        expect(Math.sign(left)).toBe(-Math.sign(right));
        expect(Math.abs(left)).toBeCloseTo(Math.abs(right), 6);
    });

    test("a vertical-axis joint carries no gravity torque from a horizontal offset", () => {
        const tau = gravityHoldingTorque({ x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: 0 }, [
            { center: { x: 1000, y: 0, z: 0 }, mass: 5 },
        ]);
        expect(tau).toBeCloseTo(0, 6);
    });

    test("axis is normalized internally — magnitude does not affect the result", () => {
        const args = [{ x: 0, y: 0, z: 0 }, [{ center: { x: 1000, y: 0, z: 0 }, mass: 1 }]] as const;
        const unit = gravityHoldingTorque({ x: 0, y: 1, z: 0 }, ...args);
        const scaled = gravityHoldingTorque({ x: 0, y: 7, z: 0 }, ...args);
        expect(scaled).toBeCloseTo(unit, 6);
    });

    test("a degenerate (zero-length) axis yields zero torque", () => {
        const tau = gravityHoldingTorque({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, [
            { center: { x: 1000, y: 0, z: 0 }, mass: 1 },
        ]);
        expect(tau).toBe(0);
    });

    test("effortUtilization is the magnitude ratio, Infinity when unrated", () => {
        expect(effortUtilization(50, 100)).toBeCloseTo(0.5, 6);
        expect(effortUtilization(-50, 100)).toBeCloseTo(0.5, 6);
        expect(effortUtilization(120, 100)).toBeCloseTo(1.2, 6);
        expect(effortUtilization(10, 0)).toBe(Number.POSITIVE_INFINITY);
    });

    test("maxPayloadMass is budget / (g · lever arm)", () => {
        // g N·m of budget at 1 m → exactly 1 kg
        expect(maxPayloadMass(STANDARD_GRAVITY, 1000)).toBeCloseTo(1, 6);
        // double the budget at 2 m → still 1 kg
        expect(maxPayloadMass(2 * STANDARD_GRAVITY, 2000)).toBeCloseTo(1, 6);
        // half the lever arm doubles the liftable mass
        expect(maxPayloadMass(STANDARD_GRAVITY, 500)).toBeCloseTo(2, 6);
    });

    test("maxPayloadMass is 0 with no budget and Infinity on the axis", () => {
        expect(maxPayloadMass(0, 1000)).toBe(0);
        expect(maxPayloadMass(-5, 1000)).toBe(0);
        expect(maxPayloadMass(10, 0)).toBe(Number.POSITIVE_INFINITY);
    });
});
