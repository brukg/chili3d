// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { readFileSync } from "node:fs";
import path from "node:path";
import { taperExtrude } from "@chili3d/app";
import {
    type IApplication,
    type IFace,
    type ISolid,
    Plane,
    ShapeTypes,
    setCurrentApplication,
    XYZ,
} from "@chili3d/core";
import { initWasm, ShapeFactory } from "@chili3d/wasm";
import { beforeAll, describe, expect, test } from "@rstest/core";

const WASM_BINARY = readFileSync(path.join(process.cwd(), "packages/wasm/lib/chili-wasm.wasm"));

// Backs the Taper Extrude command: extruding a 10×10 face by 5 with a taper that insets the top by 2
// (→ a 6×6 top) is a square frustum of volume h/3·(A₁+A₂+√(A₁A₂)) = 5/3·(100+36+60) = 326.67.
describe("taper extrude", () => {
    beforeAll(async () => {
        await initWasm({ wasmBinary: WASM_BINARY });
        setCurrentApplication({ shapeFactory: new ShapeFactory() } as unknown as IApplication);
    });

    test("a tapered extrude of a square is a frustum of the expected volume", () => {
        const factory = new ShapeFactory();
        const rect = factory.rect(Plane.XY, 10, 10);
        // tan(angle) = 2/5 insets the top by 2 over the 5mm height → 6×6 top.
        const angle = (Math.atan(2 / 5) * 180) / Math.PI;
        const result = taperExtrude(rect.value as IFace, XYZ.unitZ, 5, angle);
        expect(result.isOk).toBe(true);
        const volume = (result.value.findSubShapes(ShapeTypes.solid) as ISolid[]).reduce(
            (s, x) => s + x.volume(),
            0,
        );
        expect(volume).toBeCloseTo(326.67, 1);
    });

    test("a zero taper falls back to a straight prism (volume 500)", () => {
        const factory = new ShapeFactory();
        const rect = factory.rect(Plane.XY, 10, 10);
        const result = taperExtrude(rect.value as IFace, XYZ.unitZ, 5, 0);
        expect(result.isOk).toBe(true);
        const volume = (result.value.findSubShapes(ShapeTypes.solid) as ISolid[]).reduce(
            (s, x) => s + x.volume(),
            0,
        );
        expect(volume).toBeCloseTo(500, 2);
    });
});
