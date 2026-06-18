// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { readFileSync } from "node:fs";
import path from "node:path";
import { type IShape, Plane } from "@chili3d/core";
import { initWasm, ShapeFactory } from "@chili3d/wasm";
import { describe, expect, test } from "@rstest/core";

const WASM_BINARY = readFileSync(path.join(process.cwd(), "packages/wasm/lib/chili-wasm.wasm"));

// Backs the Convert to Mesh command: a B-rep body exposes a triangulated face mesh (positions + index)
// that maps straight onto a MeshNode. A box's six planar quads tessellate to 12 triangles spanning the
// box bounds, with matching normals/uvs.
describe("convert to mesh", () => {
    test("a box tessellates to 12 triangles covering its bounds", async () => {
        await initWasm({ wasmBinary: WASM_BINARY });
        const factory = new ShapeFactory();
        const box = factory.box(Plane.XY, 10, 20, 30);
        const faces = (box.value as IShape).mesh.faces;

        expect(faces).toBeDefined();
        const f = faces!;
        expect(f.index.length).toBe(36); // 6 quads × 2 triangles × 3 indices
        expect(f.index.length % 3).toBe(0);
        // Per-vertex normals and uvs accompany every position.
        expect(f.normal.length).toBe(f.position.length);
        expect(f.uv.length).toBe((f.position.length / 3) * 2);

        let maxX = 0;
        let maxY = 0;
        let maxZ = 0;
        for (let i = 0; i < f.position.length; i += 3) {
            maxX = Math.max(maxX, f.position[i]);
            maxY = Math.max(maxY, f.position[i + 1]);
            maxZ = Math.max(maxZ, f.position[i + 2]);
        }
        expect(maxX).toBeCloseTo(10, 5);
        expect(maxY).toBeCloseTo(20, 5);
        expect(maxZ).toBeCloseTo(30, 5);
    });
});
