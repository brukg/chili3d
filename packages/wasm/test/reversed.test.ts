// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { readFileSync } from "node:fs";
import path from "node:path";
import { Plane } from "@chili3d/core";
import { initWasm, ShapeFactory } from "@chili3d/wasm";
import { describe, expect, test } from "@rstest/core";

const WASM_BINARY = readFileSync(path.join(process.cwd(), "packages/wasm/lib/chili-wasm.wasm"));

// Backs the Reverse Normal command: IShape.reversed() flips topological orientation (face normals).
describe("reversed", () => {
    test("reversing a face flips its orientation and back", async () => {
        await initWasm({ wasmBinary: WASM_BINARY });
        const factory = new ShapeFactory();
        const rect = factory.rect(Plane.XY, 10, 10);
        expect(rect.isOk).toBe(true);

        const original = rect.value.orientation();
        const flipped = rect.value.reversed();
        expect(flipped.orientation()).not.toBe(original);
        // Reversing twice returns to the original orientation.
        expect(flipped.reversed().orientation()).toBe(original);
    });
});
