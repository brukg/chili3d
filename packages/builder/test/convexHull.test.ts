// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { describe, expect, test } from "@rstest/core";
import { convexHull, type Vec3 } from "../src/urdf/convexHull";

// Brute-force convexity check: every hull face plane must have all points on its inner side.
function isConvex(points: Vec3[], faces: [number, number, number][], all: Vec3[]): boolean {
    const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
    const cross = (a: Vec3, b: Vec3): Vec3 => [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
    ];
    const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const centroid: Vec3 = points
        .reduce<Vec3>((c, p) => [c[0] + p[0], c[1] + p[1], c[2] + p[2]], [0, 0, 0])
        .map((v) => v / points.length) as Vec3;

    for (const [a, b, c] of faces) {
        let n = cross(sub(points[b], points[a]), sub(points[c], points[a]));
        let off = dot(n, points[a]);
        if (dot(n, centroid) > off) {
            n = [-n[0], -n[1], -n[2]];
            off = -off;
        }
        const scale = Math.max(1, Math.abs(off));
        for (const p of all) if (dot(n, p) - off > 1e-6 * scale) return false;
    }
    return true;
}

describe("convexHull", () => {
    test("hull of a cube's 8 corners is convex and keeps all 8 corners", () => {
        const corners: Vec3[] = [];
        for (const x of [0, 10]) for (const y of [0, 10]) for (const z of [0, 10]) corners.push([x, y, z]);

        const hull = convexHull(corners);
        expect(hull).toBeDefined();
        expect(hull!.points.length).toBe(8); // all corners are extreme
        expect(hull!.faces.length).toBe(12); // a cube triangulates to 12 faces
        expect(isConvex(hull!.points, hull!.faces, corners)).toBe(true);
    });

    test("interior and surface points do not change the hull, but it stays convex around them", () => {
        const corners: Vec3[] = [];
        for (const x of [0, 10]) for (const y of [0, 10]) for (const z of [0, 10]) corners.push([x, y, z]);
        // Add points strictly inside and on the faces — none should appear as hull vertices.
        const cloud: Vec3[] = [...corners, [5, 5, 5], [5, 5, 0], [2, 8, 5], [10, 5, 5]];

        const hull = convexHull(cloud);
        expect(hull).toBeDefined();
        expect(hull!.points.length).toBe(8);
        expect(isConvex(hull!.points, hull!.faces, cloud)).toBe(true);
    });

    test("hull of an octahedron keeps all 6 apexes and is convex", () => {
        const pts: Vec3[] = [
            [1, 0, 0],
            [-1, 0, 0],
            [0, 1, 0],
            [0, -1, 0],
            [0, 0, 1],
            [0, 0, -1],
        ];
        const hull = convexHull(pts);
        expect(hull).toBeDefined();
        expect(hull!.points.length).toBe(6);
        expect(hull!.faces.length).toBe(8);
        expect(isConvex(hull!.points, hull!.faces, pts)).toBe(true);
    });

    test("returns undefined for degenerate (coplanar) input", () => {
        const square: Vec3[] = [
            [0, 0, 0],
            [1, 0, 0],
            [1, 1, 0],
            [0, 1, 0],
            [0.5, 0.5, 0],
        ];
        expect(convexHull(square)).toBeUndefined();
    });
});
