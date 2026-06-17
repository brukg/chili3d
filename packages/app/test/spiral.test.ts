// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { XYZ } from "@chili3d/core";
import { describe, expect, test } from "@rstest/core";
import { spiralPoints } from "../src/bodys/spiral";

describe("spiralPoints (flat spiral sampling)", () => {
    test("radius grows linearly from start to end over the requested turns", () => {
        const center = XYZ.zero;
        const pts = spiralPoints(center, XYZ.unitZ, 0, 10, 2, 64);
        expect(pts.length).toBe(65);
        // First sample sits at the centre (r = 0), last at the end radius.
        expect(pts[0].distanceTo(center)).toBeCloseTo(0, 6);
        expect(pts.at(-1)!.distanceTo(center)).toBeCloseTo(10, 6);
        // Halfway through, the radius is half-way (5) and the points stay in the z = 0 plane.
        expect(pts[32].distanceTo(center)).toBeCloseTo(5, 6);
        for (const p of pts) expect(p.z).toBeCloseTo(0, 6);
    });

    test("points one full turn apart point in the same radial direction", () => {
        // total angle = 2 turns = 4π over 64 segments, so index 32 (angle 2π) and index 64 (angle 4π)
        // are both at integer turns → collinear out from the centre, despite different radii.
        const pts = spiralPoints(XYZ.zero, XYZ.unitZ, 0, 10, 2, 64);
        const mid = pts[32].normalize()!; // radius 5, angle 2π
        const end = pts[64].normalize()!; // radius 10, angle 4π
        expect(mid.x).toBeCloseTo(end.x, 5);
        expect(mid.y).toBeCloseTo(end.y, 5);
        expect(mid.z).toBeCloseTo(end.z, 5);
    });
});
