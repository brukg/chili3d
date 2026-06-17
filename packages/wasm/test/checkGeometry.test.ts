// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { readFileSync } from "node:fs";
import path from "node:path";
import { type IShape, Plane, XYZ } from "@chili3d/core";
import { initWasm, ShapeFactory } from "@chili3d/wasm";
import { describe, expect, test } from "@rstest/core";

const WASM_BINARY = readFileSync(path.join(process.cwd(), "packages/wasm/lib/chili-wasm.wasm"));

// Backs the Check Geometry measure: BRepCheck_Analyzer flags well-formed kernel output as valid.
describe("check geometry (isValid)", () => {
    test("a primitive box is valid", async () => {
        await initWasm({ wasmBinary: WASM_BINARY });
        const factory = new ShapeFactory();
        const box = factory.box(Plane.XY, 10, 20, 30);
        expect(box.isOk).toBe(true);
        expect((box.value as IShape).isValid()).toBe(true);
    });

    test("a boolean fusion of two overlapping boxes is valid", async () => {
        await initWasm({ wasmBinary: WASM_BINARY });
        const factory = new ShapeFactory();
        const a = factory.box(Plane.XY, 20, 20, 20);
        const offset = new Plane({
            origin: new XYZ({ x: 10, y: 10, z: 10 }),
            normal: Plane.XY.normal,
            xvec: Plane.XY.xvec,
        });
        const b = factory.box(offset, 20, 20, 20);
        const fused = factory.booleanFuse([a.value], [b.value], true);
        expect(fused.isOk).toBe(true);
        expect((fused.value as IShape).isValid()).toBe(true);
    });
});
