// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { readFileSync } from "node:fs";
import path from "node:path";
import type { IEdge } from "@chili3d/core";
import { initWasm, ShapeFactory } from "@chili3d/wasm";
import { describe, expect, test } from "@rstest/core";

const WASM_BINARY = readFileSync(path.join(process.cwd(), "packages/wasm/lib/chili-wasm.wasm"));

// Backs the Helix curve: arc length = turns · sqrt(circumference² + pitch²).
describe("helix curve", () => {
    test("a radius-10, pitch-5, height-20 helix has the analytic length", async () => {
        await initWasm({ wasmBinary: WASM_BINARY });
        const factory = new ShapeFactory();
        const helix = factory.helix({ x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: 0 }, 10, 5, 20, false);
        expect(helix.isOk).toBe(true);

        const turns = 20 / 5; // height / pitch
        const expected = turns * Math.hypot(2 * Math.PI * 10, 5);
        expect((helix.value as IEdge).curve.length()).toBeCloseTo(expected, 2);
    });

    test("invalid (non-positive) parameters fail cleanly", async () => {
        await initWasm({ wasmBinary: WASM_BINARY });
        const factory = new ShapeFactory();
        expect(factory.helix({ x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: 0 }, 0, 5, 20, false).isOk).toBe(false);
    });
});
