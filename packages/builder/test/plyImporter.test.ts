// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { describe, expect, test } from "@rstest/core";
import { parsePly } from "../src/ply/plyImporter";

const QUAD = `ply
format ascii 1.0
element vertex 4
property float x
property float y
property float z
element face 2
property list uchar int vertex_indices
end_header
0 0 0
2 0 0
2 3 0
0 3 0
3 0 1 2
3 0 2 3
`;

describe("PLY importer", () => {
    test("parses an ASCII PLY quad into 4 vertices and 2 triangles", () => {
        const { position, index } = parsePly(QUAD);
        expect(position.length).toBe(4 * 3);
        expect(index.length).toBe(2 * 3);
        expect([position[6], position[7], position[8]]).toEqual([2, 3, 0]); // third vertex
        expect(Math.max(...index)).toBeLessThan(4);
    });

    test("returns empty for a binary PLY (unsupported)", () => {
        const bin = "ply\nformat binary_little_endian 1.0\nelement vertex 1\nend_header\n";
        const { position } = parsePly(bin);
        expect(position.length).toBe(0);
    });
});
