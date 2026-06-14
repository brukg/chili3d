// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { readFileSync } from "node:fs";
import path from "node:path";
import { type IApplication, type ISolid, Plane, ShapeTypes, setCurrentApplication, XYZ } from "@chili3d/core";
import { initWasm, ShapeFactory } from "@chili3d/wasm";
import { beforeAll, describe, expect, test } from "@rstest/core";
import { TestDocument } from "../../core/test/testDocument";
import { BoxNode } from "../src/bodys/box";
import { LinkedArrayNode } from "../src/bodys/linkedArray";

const WASM_BINARY = readFileSync(path.join(process.cwd(), "packages/wasm/lib/chili-wasm.wasm"));

function totalVolume(node: any): number {
    const shape = node.shape;
    if (!shape?.isOk) return 0;
    return (shape.value.findSubShapes(ShapeTypes.solid) as ISolid[]).reduce((s, x) => s + x.volume(), 0);
}

describe("LinkedArrayNode (C1 one-source → many-outputs)", () => {
    beforeAll(async () => {
        await initWasm({ wasmBinary: WASM_BINARY });
        setCurrentApplication({ shapeFactory: new ShapeFactory() } as unknown as IApplication);
    });

    test("patterns a source N times and rebuilds when the source or count changes", () => {
        const doc = new TestDocument() as any;
        const box = new BoxNode({ document: doc, plane: Plane.XY, dx: 10, dy: 10, dz: 10 }); // 1000
        doc.modelManager.rootNode.add(box);

        const array = new LinkedArrayNode({
            document: doc,
            sourceId: box.id,
            count: 3,
            spacing: new XYZ({ x: 20, y: 0, z: 0 }), // far enough apart to be 3 separate solids
        });
        doc.modelManager.rootNode.add(array);

        expect(array.shape.isOk).toBe(true);
        const v1 = totalVolume(array); // 3 × 1000 = 3000
        expect(v1).toBeCloseTo(3000, 0);

        box.dx = 20; // each copy grows
        expect(totalVolume(array)).toBeGreaterThan(v1); // 3 × 2000 = 6000

        array.count = 5; // more copies
        expect(totalVolume(array)).toBeCloseTo(5 * 2000, 0);
    });
});
