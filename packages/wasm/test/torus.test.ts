// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { readFileSync } from "node:fs";
import path from "node:path";
import type { ISolid } from "@chili3d/core";
import { initWasm, ShapeFactory } from "@chili3d/wasm";
import { describe, expect, test } from "@rstest/core";

const WASM_BINARY = readFileSync(path.join(process.cwd(), "packages/wasm/lib/chili-wasm.wasm"));

describe("Torus (headless)", () => {
    test("ring radius 10, tube radius 2 → volume 2·π²·R·r²", async () => {
        await initWasm({ wasmBinary: WASM_BINARY });

        const factory = new ShapeFactory();
        const result = factory.torus({ x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: 0 }, 10, 2);
        expect(result.isOk).toBe(true);

        // Exact analytic volume of a torus V = 2·π²·R·r² = 2·π²·10·4 ≈ 789.6 mm³.
        const expected = 2 * Math.PI * Math.PI * 10 * 2 * 2;
        expect((result.value as ISolid).volume()).toBeCloseTo(expected, 1);
    });
});
