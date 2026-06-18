// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { describe, expect, test } from "@rstest/core";
import { areaCentroid } from "../src/commands/measure/centroid";

describe("areaCentroid", () => {
    test("a 10×20 rectangle (two triangles) has its centroid at the centre (5,10)", () => {
        const position = new Float32Array([0, 0, 0, 10, 0, 0, 10, 20, 0, 0, 20, 0]);
        const index = new Uint32Array([0, 1, 2, 0, 2, 3]);
        const c = areaCentroid(position, index);
        expect(c).toBeDefined();
        expect(c!.x).toBeCloseTo(5, 6);
        expect(c!.y).toBeCloseTo(10, 6);
        expect(c!.z).toBeCloseTo(0, 6);
    });

    test("area weighting pulls the centroid toward the larger triangle", () => {
        // A big triangle (area 50) far in +x and a tiny one (area 0.5) near the origin.
        const position = new Float32Array([0, 0, 0, 10, 0, 0, 10, 10, 0, 0, 0, 0, 1, 0, 0, 1, 1, 0]);
        const index = new Uint32Array([0, 1, 2, 3, 4, 5]);
        const c = areaCentroid(position, index)!;
        // The centroid sits close to the big triangle's centroid (≈6.67, 3.33), not the midpoint.
        expect(c.x).toBeGreaterThan(6);
    });

    test("a degenerate (zero-area) mesh yields undefined", () => {
        const position = new Float32Array([0, 0, 0, 1, 0, 0, 2, 0, 0]);
        expect(areaCentroid(position, new Uint32Array([0, 1, 2]))).toBeUndefined();
    });
});
