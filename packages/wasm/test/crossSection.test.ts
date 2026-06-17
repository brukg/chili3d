// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { readFileSync } from "node:fs";
import path from "node:path";
import { type IEdge, type IFace, Plane, ShapeTypes, XYZ } from "@chili3d/core";
import { initWasm, ShapeFactory } from "@chili3d/wasm";
import { describe, expect, test } from "@rstest/core";

const WASM_BINARY = readFileSync(path.join(process.cwd(), "packages/wasm/lib/chili-wasm.wasm"));

// Backs the Cross Section command: cut a solid by a plane (section → edges), assemble the edges into a
// wire and cap it into a face — the filled cross-section.
describe("cross section", () => {
    test("a 20mm cube cut through its centre is a 20×20 (400 mm²) face", async () => {
        await initWasm({ wasmBinary: WASM_BINARY });
        const factory = new ShapeFactory();
        const box = factory.box(Plane.XY, 20, 20, 20);
        const plane = new Plane({
            origin: new XYZ({ x: 10, y: 10, z: 10 }),
            normal: XYZ.unitZ,
            xvec: XYZ.unitX,
        });

        const edges = box.value.section(plane).findSubShapes(ShapeTypes.edge) as IEdge[];
        expect(edges.length).toBe(4); // the square outline of the cut
        const wire = factory.wire(edges);
        expect(wire.isOk).toBe(true);
        const face = wire.value.toFace();
        expect(face.isOk).toBe(true);
        const area = (face.value.findSubShapes(ShapeTypes.face) as IFace[]).reduce((s, f) => s + f.area(), 0);
        expect(area).toBeCloseTo(400, 3);
    });
});
