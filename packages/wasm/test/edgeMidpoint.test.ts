// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { readFileSync } from "node:fs";
import path from "node:path";
import type { IEdge } from "@chili3d/core";
import { initWasm, ShapeFactory } from "@chili3d/wasm";
import { describe, expect, test } from "@rstest/core";

const WASM_BINARY = readFileSync(path.join(process.cwd(), "packages/wasm/lib/chili-wasm.wasm"));

// Mirrors the Point-at-Midpoint command's geometry: the curve's mid-parameter value is the true
// midpoint of the edge.
describe("Edge midpoint (curve mid-parameter)", () => {
    test("the midpoint of a line from (0,0,0) to (10,0,4) is (5,0,2)", async () => {
        await initWasm({ wasmBinary: WASM_BINARY });

        const factory = new ShapeFactory();
        const line = factory.line({ x: 0, y: 0, z: 0 }, { x: 10, y: 0, z: 4 });
        expect(line.isOk).toBe(true);

        const curve = (line.value as IEdge).curve;
        const mid = curve.value((curve.firstParameter() + curve.lastParameter()) / 2);
        expect(mid.x).toBeCloseTo(5, 6);
        expect(mid.y).toBeCloseTo(0, 6);
        expect(mid.z).toBeCloseTo(2, 6);
        // curve.length() (used by Measure Edge Length) = |(10,0,4)| = √116 ≈ 10.7703.
        expect(curve.length()).toBeCloseTo(Math.sqrt(116), 4);
    });
});
