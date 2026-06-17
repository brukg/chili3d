// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { readFileSync } from "node:fs";
import path from "node:path";
import { Plane, ShapeTypes } from "@chili3d/core";
import { initWasm, ShapeFactory } from "@chili3d/wasm";
import { describe, expect, test } from "@rstest/core";

const WASM_BINARY = readFileSync(path.join(process.cwd(), "packages/wasm/lib/chili-wasm.wasm"));

// Backs Measure Topology: a box has 6 faces, 12 edges, 8 vertices (Euler: V−E+F = 8−12+6 = 2).
describe("Topology count", () => {
    test("a box reports 6 faces, 12 edges, 8 vertices", async () => {
        await initWasm({ wasmBinary: WASM_BINARY });
        const factory = new ShapeFactory();
        const box = factory.box(Plane.XY, 10, 10, 10);
        expect(box.value.findSubShapes(ShapeTypes.face).length).toBe(6);
        expect(box.value.findSubShapes(ShapeTypes.edge).length).toBe(12);
        expect(box.value.findSubShapes(ShapeTypes.vertex).length).toBe(8);
    });
});
