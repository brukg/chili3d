// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { XYZ } from "@chili3d/core";
import { describe, expect, test } from "@rstest/core";
import { computeCircleFromPoints, intersectTwoPlanes } from "../src/commands/create/arcUtils";

describe("computeCircleFromPoints (3-point circle math)", () => {
    test("three points of the unit circle give centre (0,0,0) and radius 1", () => {
        const circle = computeCircleFromPoints(
            new XYZ({ x: 1, y: 0, z: 0 }),
            new XYZ({ x: 0, y: 1, z: 0 }),
            new XYZ({ x: -1, y: 0, z: 0 }),
        );
        expect(circle).toBeDefined();
        expect(circle!.center.distanceTo(XYZ.zero)).toBeCloseTo(0, 6);
        // radius = distance from centre to any of the three points.
        expect(circle!.center.distanceTo(new XYZ({ x: 1, y: 0, z: 0 }))).toBeCloseTo(1, 6);
    });

    test("a 5-radius circle offset from the origin is recovered", () => {
        const c = new XYZ({ x: 3, y: -2, z: 0 });
        const circle = computeCircleFromPoints(
            new XYZ({ x: 8, y: -2, z: 0 }), // c + (5,0)
            new XYZ({ x: 3, y: 3, z: 0 }), // c + (0,5)
            new XYZ({ x: -2, y: -2, z: 0 }), // c + (-5,0)
        );
        expect(circle).toBeDefined();
        expect(circle!.center.distanceTo(c)).toBeCloseTo(0, 6);
        expect(circle!.center.distanceTo(new XYZ({ x: 8, y: -2, z: 0 }))).toBeCloseTo(5, 6);
    });

    test("collinear points return undefined (no circle)", () => {
        const circle = computeCircleFromPoints(
            new XYZ({ x: 0, y: 0, z: 0 }),
            new XYZ({ x: 1, y: 0, z: 0 }),
            new XYZ({ x: 2, y: 0, z: 0 }),
        );
        expect(circle).toBeUndefined();
    });
});

describe("intersectTwoPlanes (two-plane axis math)", () => {
    test("XY plane ∩ XZ plane is the X axis", () => {
        const result = intersectTwoPlanes(
            XYZ.zero,
            new XYZ({ x: 0, y: 0, z: 1 }), // z = 0
            XYZ.zero,
            new XYZ({ x: 0, y: 1, z: 0 }), // y = 0
        );
        expect(result).toBeDefined();
        // Direction is the X axis (either sign); the point lies on y = 0, z = 0.
        expect(Math.abs(result!.direction.x)).toBeCloseTo(1, 6);
        expect(result!.direction.y).toBeCloseTo(0, 6);
        expect(result!.direction.z).toBeCloseTo(0, 6);
        expect(result!.point.y).toBeCloseTo(0, 6);
        expect(result!.point.z).toBeCloseTo(0, 6);
    });

    test("offset planes z=5 and y=2 intersect on the line (t, 2, 5)", () => {
        const result = intersectTwoPlanes(
            new XYZ({ x: 0, y: 0, z: 5 }),
            new XYZ({ x: 0, y: 0, z: 1 }),
            new XYZ({ x: 0, y: 2, z: 0 }),
            new XYZ({ x: 0, y: 1, z: 0 }),
        );
        expect(result).toBeDefined();
        expect(result!.point.y).toBeCloseTo(2, 6);
        expect(result!.point.z).toBeCloseTo(5, 6);
        expect(Math.abs(result!.direction.x)).toBeCloseTo(1, 6);
    });

    test("parallel planes return undefined", () => {
        const result = intersectTwoPlanes(
            XYZ.zero,
            new XYZ({ x: 0, y: 0, z: 1 }),
            new XYZ({ x: 0, y: 0, z: 5 }),
            new XYZ({ x: 0, y: 0, z: 1 }),
        );
        expect(result).toBeUndefined();
    });
});
