// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { readFileSync } from "node:fs";
import path from "node:path";
import { type IApplication, type ISolid, Plane, ShapeTypes, setCurrentApplication, XYZ } from "@chili3d/core";
import { initWasm, ShapeFactory } from "@chili3d/wasm";
import { beforeAll, describe, expect, test } from "@rstest/core";
import { TestDocument } from "../../core/test/testDocument";
import { FuseNode } from "../src/bodys/fuse";

const WASM_BINARY = readFileSync(path.join(process.cwd(), "packages/wasm/lib/chili-wasm.wasm"));

function solidVolume(node: any): number {
    const shape = node.shape;
    if (!shape?.isOk) return 0;
    return (shape.value.findSubShapes(ShapeTypes.solid) as ISolid[]).reduce((s, x) => s + x.volume(), 0);
}

describe("FuseNode", () => {
    let factory: ShapeFactory;
    beforeAll(async () => {
        await initWasm({ wasmBinary: WASM_BINARY });
        factory = new ShapeFactory();
        setCurrentApplication({ shapeFactory: factory } as unknown as IApplication);
    });

    test("fuses two overlapping boxes into a single solid (regression: was 'not implemented')", () => {
        const doc = new TestDocument() as any;
        // Two 10³ boxes overlapping by a 10×10×5 slab → union volume = 1000 + 1000 − 500 = 1500.
        const bottom = factory.box(Plane.XY, 10, 10, 10).value;
        const top = factory.box(Plane.XY.translateTo(new XYZ({ x: 0, y: 0, z: 5 })), 10, 10, 10).value;

        const fuse = new FuseNode({ document: doc, bottom, top });
        doc.modelManager.rootNode.add(fuse);

        expect(fuse.shape.isOk).toBe(true);
        expect(solidVolume(fuse)).toBeCloseTo(1500, 0);
    });
});
