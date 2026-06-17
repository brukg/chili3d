// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { readFileSync } from "node:fs";
import path from "node:path";
import { type IShape, type ISolid, Plane, ShapeTypes } from "@chili3d/core";
import { initWasm, ShapeFactory } from "@chili3d/wasm";
import { describe, expect, test } from "@rstest/core";

const WASM_BINARY = readFileSync(path.join(process.cwd(), "packages/wasm/lib/chili-wasm.wasm"));

// Backs the Heal Body command: ShapeFix repairs defects while preserving valid geometry — healing a
// clean solid leaves it valid and volume-unchanged (the repair is idempotent on well-formed input).
describe("fixShape (heal body)", () => {
    const volumeOf = (shape: IShape) =>
        (shape.findSubShapes(ShapeTypes.solid) as ISolid[]).reduce((s, x) => s + x.volume(), 0);

    test("healing a valid box keeps it valid and preserves its volume", async () => {
        await initWasm({ wasmBinary: WASM_BINARY });
        const factory = new ShapeFactory();
        const box = factory.box(Plane.XY, 10, 20, 30);
        const healed = factory.fixShape(box.value);

        expect(healed.isOk).toBe(true);
        expect(healed.value.isValid()).toBe(true);
        expect(volumeOf(healed.value)).toBeCloseTo(6000, 2);
    });
});
