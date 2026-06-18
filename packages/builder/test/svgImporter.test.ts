// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { describe, expect, test } from "@rstest/core";
import { arcToBeziers, parseSvg } from "../src/svg/svgImporter";

// Evaluate a cubic Bezier at parameter t.
function bezierAt(p: { x: number; y: number }[], t: number) {
    const u = 1 - t;
    const b0 = u * u * u;
    const b1 = 3 * u * u * t;
    const b2 = 3 * u * t * t;
    const b3 = t * t * t;
    return {
        x: b0 * p[0].x + b1 * p[1].x + b2 * p[2].x + b3 * p[3].x,
        y: b0 * p[0].y + b1 * p[1].y + b2 * p[2].y + b3 * p[3].y,
    };
}

describe("SVG importer", () => {
    test("parses basic shapes with the y-axis flipped to CAD orientation", () => {
        const svg = `<svg>
            <line x1="0" y1="0" x2="10" y2="4"/>
            <circle cx="5" cy="6" r="3"/>
            <ellipse cx="1" cy="2" rx="4" ry="2"/>
        </svg>`;
        const entities = parseSvg(svg);
        expect(entities).toEqual([
            { type: "line", x1: 0, y1: -0, x2: 10, y2: -4 },
            { type: "circle", cx: 5, cy: -6, r: 3 },
            { type: "ellipse", cx: 1, cy: -2, rx: 4, ry: 2 },
        ]);
    });

    test("a rect becomes four lines (y flipped)", () => {
        const lines = parseSvg(`<rect x="0" y="0" width="10" height="6"/>`);
        expect(lines.length).toBe(4);
        expect(lines[0]).toEqual({ type: "line", x1: 0, y1: -0, x2: 10, y2: -0 });
        expect(lines[2]).toEqual({ type: "line", x1: 10, y1: -6, x2: 0, y2: -6 });
    });

    test("a path with M/L/Z makes a closed triangle of 3 lines", () => {
        const lines = parseSvg(`<path d="M0 0 L10 0 L10 5 Z"/>`);
        expect(lines.length).toBe(3);
        expect(lines[0]).toEqual({ type: "line", x1: 0, y1: -0, x2: 10, y2: -0 });
        expect(lines[1]).toEqual({ type: "line", x1: 10, y1: -0, x2: 10, y2: -5 });
        // Z closes back to the subpath start (0,0).
        expect(lines[2]).toEqual({ type: "line", x1: 10, y1: -5, x2: 0, y2: -0 });
    });

    test("relative commands and H/V accumulate from the current point", () => {
        // m moves to (2,2); h10 → (12,2); v5 → (12,7); l-10 0 → (2,7).
        const lines = parseSvg(`<path d="m2 2 h10 v5 l-10 0"/>`);
        expect(lines.map((l) => l.type === "line" && [l.x1, l.y1, l.x2, l.y2])).toEqual([
            [2, -2, 12, -2],
            [12, -2, 12, -7],
            [12, -7, 2, -7],
        ]);
    });

    test("a cubic bezier path yields a cubic with four control points", () => {
        const e = parseSvg(`<path d="M0 0 C0 10 10 10 10 0"/>`);
        expect(e.length).toBe(1);
        expect(e[0].type).toBe("cubic");
        if (e[0].type === "cubic") {
            expect(e[0].points).toEqual([
                { x: 0, y: -0 },
                { x: 0, y: -10 },
                { x: 10, y: -10 },
                { x: 10, y: -0 },
            ]);
        }
    });
});

describe("SVG arc (A) → cubic Beziers", () => {
    test("a quarter-circle arc keeps its endpoints and stays on the radius-10 circle", () => {
        // From (10,0) to (0,10), rx=ry=10, no rotation, small arc, sweep=1 (the 90° quarter).
        const beziers = arcToBeziers(10, 0, 10, 10, 0, false, true, 0, 10);
        expect(beziers.length).toBe(1);
        const b = beziers[0];
        // Endpoints are exact.
        expect(b[0].x).toBeCloseTo(10, 6);
        expect(b[0].y).toBeCloseTo(0, 6);
        expect(b[3].x).toBeCloseTo(0, 6);
        expect(b[3].y).toBeCloseTo(10, 6);
        // Sampled points lie on the circle of radius 10 (Bezier approximation error < 0.02mm).
        for (const t of [0.25, 0.5, 0.75]) {
            const p = bezierAt(b, t);
            expect(Math.hypot(p.x, p.y)).toBeCloseTo(10, 2);
        }
    });

    test("a half-circle arc splits into two 90° Bezier segments", () => {
        const beziers = arcToBeziers(10, 0, 10, 10, 0, true, true, -10, 0);
        expect(beziers.length).toBe(2);
        // The two segments join at the top of the circle (0,10).
        expect(beziers[0][3].x).toBeCloseTo(0, 5);
        expect(beziers[0][3].y).toBeCloseTo(10, 5);
    });

    test("a path with an A command imports without error and flips y", () => {
        const e = parseSvg(`<path d="M10 0 A10 10 0 0 1 0 10"/>`);
        expect(e.length).toBe(1);
        expect(e[0].type).toBe("cubic");
        if (e[0].type === "cubic") {
            // Start point y-flipped (was 0), end point y-flipped (10 → -10).
            expect(e[0].points[0]).toEqual({ x: 10, y: -0 });
            expect(e[0].points[3].x).toBeCloseTo(0, 6);
            expect(e[0].points[3].y).toBeCloseTo(-10, 6);
        }
    });

    test("S reflects the previous cubic's control point about the current point", () => {
        // C control2 = (10,10); about the endpoint (20,0) that reflects to (30,-10).
        const e = parseSvg(`<path d="M0,0 C0,0 10,10 20,0 S40,-10 50,0"/>`);
        expect(e.length).toBe(2);
        expect(e[1].type).toBe("cubic");
        if (e[1].type === "cubic") {
            expect(e[1].points[1].x).toBeCloseTo(30, 6);
            expect(e[1].points[1].y).toBeCloseTo(10, 6); // SVG -10, y-flipped
        }
    });

    test("S with no preceding cubic uses the current point as the first control", () => {
        const e = parseSvg(`<path d="M0,0 S10,10 20,0"/>`);
        expect(e[0].type).toBe("cubic");
        if (e[0].type === "cubic") {
            expect(e[0].points[1].x).toBeCloseTo(0, 6);
            expect(e[0].points[1].y).toBeCloseTo(0, 6);
        }
    });

    test("T reflects the previous quadratic's control point (promoted to a cubic)", () => {
        // Q control = (10,10); reflected about (20,0) → (30,-10). Promoted c1.x = 20 + 2/3·(30−20).
        const e = parseSvg(`<path d="M0,0 Q10,10 20,0 T40,0"/>`);
        expect(e.length).toBe(2);
        expect(e[1].type).toBe("cubic");
        if (e[1].type === "cubic") {
            expect(e[1].points[1].x).toBeCloseTo(20 + (2 / 3) * 10, 6);
        }
    });
});
