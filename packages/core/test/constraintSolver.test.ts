// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { describe, expect, test } from "@rstest/core";
import {
    analyzeConstraints,
    angle,
    coincident,
    distance,
    distanceX,
    distanceY,
    equalLength,
    fixed,
    horizontal,
    parallel,
    perpendicular,
    pointOnLine,
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

    test("perpendicular makes two segments meet at a right angle", () => {
        // p0-p1 fixed horizontal; p2 must make p1-p2 perpendicular to p0-p1.
        const result = solveConstraints(
            [
                { x: 0, y: 0 },
                { x: 10, y: 0 },
                { x: 12, y: 7 }, // start with a non-right angle
            ],
            [fixed(0, 0, 0), fixed(1, 10, 0), perpendicular(0, 1, 1, 2)],
        );
        expect(result.converged).toBe(true);
        const [p0, p1, p2] = result.points;
        const u = { x: p1.x - p0.x, y: p1.y - p0.y };
        const w = { x: p2.x - p1.x, y: p2.y - p1.y };
        expect(u.x * w.x + u.y * w.y).toBeCloseTo(0, 5); // dot ≈ 0
    });

    test("parallel + equalLength shapes a parallelogram-ish constraint", () => {
        const result = solveConstraints(
            [
                { x: 0, y: 0 },
                { x: 10, y: 0 },
                { x: 1, y: 5 },
                { x: 12, y: 6 },
            ],
            [fixed(0, 0, 0), fixed(1, 10, 0), parallel(0, 1, 2, 3), equalLength(0, 1, 2, 3)],
        );
        expect(result.converged).toBe(true);
        const [p0, p1, p2, p3] = result.points;
        const cross = (p1.x - p0.x) * (p3.y - p2.y) - (p1.y - p0.y) * (p3.x - p2.x);
        expect(cross).toBeCloseTo(0, 4); // parallel
        expect(Math.hypot(p3.x - p2.x, p3.y - p2.y)).toBeCloseTo(10, 4); // equal length
    });

    test("pointOnLine pulls a point onto a line", () => {
        const result = solveConstraints(
            [
                { x: 0, y: 0 },
                { x: 10, y: 10 },
                { x: 5, y: 1 }, // off the y=x line
            ],
            [fixed(0, 0, 0), fixed(1, 10, 10), pointOnLine(2, 0, 1)],
        );
        expect(result.converged).toBe(true);
        const p2 = result.points[2];
        expect(p2.x).toBeCloseTo(p2.y, 4); // on the line y = x
    });

    test("distanceX / distanceY dimension a point precisely", () => {
        const result = solveConstraints(
            [
                { x: 0, y: 0 },
                { x: 1, y: 1 },
            ],
            [fixed(0, 0, 0), distanceX(0, 1, 30), distanceY(0, 1, 20)],
        );
        expect(result.converged).toBe(true);
        expect(result.points[1].x).toBeCloseTo(30, 6);
        expect(result.points[1].y).toBeCloseTo(20, 6);
    });

    test("angle constrains the opening between two segments", () => {
        const result = solveConstraints(
            [
                { x: 0, y: 0 },
                { x: 10, y: 0 },
                { x: 8, y: 2 }, // start at a shallow angle
            ],
            [fixed(0, 0, 0), fixed(1, 10, 0), distance(1, 2, 10), angle(1, 0, 1, 2, Math.PI / 4)],
        );
        expect(result.converged).toBe(true);
        const [p0, p1, p2] = result.points;
        const u = { x: p0.x - p1.x, y: p0.y - p1.y };
        const w = { x: p2.x - p1.x, y: p2.y - p1.y };
        const measured = Math.atan2(u.x * w.y - u.y * w.x, u.x * w.x + u.y * w.y);
        expect(Math.abs(measured)).toBeCloseTo(Math.PI / 4, 4); // 45°
    });

    test("analyzeConstraints reports degrees of freedom and constraint status", () => {
        const square = [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 10, y: 10 },
            { x: 0, y: 10 },
        ];
        const squareCons = [
            fixed(0, 0, 0),
            horizontal(0, 1),
            distance(0, 1, 10),
            vertical(0, 3),
            distance(0, 3, 10),
            horizontal(3, 2),
            vertical(1, 2),
        ];
        // 8 variables, 8 independent constraints → fully constrained, 0 DoF.
        const full = analyzeConstraints(square, squareCons);
        expect(full.variables).toBe(8);
        expect(full.degreesOfFreedom).toBe(0);
        expect(full.status).toBe("fully-constrained");

        // Just one distance between two points → 4 vars, 1 constraint → 3 DoF.
        const under = analyzeConstraints(
            [
                { x: 0, y: 0 },
                { x: 5, y: 0 },
            ],
            [distance(0, 1, 5)],
        );
        expect(under.degreesOfFreedom).toBe(3);
        expect(under.status).toBe("under-constrained");

        // The square plus a redundant duplicate distance → over-constrained.
        const over = analyzeConstraints(square, [...squareCons, distance(0, 1, 10)]);
        expect(over.redundant).toBeGreaterThan(0);
        expect(over.status).toBe("over-constrained");
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
