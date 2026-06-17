// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { readFileSync } from "node:fs";
import path from "node:path";
import { type IFace, ShapeTypes } from "@chili3d/core";
import { initWasm, ShapeFactory } from "@chili3d/wasm";
import { describe, expect, test } from "@rstest/core";

const WASM_BINARY = readFileSync(path.join(process.cwd(), "packages/wasm/lib/chili-wasm.wasm"));

// Backs the Ruled Surface command: a ruled loft (isRuled, not solid) between two parallel segments is
// a flat strip whose area is length × gap.
describe("ruled surface", () => {
    test("between two parallel 10mm segments 5mm apart → 50 mm² strip", async () => {
        await initWasm({ wasmBinary: WASM_BINARY });
        const factory = new ShapeFactory();
        const l1 = factory.line({ x: 0, y: 0, z: 0 }, { x: 10, y: 0, z: 0 });
        const l2 = factory.line({ x: 0, y: 0, z: 5 }, { x: 10, y: 0, z: 5 });
        expect(l1.isOk && l2.isOk).toBe(true);

        const surface = factory.loft([l1.value, l2.value], false, true, "c0");
        expect(surface.isOk).toBe(true);
        const area = (surface.value.findSubShapes(ShapeTypes.face) as IFace[]).reduce(
            (sum, f) => sum + f.area(),
            0,
        );
        expect(area).toBeCloseTo(50, 1);
    });
});
