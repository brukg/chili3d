// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { readFileSync } from "node:fs";
import path from "node:path";
import { type IShape, type ISolid, Plane, ShapeTypes, type XYZLike } from "@chili3d/core";
import { initWasm, ShapeFactory } from "@chili3d/wasm";
import { describe, expect, test } from "@rstest/core";

const WASM_BINARY = readFileSync(path.join(process.cwd(), "packages/wasm/lib/chili-wasm.wasm"));

// Backs the Mesh → BRep command: sewing a body's own triangle mesh back together reconstructs the solid.
// A box round-trips (tessellate → meshToShape) to a closed, valid solid of the original volume.
describe("meshToShape (mesh → BRep)", () => {
    const volumeOf = (shape: IShape) =>
        (shape.findSubShapes(ShapeTypes.solid) as ISolid[]).reduce((s, x) => s + x.volume(), 0);

    test("a box's triangle mesh sews back into a valid solid of the same volume", async () => {
        await initWasm({ wasmBinary: WASM_BINARY });
        const factory = new ShapeFactory();
        const box = factory.box(Plane.XY, 10, 20, 30);
        const faces = (box.value as IShape).mesh.faces;
        expect(faces).toBeDefined();

        const corners: XYZLike[] = new Array(faces!.index.length);
        for (let i = 0; i < faces!.index.length; i++) {
            const v = faces!.index[i] * 3;
            corners[i] = { x: faces!.position[v], y: faces!.position[v + 1], z: faces!.position[v + 2] };
        }

        const result = factory.meshToShape(corners);
        expect(result.isOk).toBe(true);
        expect(result.value.isValid()).toBe(true);
        expect(volumeOf(result.value)).toBeCloseTo(6000, 1);
    });
});
