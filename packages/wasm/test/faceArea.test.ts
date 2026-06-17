// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { readFileSync } from "node:fs";
import path from "node:path";
import { type IFace, Plane } from "@chili3d/core";
import { initWasm, ShapeFactory } from "@chili3d/wasm";
import { describe, expect, test } from "@rstest/core";

const WASM_BINARY = readFileSync(path.join(process.cwd(), "packages/wasm/lib/chili-wasm.wasm"));

// Backs the Measure Area command: IFace.area() returns the face's surface area.
describe("Face area", () => {
    test("a 10x10 rectangular face has area 100", async () => {
        await initWasm({ wasmBinary: WASM_BINARY });
        const factory = new ShapeFactory();
        const rect = factory.rect(Plane.XY, 10, 10);
        expect(rect.isOk).toBe(true);
        expect((rect.value as IFace).area()).toBeCloseTo(100, 3);
    });
});
