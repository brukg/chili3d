// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { readFileSync } from "node:fs";
import path from "node:path";
import { roundedRectFace } from "@chili3d/app";
import { type IApplication, type IFace, Plane, ShapeTypes, setCurrentApplication } from "@chili3d/core";
import { initWasm, ShapeFactory } from "@chili3d/wasm";
import { beforeAll, describe, expect, test } from "@rstest/core";

const WASM_BINARY = readFileSync(path.join(process.cwd(), "packages/wasm/lib/chili-wasm.wasm"));

// Backs the Rounded Rectangle command: a w×h rectangle with r-radius corners has area w·h − (4 − π)·r²
// (four corner squares removed, four quarter-circles added back).
describe("rounded rectangle", () => {
    beforeAll(async () => {
        await initWasm({ wasmBinary: WASM_BINARY });
        setCurrentApplication({ shapeFactory: new ShapeFactory() } as unknown as IApplication);
    });

    test("area = w·h − (4 − π)·r²", () => {
        const face = roundedRectFace(Plane.XY, 20, 10, 3);
        expect(face.isOk).toBe(true);
        const area = (face.value.findSubShapes(ShapeTypes.face) as IFace[]).reduce((s, f) => s + f.area(), 0);
        expect(area).toBeCloseTo(20 * 10 - (4 - Math.PI) * 9, 1);
    });

    test("with r = half the short side it is a stadium (two semicircle ends)", () => {
        // w=20, h=10, r=5 → area = 200 − (4−π)·25 = 200 − 21.46 = 178.54.
        const face = roundedRectFace(Plane.XY, 20, 10, 5);
        expect(face.isOk).toBe(true);
        const area = (face.value.findSubShapes(ShapeTypes.face) as IFace[]).reduce((s, f) => s + f.area(), 0);
        expect(area).toBeCloseTo(200 - (4 - Math.PI) * 25, 1);
    });
});
