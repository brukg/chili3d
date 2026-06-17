// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { XYZ } from "@chili3d/core";
import { describe, expect, test } from "@rstest/core";
import { extendAxis } from "../src/commands/create/axisTwoPoints";

describe("extendAxis (two-point axis math)", () => {
    test("extends the segment by its own length past each end", () => {
        const axis = extendAxis(new XYZ({ x: 0, y: 0, z: 0 }), new XYZ({ x: 10, y: 0, z: 0 }));
        expect(axis).toBeDefined();
        // gap = 10, so start = -10 and end = 20 → a 30-long axis centred on the segment.
        expect([axis!.start.x, axis!.start.y, axis!.start.z]).toEqual([-10, 0, 0]);
        expect([axis!.end.x, axis!.end.y, axis!.end.z]).toEqual([20, 0, 0]);
    });

    test("works on a diagonal and keeps the direction", () => {
        const axis = extendAxis(new XYZ({ x: 0, y: 0, z: 0 }), new XYZ({ x: 3, y: 4, z: 0 }))!;
        // gap = 5 along (0.6, 0.8): start = -1·(3,4), end = (3,4)+(3,4).
        expect(axis.start.x).toBeCloseTo(-3, 6);
        expect(axis.start.y).toBeCloseTo(-4, 6);
        expect(axis.end.x).toBeCloseTo(6, 6);
        expect(axis.end.y).toBeCloseTo(8, 6);
    });

    test("coincident points return undefined", () => {
        expect(extendAxis(new XYZ({ x: 1, y: 1, z: 1 }), new XYZ({ x: 1, y: 1, z: 1 }))).toBeUndefined();
    });
});
