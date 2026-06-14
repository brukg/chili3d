// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { readFileSync } from "node:fs";
import path from "node:path";
import {
    type IEdge,
    type IFace,
    type IShape,
    type ISolid,
    type IWire,
    Plane,
    ShapeTypes,
} from "@chili3d/core";
import { initWasm, ShapeFactory } from "@chili3d/wasm";
import { describe, expect, test } from "@rstest/core";

const WASM_BINARY = readFileSync(path.join(process.cwd(), "packages/wasm/lib/chili-wasm.wasm"));
const Z = { x: 0, y: 0, z: 1 };

describe("Pipe feature (headless)", () => {
    test("adds a protrusion along a spine, increasing volume", async () => {
        await initWasm({ wasmBinary: WASM_BINARY });
        const factory = new ShapeFactory();

        const box = factory.box(Plane.XY, 400, 250, 300); // (0,0,0)-(400,250,300)
        expect(box.isOk).toBe(true);
        const base = box.value;
        const baseVolume = (base as ISolid).volume();

        // The top face (z = 300).
        const faces = base.findSubShapes(ShapeTypes.face) as IFace[];
        const top = faces.find((f) => {
            const b = f.boundingBox();
            return Math.abs(b.min.z - 300) < 1 && Math.abs(b.max.z - 300) < 1;
        });
        expect(top).toBeDefined();

        // Circular profile face on the top, and a spine going straight up (protrusion).
        const circle = factory.circle(Z, { x: 200, y: 125, z: 300 }, 30);
        expect(circle.isOk).toBe(true);
        const profileWire = factory.wire([circle.value as IEdge]);
        const profileFace = factory.face([profileWire.value as IWire]);
        expect(profileFace.isOk).toBe(true);

        const spineEdge = factory.line({ x: 200, y: 125, z: 300 }, { x: 200, y: 125, z: 360 });
        const spine = factory.wire([spineEdge.value as IEdge]);
        expect(spine.isOk).toBe(true);

        const result = factory.pipeFeature(
            base,
            profileFace.value as IFace,
            top as IFace,
            spine.value as IWire,
            true,
        );
        expect(result.isOk).toBe(true);
        // BRepFeat_MakePipe returns a compound; sum the volume of its solids.
        const solids = result.value.findSubShapes(ShapeTypes.solid) as ISolid[];
        const totalVolume = solids.reduce((sum, s) => sum + s.volume(), 0);
        expect(totalVolume).toBeGreaterThan(baseVolume);
    });

    test("rejects non-face / non-wire inputs", async () => {
        await initWasm({ wasmBinary: WASM_BINARY });
        const factory = new ShapeFactory();
        const box = factory.box(Plane.XY, 100, 100, 100);
        const edge = factory.line({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 });
        const bad = factory.pipeFeature(
            box.value,
            edge.value as unknown as IFace,
            edge.value as unknown as IFace,
            edge.value as unknown as IWire,
            true,
        );
        expect(bad.isOk).toBe(false);
    });
});
