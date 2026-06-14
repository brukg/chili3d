// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { describe, expect, test } from "@rstest/core";
import {
    coincident,
    distance,
    fixed,
    horizontal,
    solveConstraints,
    vertical,
} from "../src/sketch/constraintSolver";

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

describe("solveConstraints", () => {
    test("fixed + distance places the second point at the right distance", () => {
        const result = solveConstraints(
            [
                { x: 0, y: 0 },
                { x: 3, y: 4 }, // start off
            ],
            [fixed(0, 0, 0), distance(0, 1, 10)],
        );
        expect(result.converged).toBe(true);
        expect(result.points[0].x).toBeCloseTo(0, 6);
        expect(result.points[0].y).toBeCloseTo(0, 6);
        expect(dist(result.points[0], result.points[1])).toBeCloseTo(10, 5);
    });

    test("horizontal + vertical align a square's corners", () => {
        // 4 corners; pin p0 at origin, p1 right of p0 (horizontal, dist 10),
        // p3 above p0 (vertical, dist 10), p2 coincident-ish via h/v from p1 and p3.
        const result = solveConstraints(
            [
                { x: 0, y: 0 },
                { x: 9, y: 1 },
                { x: 8, y: 11 },
                { x: 1, y: 9 },
            ],
            [
                fixed(0, 0, 0),
                horizontal(0, 1),
                distance(0, 1, 10),
                vertical(0, 3),
                distance(0, 3, 10),
                horizontal(3, 2),
                vertical(1, 2),
            ],
        );
        expect(result.converged).toBe(true);
        const [p0, p1, p2, p3] = result.points;
        expect(dist(p0, p1)).toBeCloseTo(10, 4);
        expect(dist(p0, p3)).toBeCloseTo(10, 4);
        expect(p0.y).toBeCloseTo(p1.y, 4); // horizontal
        expect(p0.x).toBeCloseTo(p3.x, 4); // vertical
        expect(p3.y).toBeCloseTo(p2.y, 4); // top edge horizontal
        expect(p1.x).toBeCloseTo(p2.x, 4); // right edge vertical
    });

    test("coincident merges two points", () => {
        const result = solveConstraints(
            [
                { x: 0, y: 0 },
                { x: 5, y: 5 },
            ],
            [fixed(0, 2, 3), coincident(0, 1)],
        );
        expect(result.converged).toBe(true);
        expect(result.points[1].x).toBeCloseTo(2, 6);
        expect(result.points[1].y).toBeCloseTo(3, 6);
    });

    test("under-constrained system still converges (free DoF stay near start)", () => {
        // Only one distance constraint between two free points — many solutions; should converge.
        const result = solveConstraints(
            [
                { x: 0, y: 0 },
                { x: 1, y: 0 },
            ],
            [distance(0, 1, 5)],
        );
        expect(result.converged).toBe(true);
        expect(dist(result.points[0], result.points[1])).toBeCloseTo(5, 5);
    });
});
