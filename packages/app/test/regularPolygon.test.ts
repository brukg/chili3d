// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { XYZ } from "@chili3d/core";
import { describe, expect, test } from "@rstest/core";
import { RegularPolygonNode } from "../src/bodys/regularPolygon";

describe("regular polygon inscribed vs circumscribed", () => {
    test("effectiveRadius: inscribed keeps the radius, circumscribed grows it by 1/cos(π/n)", () => {
        expect(RegularPolygonNode.effectiveRadius(10, 6, false)).toBeCloseTo(10, 6);
        expect(RegularPolygonNode.effectiveRadius(10, 6, true)).toBeCloseTo(10 / Math.cos(Math.PI / 6), 6);
    });

    test("a circumscribed hexagon has apothem = the given radius (edge tangent to the circle)", () => {
        const r = 10;
        const verts = RegularPolygonNode.calculateVertices(
            XYZ.zero,
            RegularPolygonNode.effectiveRadius(r, 6, true),
            6,
            XYZ.unitZ,
            XYZ.unitX,
        );
        // Vertices sit beyond the circle...
        expect(verts[0].distanceTo(XYZ.zero)).toBeCloseTo(10 / Math.cos(Math.PI / 6), 5);
        // ...but each edge midpoint (the apothem) is exactly on the radius-10 circle.
        const midpoint = verts[0].add(verts[1]).multiply(0.5);
        expect(midpoint.distanceTo(XYZ.zero)).toBeCloseTo(10, 5);
    });

    test("an inscribed hexagon has its vertices on the radius circle", () => {
        const verts = RegularPolygonNode.calculateVertices(XYZ.zero, 10, 6, XYZ.unitZ, XYZ.unitX);
        expect(verts[0].distanceTo(XYZ.zero)).toBeCloseTo(10, 6);
    });
});
