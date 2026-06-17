// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { readFileSync } from "node:fs";
import path from "node:path";
import { type IEdge, Plane, ShapeTypes } from "@chili3d/core";
import { initWasm, ShapeFactory } from "@chili3d/wasm";
import { describe, expect, test } from "@rstest/core";

const WASM_BINARY = readFileSync(path.join(process.cwd(), "packages/wasm/lib/chili-wasm.wasm"));

// Backs the Projected View command: IShape.hlr returns the visible-edge outline flattened onto the
// view plane (hidden-line removal). A box viewed down -Z flattens to its 10×10 footprint.
describe("hlr projection", () => {
    test("a box projected along -Z is a flat 10x10 outline", async () => {
        await initWasm({ wasmBinary: WASM_BINARY });
        const factory = new ShapeFactory();
        const box = factory.box(Plane.XY, 10, 10, 10); // [0..10]^3
        expect(box.isOk).toBe(true);

        const proj = box.value.hlr({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -1 }, { x: 1, y: 0, z: 0 });
        const edges = proj.findSubShapes(ShapeTypes.edge) as IEdge[];
        expect(edges.length).toBeGreaterThan(0);

        const { min, max } = proj.boundingBox();
        // The outline is 10 wide × 10 tall and flat (no depth) in the projection plane.
        expect(max.x - min.x).toBeCloseTo(10, 3);
        expect(max.y - min.y).toBeCloseTo(10, 3);
        expect(max.z - min.z).toBeCloseTo(0, 3);
    });
});
