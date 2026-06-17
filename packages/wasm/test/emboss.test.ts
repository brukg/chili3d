// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { readFileSync } from "node:fs";
import path from "node:path";
import { type IEdge, type ISolid, Plane, ShapeTypes, XYZ } from "@chili3d/core";
import { initWasm, ShapeFactory } from "@chili3d/wasm";
import { describe, expect, test } from "@rstest/core";

const WASM_BINARY = readFileSync(path.join(process.cwd(), "packages/wasm/lib/chili-wasm.wasm"));

// Backs the Emboss command: a profile prism fused/cut onto a body changes its volume by area·depth.
describe("emboss", () => {
    const volumeOf = (shape: ISolid) =>
        (shape.findSubShapes(ShapeTypes.solid) as ISolid[]).reduce((s, x) => s + x.volume(), 0);

    const setup = async () => {
        await initWasm({ wasmBinary: WASM_BINARY });
        const factory = new ShapeFactory();
        const box = factory.box(Plane.XY, 20, 20, 20);
        const circle = factory.circle({ x: 0, y: 0, z: 1 }, { x: 10, y: 10, z: 20 }, 3);
        const profile = factory.wire([circle.value as IEdge]).value.toFace().value;
        return { factory, box, profile };
    };

    test("engrave cuts a r=3 pocket 5 deep (−π·9·5)", async () => {
        const { factory, box, profile } = await setup();
        const tool = factory.prism(profile, new XYZ({ x: 0, y: 0, z: -5 })); // into the body
        const result = factory.booleanCut([box.value], [tool.value]);
        expect(volumeOf(result.value as ISolid)).toBeCloseTo(8000 - Math.PI * 9 * 5, 1);
    });

    test("raise fuses a r=3 boss 5 tall (+π·9·5)", async () => {
        const { factory, box, profile } = await setup();
        const tool = factory.prism(profile, new XYZ({ x: 0, y: 0, z: 5 })); // outward
        const result = factory.booleanFuse([box.value], [tool.value], true);
        expect(volumeOf(result.value as ISolid)).toBeCloseTo(8000 + Math.PI * 9 * 5, 1);
    });
});
