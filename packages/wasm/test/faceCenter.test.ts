// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { readFileSync } from "node:fs";
import path from "node:path";
import { type IFace, Plane, ShapeTypes } from "@chili3d/core";
import { initWasm, ShapeFactory } from "@chili3d/wasm";
import { describe, expect, test } from "@rstest/core";

const WASM_BINARY = readFileSync(path.join(process.cwd(), "packages/wasm/lib/chili-wasm.wasm"));

// Backs the Point at Face Center command: the face's oriented-bounding-box centre is the centroid for a
// planar face and the mid-axis point for a curved face.
describe("face center", () => {
    test("a planar 10×20 rect (corner at origin) centres at (5,10,0)", async () => {
        await initWasm({ wasmBinary: WASM_BINARY });
        const factory = new ShapeFactory();
        const rect = factory.rect(Plane.XY, 10, 20);
        const c = rect.value.orientedBoundingBox().center.location;
        expect(c.x).toBeCloseTo(5, 4);
        expect(c.y).toBeCloseTo(10, 4);
        expect(c.z).toBeCloseTo(0, 4);
    });

    test("a cylinder's side face centres on the axis at mid-height", async () => {
        await initWasm({ wasmBinary: WASM_BINARY });
        const factory = new ShapeFactory();
        const cyl = factory.cylinder({ x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: 0 }, 5, 20);
        // The lateral face: a face that is not planar (the curved side).
        const side = (cyl.value.findSubShapes(ShapeTypes.face) as IFace[]).find(
            (f) => !f.surface().isPlanar(),
        );
        expect(side).toBeDefined();
        const c = side!.orientedBoundingBox().center.location;
        // On the axis (x = y = 0) at mid-height (z = 10).
        expect(c.x).toBeCloseTo(0, 4);
        expect(c.y).toBeCloseTo(0, 4);
        expect(c.z).toBeCloseTo(10, 4);
    });
});
