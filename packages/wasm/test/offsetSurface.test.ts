// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { readFileSync } from "node:fs";
import path from "node:path";
import { type IFace, Plane, ShapeTypes } from "@chili3d/core";
import { initWasm, ShapeFactory } from "@chili3d/wasm";
import { describe, expect, test } from "@rstest/core";

const WASM_BINARY = readFileSync(path.join(process.cwd(), "packages/wasm/lib/chili-wasm.wasm"));

// Backs the Offset Surface command: a planar face offset along its normal stays the same size but
// moves by the offset distance.
describe("offsetSurface", () => {
    test("a 10x10 face offset by 5 is a parallel face 5 mm away", async () => {
        await initWasm({ wasmBinary: WASM_BINARY });
        const factory = new ShapeFactory();
        const rect = factory.rect(Plane.XY, 10, 10); // z = 0 plane
        expect(rect.isOk).toBe(true);

        const offset = factory.offsetSurface(rect.value, 5);
        expect(offset.isOk).toBe(true);
        const face = (offset.value.findSubShapes(ShapeTypes.face) as IFace[])[0];
        // Planar offset preserves area.
        expect(face.area()).toBeCloseTo(100, 4);
        // The face now sits on the z = 5 plane.
        const { min, max } = face.boundingBox();
        expect(min.z).toBeCloseTo(5, 4);
        expect(max.z).toBeCloseTo(5, 4);
    });
});
