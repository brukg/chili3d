// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { XYZ } from "@chili3d/core";
import { describe, expect, test } from "@rstest/core";
import { meshPlaneSegments } from "../src/commands/create/meshSection";

// A 10×20×30 axis-aligned box surface as a raw triangle soup (8 corners, 12 triangles).
const POSITION = new Float32Array([
    0, 0, 0, 10, 0, 0, 10, 20, 0, 0, 20, 0, 0, 0, 30, 10, 0, 30, 10, 20, 30, 0, 20, 30,
]);
const INDEX = new Uint32Array([
    0,
    2,
    1,
    0,
    3,
    2, // bottom z=0
    4,
    5,
    6,
    4,
    6,
    7, // top z=30
    0,
    1,
    5,
    0,
    5,
    4, // front y=0
    2,
    3,
    7,
    2,
    7,
    6, // back y=20
    0,
    4,
    7,
    0,
    7,
    3, // left x=0
    1,
    2,
    6,
    1,
    6,
    5, // right x=10
]);

describe("meshPlaneSegments", () => {
    test("cutting a 10×20×30 box mesh at mid-height yields the section rectangle (perimeter 60)", () => {
        const origin = new XYZ({ x: 0, y: 0, z: 15 });
        const normal = new XYZ({ x: 0, y: 0, z: 1 });
        const segments = meshPlaneSegments(POSITION, INDEX, origin, normal);

        // 4 side faces × 2 triangles each cross the plane; the flat top/bottom faces do not.
        expect(segments.length).toBe(8);
        const total = segments.reduce((s, [a, b]) => s + a.distanceTo(b), 0);
        expect(total).toBeCloseTo(60, 4); // 2·(10 + 20)
        // Every crossing point sits on the cut plane.
        for (const [a, b] of segments) {
            expect(a.z).toBeCloseTo(15, 6);
            expect(b.z).toBeCloseTo(15, 6);
        }
    });

    test("a plane that misses the mesh produces no segments", () => {
        const segments = meshPlaneSegments(
            POSITION,
            INDEX,
            new XYZ({ x: 0, y: 0, z: 100 }),
            new XYZ({ x: 0, y: 0, z: 1 }),
        );
        expect(segments.length).toBe(0);
    });
});
