// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { readFileSync } from "node:fs";
import path from "node:path";
import { type IFace, Plane, ShapeTypes } from "@chili3d/core";
import { initWasm, ShapeFactory } from "@chili3d/wasm";
import { describe, expect, test } from "@rstest/core";

const WASM_BINARY = readFileSync(path.join(process.cwd(), "packages/wasm/lib/chili-wasm.wasm"));

// Backs the Axis Normal to Face command: recover surface parameters at a picked point, then read the
// true normal there. Validates the parameter→normal round-trip on a box face.
describe("axis normal to face", () => {
    test("normal recovered from a picked point matches the face normal", async () => {
        await initWasm({ wasmBinary: WASM_BINARY });
        const factory = new ShapeFactory();
        const box = factory.box(Plane.XY, 10, 10, 10);
        expect(box.isOk).toBe(true);
        const face = (box.value.findSubShapes(ShapeTypes.face) as IFace[])[0];

        const [point, reference] = face.normal(0, 0);
        const uv = face.surface().parameter(point, 1e-3);
        expect(uv).toBeDefined();
        const [, normal] = face.normal(uv!.u, uv!.v);
        // Same face point ⇒ same normal direction.
        expect(normal.x).toBeCloseTo(reference.x, 5);
        expect(normal.y).toBeCloseTo(reference.y, 5);
        expect(normal.z).toBeCloseTo(reference.z, 5);
        // And it is a unit axis-aligned direction (box face).
        expect(Math.hypot(normal.x, normal.y, normal.z)).toBeCloseTo(1, 5);
    });
});
