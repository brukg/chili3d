// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { readFileSync } from "node:fs";
import path from "node:path";
import { Plane, XYZ } from "@chili3d/core";
import { initWasm, ShapeFactory } from "@chili3d/wasm";
import { describe, expect, test } from "@rstest/core";

const WASM_BINARY = readFileSync(path.join(process.cwd(), "packages/wasm/lib/chili-wasm.wasm"));

// Backs the Measure Distance command: IShape.extremaDistance reports the minimum gap between two shapes.
describe("extremaDistance", () => {
    test("two points (3-4-5 triangle) → distance 5", async () => {
        await initWasm({ wasmBinary: WASM_BINARY });
        const factory = new ShapeFactory();
        const a = factory.point(new XYZ({ x: 0, y: 0, z: 0 }));
        const b = factory.point(new XYZ({ x: 3, y: 4, z: 0 }));
        expect(a.isOk && b.isOk).toBe(true);
        expect(a.value.extremaDistance(b.value)).toBeCloseTo(5, 5);
    });

    test("box face to an external point → perpendicular gap", async () => {
        await initWasm({ wasmBinary: WASM_BINARY });
        const factory = new ShapeFactory();
        const box = factory.box(Plane.XY, 10, 10, 10); // [0..10]^3
        const p = factory.point(new XYZ({ x: 15, y: 5, z: 5 }));
        expect(box.isOk && p.isOk).toBe(true);
        // Nearest box face is x = 10, so the gap is 15 - 10 = 5.
        expect(box.value.extremaDistance(p.value)).toBeCloseTo(5, 5);
    });
});
