// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { describe, expect, test } from "@rstest/core";
import {
    convexHull2D,
    distanceToPolygonBoundary,
    pointInPolygon,
    stabilityMargin,
    type Vec2,
} from "../src/robot/stability";

const SQUARE: Vec2[] = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
    { x: 0, y: 10 },
];

describe("robot static stability", () => {
    test("convex hull of a square plus an interior point is the four corners", () => {
        const hull = convexHull2D([...SQUARE, { x: 5, y: 5 }]);
        expect(hull).toHaveLength(4);
        // every original corner survives; the interior point does not
        for (const c of SQUARE) {
            expect(hull.some((h) => h.x === c.x && h.y === c.y)).toBe(true);
        }
        expect(hull.some((h) => h.x === 5 && h.y === 5)).toBe(false);
    });

    test("convex hull drops collinear points and returns CCW", () => {
        const hull = convexHull2D([
            { x: 0, y: 0 },
            { x: 5, y: 0 }, // collinear on the bottom edge
            { x: 10, y: 0 },
            { x: 10, y: 10 },
            { x: 0, y: 10 },
        ]);
        expect(hull).toHaveLength(4);
        // signed area > 0 ⇒ counter-clockwise
        let area2 = 0;
        for (let i = 0, j = hull.length - 1; i < hull.length; j = i++) {
            area2 += hull[j].x * hull[i].y - hull[i].x * hull[j].y;
        }
        expect(area2).toBeGreaterThan(0);
    });

    test("convex hull of < 3 unique points returns them as-is", () => {
        expect(convexHull2D([{ x: 1, y: 2 }])).toHaveLength(1);
        expect(
            convexHull2D([
                { x: 0, y: 0 },
                { x: 1, y: 1 },
                { x: 0, y: 0 },
            ]),
        ).toHaveLength(2);
    });

    test("point-in-polygon for inside and outside", () => {
        expect(pointInPolygon({ x: 5, y: 5 }, SQUARE)).toBe(true);
        expect(pointInPolygon({ x: 15, y: 5 }, SQUARE)).toBe(false);
        expect(pointInPolygon({ x: -1, y: 5 }, SQUARE)).toBe(false);
        expect(pointInPolygon({ x: 5, y: 5 }, [{ x: 0, y: 0 }])).toBe(false);
    });

    test("distance to boundary is the nearest edge", () => {
        // centre of the 10×10 square is 5 from every edge
        expect(distanceToPolygonBoundary({ x: 5, y: 5 }, SQUARE)).toBeCloseTo(5, 9);
        // 2 inside the right edge
        expect(distanceToPolygonBoundary({ x: 8, y: 5 }, SQUARE)).toBeCloseTo(2, 9);
        // outside, 3 to the right of the right edge
        expect(distanceToPolygonBoundary({ x: 13, y: 5 }, SQUARE)).toBeCloseTo(3, 9);
    });

    test("stability margin is positive inside, negative outside", () => {
        expect(stabilityMargin({ x: 5, y: 5 }, SQUARE)).toBeCloseTo(5, 9);
        expect(stabilityMargin({ x: 8, y: 5 }, SQUARE)).toBeCloseTo(2, 9);
        expect(stabilityMargin({ x: 13, y: 5 }, SQUARE)).toBeCloseTo(-3, 9);
    });

    test("a COM exactly over a tipping edge has ~zero margin", () => {
        expect(Math.abs(stabilityMargin({ x: 0, y: 5 }, SQUARE))).toBeCloseTo(0, 9);
    });

    test("fewer than three contacts is never stable (non-positive margin)", () => {
        const lineSupport: Vec2[] = [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
        ];
        // COM 4 above the support line → tipping, margin = −4
        expect(stabilityMargin({ x: 5, y: 4 }, lineSupport)).toBeCloseTo(-4, 9);
        // even directly on the line the margin is 0, not positive
        expect(stabilityMargin({ x: 5, y: 0 }, lineSupport)).toBeCloseTo(0, 9);
    });
});
