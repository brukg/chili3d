// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { readFileSync } from "node:fs";
import path from "node:path";
import { type IFace, type ISolid, Plane } from "@chili3d/core";
import { initWasm, ShapeFactory } from "@chili3d/wasm";
import { describe, expect, test } from "@rstest/core";

const WASM_BINARY = readFileSync(path.join(process.cwd(), "packages/wasm/lib/chili-wasm.wasm"));

describe("Thicken (makeThickSolidBySimple, headless)", () => {
    test("thickens a 10x10 face by 2 into a ~200 mm³ slab solid", async () => {
        await initWasm({ wasmBinary: WASM_BINARY });

        const factory = new ShapeFactory();
        const rect = factory.rect(Plane.XY, 10, 10);
        expect(rect.isOk).toBe(true);
        expect((rect.value as IFace).area()).toBeCloseTo(100, 3);

        const thick = factory.makeThickSolidBySimple(rect.value, 2);
        expect(thick.isOk).toBe(true);
        // A 10×10 face offset by 2 → a 10×10×2 slab = 200 mm³ (volume is signed by face orientation).
        expect(Math.abs((thick.value as ISolid).volume())).toBeCloseTo(200, 1);
    });
});
