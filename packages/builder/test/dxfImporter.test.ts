// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { describe, expect, test } from "@rstest/core";
import { parseDxf } from "../src/dxf/dxfImporter";

// A minimal DXF ENTITIES section: one LINE, one CIRCLE, one ARC.
const DXF = `0
SECTION
2
ENTITIES
0
LINE
10
0.0
20
0.0
11
10.0
21
5.0
0
CIRCLE
10
3.0
20
4.0
40
2.5
0
ARC
10
1.0
20
1.0
40
5.0
50
0.0
51
90.0
0
ENDSEC
0
EOF
`;

describe("DXF importer", () => {
    test("parses LINE / CIRCLE / ARC entities with their group codes", () => {
        const entities = parseDxf(DXF);
        expect(entities.length).toBe(3);
        expect(entities[0]).toEqual({ type: "line", x1: 0, y1: 0, x2: 10, y2: 5 });
        expect(entities[1]).toEqual({ type: "circle", cx: 3, cy: 4, r: 2.5 });
        expect(entities[2]).toEqual({ type: "arc", cx: 1, cy: 1, r: 5, start: 0, end: 90 });
    });

    test("parses a closed LWPOLYLINE with its repeated vertex codes", () => {
        const dxf = [
            "0",
            "LWPOLYLINE",
            "90",
            "3",
            "70",
            "1", // closed flag
            "10",
            "0",
            "20",
            "0",
            "10",
            "4",
            "20",
            "0",
            "10",
            "4",
            "20",
            "3",
            "0",
            "EOF",
        ].join("\n");
        const entities = parseDxf(dxf);
        expect(entities.length).toBe(1);
        const poly = entities[0];
        expect(poly.type).toBe("polyline");
        if (poly.type === "polyline") {
            expect(poly.closed).toBe(true);
            expect(poly.vertices).toEqual([
                { x: 0, y: 0, bulge: 0 },
                { x: 4, y: 0, bulge: 0 },
                { x: 4, y: 3, bulge: 0 },
            ]);
        }
    });

    test("parses an ELLIPSE entity (centre, major axis, ratio, sweep)", () => {
        const dxf = [
            "0",
            "ELLIPSE",
            "10",
            "1",
            "20",
            "2", // centre (1,2)
            "11",
            "4",
            "21",
            "0", // major axis endpoint (4,0) → major radius 4
            "40",
            "0.5", // minor/major ratio → minor radius 2
            "41",
            "0",
            "42",
            "6.283185307", // full sweep (2π)
            "0",
            "EOF",
        ].join("\n");
        const entities = parseDxf(dxf);
        expect(entities.length).toBe(1);
        const e = entities[0];
        expect(e.type).toBe("ellipse");
        if (e.type === "ellipse") {
            expect(e).toMatchObject({ cx: 1, cy: 2, mx: 4, my: 0, ratio: 0.5, start: 0 });
            expect(e.end).toBeCloseTo(2 * Math.PI, 5);
        }
    });

    test("parses a partial ELLIPSE (start/end parameters)", () => {
        const dxf = [
            "0",
            "ELLIPSE",
            "10",
            "0",
            "20",
            "0", // centre
            "11",
            "5",
            "21",
            "0", // major radius 5 along +x
            "40",
            "0.4", // ratio
            "41",
            "0",
            "42",
            "1.5707963", // 0 → π/2 (a quarter arc)
            "0",
            "EOF",
        ].join("\n");
        const entities = parseDxf(dxf);
        expect(entities.length).toBe(1);
        const e = entities[0];
        expect(e.type).toBe("ellipse");
        if (e.type === "ellipse") {
            expect(e.start).toBeCloseTo(0, 6);
            expect(e.end).toBeCloseTo(Math.PI / 2, 5);
        }
    });

    test("parses a SPLINE entity, preferring fit points over control points", () => {
        const dxf = [
            "0",
            "SPLINE",
            "70",
            "0", // open
            "10",
            "0",
            "20",
            "0", // control point (ignored when fit points exist)
            "10",
            "5",
            "20",
            "9",
            "11",
            "0",
            "21",
            "0", // fit point 1
            "11",
            "4",
            "21",
            "3", // fit point 2
            "11",
            "8",
            "21",
            "0", // fit point 3
            "0",
            "EOF",
        ].join("\n");
        const entities = parseDxf(dxf);
        expect(entities.length).toBe(1);
        const e = entities[0];
        expect(e.type).toBe("spline");
        if (e.type === "spline") {
            expect(e.closed).toBe(false);
            expect(e.points).toEqual([
                { x: 0, y: 0 },
                { x: 4, y: 3 },
                { x: 8, y: 0 },
            ]);
        }
    });

    test("falls back to a SPLINE's control points when there are no fit points", () => {
        const dxf = [
            "0",
            "SPLINE",
            "70",
            "1", // closed
            "10",
            "0",
            "20",
            "0",
            "10",
            "10",
            "20",
            "0",
            "10",
            "10",
            "20",
            "10",
            "0",
            "EOF",
        ].join("\n");
        const entities = parseDxf(dxf);
        expect(entities.length).toBe(1);
        const e = entities[0];
        expect(e.type).toBe("spline");
        if (e.type === "spline") {
            expect(e.closed).toBe(true);
            expect(e.points.length).toBe(3);
        }
    });

    test("ignores unsupported entities and sections", () => {
        const dxf =
            "0\nSECTION\n2\nHEADER\n0\nTEXT\n10\n1\n20\n2\n0\nLINE\n10\n0\n20\n0\n11\n1\n21\n1\n0\nEOF\n";
        const entities = parseDxf(dxf);
        expect(entities.length).toBe(1);
        expect(entities[0].type).toBe("line");
    });
});
