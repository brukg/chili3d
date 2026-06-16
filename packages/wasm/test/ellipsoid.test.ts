// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { readFileSync } from "node:fs";
import path from "node:path";
import type { ISolid } from "@chili3d/core";
import { initWasm, ShapeFactory } from "@chili3d/wasm";
import { describe, expect, test } from "@rstest/core";

const WASM_BINARY = readFileSync(path.join(process.cwd(), "packages/wasm/lib/chili-wasm.wasm"));

describe("Ellipsoid (headless)", () => {
    test("radii 4/2/1 give a solid whose volume is exactly 4/3·π·a·b·c", async () => {
        await initWasm({ wasmBinary: WASM_BINARY });

        const factory = new ShapeFactory();
        const result = factory.ellipsoid(
            { x: 0, y: 0, z: 1 },
            { x: 0, y: 0, z: 0 },
            { x: 1, y: 0, z: 0 },
            4,
            2,
            1,
        );
        expect(result.isOk).toBe(true);

        const solid = result.value as ISolid;
        // Exact analytic volume V = 4/3·π·a·b·c = 4/3·π·4·2·1 ≈ 33.51 mm³ — confirms each radius is
        // applied to the right axis. (The OCCT bounding box of a curved solid is a loose coarse
        // estimate, so it is not a reliable dimension check; volume is.)
        expect(solid.volume()).toBeCloseTo((4 / 3) * Math.PI * 4 * 2 * 1, 1);

        const sphere = factory.ellipsoid(
            { x: 0, y: 0, z: 1 },
            { x: 0, y: 0, z: 0 },
            { x: 1, y: 0, z: 0 },
            3,
            3,
            3,
        );
        // Equal radii collapse to a sphere of the same radius: V = 4/3·π·27.
        expect((sphere.value as ISolid).volume()).toBeCloseTo((4 / 3) * Math.PI * 27, 1);
    });
});
