// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { readFileSync } from "node:fs";
import path from "node:path";
import { type ISolid, Plane } from "@chili3d/core";
import { initWasm, ShapeFactory } from "@chili3d/wasm";
import { describe, expect, test } from "@rstest/core";

const WASM_BINARY = readFileSync(path.join(process.cwd(), "packages/wasm/lib/chili-wasm.wasm"));

// Backs the Measure Mass command: mass(g) = density(kg/m³) · volume(mm³) · 1e-6.
describe("mass from density", () => {
    test("10 mm steel cube → 7.85 g", async () => {
        await initWasm({ wasmBinary: WASM_BINARY });
        const factory = new ShapeFactory();
        const box = factory.box(Plane.XY, 10, 10, 10);
        expect(box.isOk).toBe(true);
        const volume = (box.value as ISolid).massProperties().volume; // 1000 mm³
        expect(volume).toBeCloseTo(1000, 3);
        const density = 7850; // steel, kg/m³
        const grams = (density * volume) / 1e6;
        expect(grams).toBeCloseTo(7.85, 5); // 1 cm³ of steel weighs 7.85 g
    });
});
