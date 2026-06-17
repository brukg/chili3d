// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { readFileSync } from "node:fs";
import path from "node:path";
import { type ISolid, Plane, ShapeTypes, XYZ } from "@chili3d/core";
import { initWasm, ShapeFactory } from "@chili3d/wasm";
import { describe, expect, test } from "@rstest/core";

const WASM_BINARY = readFileSync(path.join(process.cwd(), "packages/wasm/lib/chili-wasm.wasm"));

// Backs the Half Section command: cutting a solid with a half-space box at its centre removes exactly
// half the material.
describe("half section", () => {
    test("a 20mm cube cut at its centre keeps half the volume (4000)", async () => {
        await initWasm({ wasmBinary: WASM_BINARY });
        const factory = new ShapeFactory();
        const box = factory.box(Plane.XY, 20, 20, 20);
        const big = 70;
        const cutPlane = new Plane({
            origin: new XYZ({ x: 10 - big, y: 10 - big, z: 10 }),
            normal: XYZ.unitZ,
            xvec: XYZ.unitX,
        });
        const cutter = factory.box(cutPlane, 2 * big, 2 * big, big);
        const result = factory.booleanCut([box.value], [cutter.value]);
        expect(result.isOk).toBe(true);
        const volume = (result.value.findSubShapes(ShapeTypes.solid) as ISolid[]).reduce(
            (sum, s) => sum + s.volume(),
            0,
        );
        expect(volume).toBeCloseTo(4000, 2);
    });
});
