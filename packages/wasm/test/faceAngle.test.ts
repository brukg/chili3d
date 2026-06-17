// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { readFileSync } from "node:fs";
import path from "node:path";
import { type IFace, Plane, ShapeTypes } from "@chili3d/core";
import { initWasm, ShapeFactory } from "@chili3d/wasm";
import { describe, expect, test } from "@rstest/core";

const WASM_BINARY = readFileSync(path.join(process.cwd(), "packages/wasm/lib/chili-wasm.wasm"));

// Backs the Measure Face Angle command: angle between two faces = angle between their outward normals.
describe("face angle", () => {
    test("box faces are pairwise 90° (adjacent) or 180° (opposite)", async () => {
        await initWasm({ wasmBinary: WASM_BINARY });
        const factory = new ShapeFactory();
        const box = factory.box(Plane.XY, 10, 10, 10);
        expect(box.isOk).toBe(true);

        const faces = box.value.findSubShapes(ShapeTypes.face) as IFace[];
        expect(faces.length).toBe(6);

        const angles = faces
            .slice(1)
            .map((f) => (faces[0].normal(0, 0)[1].angleTo(f.normal(0, 0)[1])! * 180) / Math.PI);
        // Relative to face 0: four faces are perpendicular (90°) and exactly one is opposite (180°).
        expect(angles.filter((a) => Math.abs(a - 90) < 1e-4).length).toBe(4);
        expect(angles.filter((a) => Math.abs(a - 180) < 1e-4).length).toBe(1);
    });
});
