// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { readFileSync } from "node:fs";
import path from "node:path";
import { Matrix4, Plane, XYZ } from "@chili3d/core";
import { initWasm, ShapeFactory } from "@chili3d/wasm";
import { describe, expect, test } from "@rstest/core";

const WASM_BINARY = readFileSync(path.join(process.cwd(), "packages/wasm/lib/chili-wasm.wasm"));

// Backs the Oriented Bounding Box command: Bnd_OBB returns the tightest box (centre Ax3 + half-extents),
// which stays tight even when the part is rotated — unlike the axis-aligned box.
describe("orientedBoundingBox", () => {
    test("a 10x20x30 box has half-extents 5/10/15", async () => {
        await initWasm({ wasmBinary: WASM_BINARY });
        const factory = new ShapeFactory();
        const box = factory.box(Plane.XY, 10, 20, 30);
        expect(box.isOk).toBe(true);
        const { size } = box.value.orientedBoundingBox();
        const sorted = [size.x, size.y, size.z].sort((a, b) => a - b);
        expect(sorted[0]).toBeCloseTo(5, 4);
        expect(sorted[1]).toBeCloseTo(10, 4);
        expect(sorted[2]).toBeCloseTo(15, 4);
    });

    test("the oriented box stays tight (volume 6000) when the part is rotated", async () => {
        await initWasm({ wasmBinary: WASM_BINARY });
        const factory = new ShapeFactory();
        const box = factory.box(Plane.XY, 10, 20, 30);
        const rotated = box.value.transformed(Matrix4.fromAxisRad(XYZ.zero, XYZ.unitZ, Math.PI / 5));
        const { size } = rotated.orientedBoundingBox();
        // Full extents = 2×half; volume of the tight box equals the part's 10·20·30.
        expect(8 * size.x * size.y * size.z).toBeCloseTo(6000, 0);
    });

    // Backs the Measure Oriented Bounding Box readout: 2×half-extents, sorted, recover the true sides.
    test("a rotated box's measured side lengths sort to 30 / 20 / 10", async () => {
        await initWasm({ wasmBinary: WASM_BINARY });
        const factory = new ShapeFactory();
        const box = factory.box(Plane.XY, 10, 20, 30);
        const rotated = box.value.transformed(Matrix4.fromAxisRad(XYZ.zero, XYZ.unitZ, (40 * Math.PI) / 180));
        const { size } = rotated.orientedBoundingBox();
        const dims = [size.x, size.y, size.z].map((h) => 2 * h).sort((a, b) => b - a);
        expect(dims[0]).toBeCloseTo(30, 4);
        expect(dims[1]).toBeCloseTo(20, 4);
        expect(dims[2]).toBeCloseTo(10, 4);
    });
});
