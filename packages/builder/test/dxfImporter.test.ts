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
                { x: 0, y: 0 },
                { x: 4, y: 0 },
                { x: 4, y: 3 },
            ]);
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
