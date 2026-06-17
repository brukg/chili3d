// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { readFileSync } from "node:fs";
import path from "node:path";
import { spiralPoints } from "@chili3d/app";
import { type IEdge, XYZ } from "@chili3d/core";
import { initWasm, ShapeFactory } from "@chili3d/wasm";
import { describe, expect, test } from "@rstest/core";

const WASM_BINARY = readFileSync(path.join(process.cwd(), "packages/wasm/lib/chili-wasm.wasm"));

// Backs the Spiral curve: the SpiralNode interpolates a B-spline through the sampled spiral points.
describe("spiral curve", () => {
    test("the interpolated spiral passes through its sample points", async () => {
        await initWasm({ wasmBinary: WASM_BINARY });
        const factory = new ShapeFactory();
        const pts = spiralPoints(XYZ.zero, XYZ.unitZ, 0, 10, 2, 64);
        const spiral = factory.interpolate(pts, false);
        expect(spiral.isOk).toBe(true);

        const curve = (spiral.value as IEdge).curve;
        // Check a few sampled points lie on the curve.
        for (const i of [16, 32, 48, 64]) {
            expect(curve.nearestFromPoint(pts[i]).distance).toBeCloseTo(0, 4);
        }
    });
});
