// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { readFileSync } from "node:fs";
import path from "node:path";
import type { IEdge } from "@chili3d/core";
import { initWasm, ShapeFactory } from "@chili3d/wasm";
import { describe, expect, test } from "@rstest/core";

const WASM_BINARY = readFileSync(path.join(process.cwd(), "packages/wasm/lib/chili-wasm.wasm"));

// Backs Measure Arc Angle: a circle is parametrized by angle, so the arc's sweep is its parameter span.
describe("arc angle", () => {
    const sweepDeg = (e: IEdge) => ((e.curve.lastParameter() - e.curve.firstParameter()) * 180) / Math.PI;

    test("a 90° and a 135° arc report their sweep angle", async () => {
        await initWasm({ wasmBinary: WASM_BINARY });
        const factory = new ShapeFactory();
        const quarter = factory.arc({ x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: 0 }, { x: 10, y: 0, z: 0 }, 90);
        const wide = factory.arc({ x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: 0 }, { x: 10, y: 0, z: 0 }, 135);
        expect(quarter.isOk && wide.isOk).toBe(true);
        expect(sweepDeg(quarter.value as IEdge)).toBeCloseTo(90, 3);
        expect(sweepDeg(wide.value as IEdge)).toBeCloseTo(135, 3);
    });
});
