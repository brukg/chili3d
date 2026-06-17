// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { describe, expect, test } from "@rstest/core";
import { parseSvg } from "../src/svg/svgImporter";

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
