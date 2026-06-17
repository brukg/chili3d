// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { describe, expect, test } from "@rstest/core";
import { parseObj } from "../src/obj/objImporter";

// A unit cube: 8 vertices, 6 quad faces.
const CUBE = `
v 0 0 0
v 1 0 0
v 1 1 0
v 0 1 0
v 0 0 1
v 1 0 1
v 1 1 1
v 0 1 1
f 1 2 3 4
f 5 6 7 8
f 1 2 6 5
f 2 3 7 6
f 3 4 8 7
f 4 1 5 8
`;

describe("OBJ importer", () => {
    test("parses a cube into 8 vertices and 12 triangles", () => {
        const { position, index } = parseObj(CUBE);
        expect(position.length).toBe(8 * 3); // 8 vertices
        expect(index.length).toBe(12 * 3); // 6 quads → 12 triangles → 36 indices
        // Indices stay in range and the second vertex is (1,0,0).
        expect(Math.max(...index)).toBeLessThan(8);
        expect([position[3], position[4], position[5]]).toEqual([1, 0, 0]);
    });

    test("handles v/vt/vn face tokens and negative indices", () => {
        const obj = "v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1/1/1 2/2/2 3/3/3\nf -3 -2 -1";
        const { position, index } = parseObj(obj);
        expect(position.length).toBe(9);
        expect(index.length).toBe(6); // two triangles
        expect(Array.from(index.slice(3, 6))).toEqual([0, 1, 2]); // negatives → first three verts
    });
});
