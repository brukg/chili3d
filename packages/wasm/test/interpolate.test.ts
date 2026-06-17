// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { readFileSync } from "node:fs";
import path from "node:path";
import { type IEdge, XYZ } from "@chili3d/core";
import { initWasm, ShapeFactory } from "@chili3d/wasm";
import { describe, expect, test } from "@rstest/core";

const WASM_BINARY = readFileSync(path.join(process.cwd(), "packages/wasm/lib/chili-wasm.wasm"));

// Backs the Fit Point Spline command: shapeFactory.interpolate builds a B-spline through every point.
describe("interpolate (fit-point spline)", () => {
    test("the spline passes through every fit point", async () => {
        await initWasm({ wasmBinary: WASM_BINARY });
        const factory = new ShapeFactory();
        const pts = [
            { x: 0, y: 0, z: 0 },
            { x: 10, y: 8, z: 0 },
            { x: 20, y: -4, z: 0 },
            { x: 30, y: 6, z: 0 },
        ];
        const spline = factory.interpolate(pts, false);
        expect(spline.isOk).toBe(true);

        const curve = (spline.value as IEdge).curve;
        for (const p of pts) {
            // Distance from each fit point to the curve must be ~0 (it interpolates, not approximates).
            expect(curve.nearestFromPoint(new XYZ(p)).distance).toBeCloseTo(0, 4);
        }
        // A through-curve over a spread of points is at least as long as the first chord.
        expect(curve.length()).toBeGreaterThan(10);
    });

    test("fewer than two points fails cleanly", async () => {
        await initWasm({ wasmBinary: WASM_BINARY });
        const factory = new ShapeFactory();
        const result = factory.interpolate([{ x: 0, y: 0, z: 0 }], false);
        expect(result.isOk).toBe(false);
    });
});
