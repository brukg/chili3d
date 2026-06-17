// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { readFileSync } from "node:fs";
import path from "node:path";
import { type IVertex, Plane, ShapeTypes } from "@chili3d/core";
import { initWasm, ShapeFactory } from "@chili3d/wasm";
import { describe, expect, test } from "@rstest/core";

const WASM_BINARY = readFileSync(path.join(process.cwd(), "packages/wasm/lib/chili-wasm.wasm"));

// Backs Measure Coordinates: IVertex.point() returns the vertex world position.
describe("coordinates", () => {
    test("every vertex of a 20mm cube is a corner of [0..20]³", async () => {
        await initWasm({ wasmBinary: WASM_BINARY });
        const factory = new ShapeFactory();
        const box = factory.box(Plane.XY, 20, 20, 20);
        const verts = box.value.findSubShapes(ShapeTypes.vertex) as IVertex[];
        expect(verts.length).toBe(8);
        for (const v of verts) {
            const p = v.point();
            for (const c of [p.x, p.y, p.z]) {
                expect(Math.abs(c) < 1e-6 || Math.abs(c - 20) < 1e-6).toBe(true);
            }
        }
    });
});
