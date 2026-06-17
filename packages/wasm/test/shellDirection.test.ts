// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { readFileSync } from "node:fs";
import path from "node:path";
import { type IFace, type ISolid, Plane, ShapeTypes } from "@chili3d/core";
import { initWasm, ShapeFactory } from "@chili3d/wasm";
import { describe, expect, test } from "@rstest/core";

const WASM_BINARY = readFileSync(path.join(process.cwd(), "packages/wasm/lib/chili-wasm.wasm"));

// Backs the Shell direction option: a negative offset hollows inward (outer dimensions preserved); a
// positive offset thickens outward (the solid grows past its original extents).
describe("shell direction", () => {
    const topFace = (solid: ISolid) =>
        (solid.findSubShapes(ShapeTypes.face) as IFace[]).find((f) => f.normal(0, 0)[1].z > 0.99)!;

    test("inward shell preserves the outer box and removes the cavity", async () => {
        await initWasm({ wasmBinary: WASM_BINARY });
        const factory = new ShapeFactory();
        const box = factory.box(Plane.XY, 20, 20, 20);
        const shelled = factory.makeThickSolidByJoin(box.value, [topFace(box.value as ISolid)], -2);
        expect(shelled.isOk).toBe(true);
        const { min, max } = shelled.value.boundingBox();
        // Outer dimensions unchanged at 20.
        expect(max.x - min.x).toBeCloseTo(20, 3);
        // Open-top box hollowed by 2: 8000 − (16·16·18) = 3392.
        const volume = (shelled.value.findSubShapes(ShapeTypes.solid) as ISolid[]).reduce(
            (s, x) => s + x.volume(),
            0,
        );
        expect(volume).toBeCloseTo(3392, 1);
    });

    test("outward shell grows the box past 20mm", async () => {
        await initWasm({ wasmBinary: WASM_BINARY });
        const factory = new ShapeFactory();
        const box = factory.box(Plane.XY, 20, 20, 20);
        const shelled = factory.makeThickSolidByJoin(box.value, [topFace(box.value as ISolid)], 2);
        expect(shelled.isOk).toBe(true);
        const { min, max } = shelled.value.boundingBox();
        // Walls grow outward, so the footprint exceeds the original 20mm.
        expect(max.x - min.x).toBeGreaterThan(20 + 1e-3);
    });
});
