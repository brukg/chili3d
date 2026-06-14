// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { readFileSync } from "node:fs";
import path from "node:path";
import {
    type IApplication,
    type ISolid,
    Line,
    Plane,
    ShapeTypes,
    setCurrentApplication,
    XYZ,
} from "@chili3d/core";
import { initWasm, ShapeFactory } from "@chili3d/wasm";
import { beforeAll, describe, expect, test } from "@rstest/core";
import { TestDocument } from "../../core/test/testDocument";
import { BoxNode } from "../src/bodys/box";
import { LinkedCircularArrayNode } from "../src/bodys/linkedCircularArray";

const WASM_BINARY = readFileSync(path.join(process.cwd(), "packages/wasm/lib/chili-wasm.wasm"));

function solidCount(node: any): number {
    const shape = node.shape;
    if (!shape?.isOk) return 0;
    return (shape.value.findSubShapes(ShapeTypes.solid) as ISolid[]).length;
}

describe("LinkedCircularArrayNode (circular pattern)", () => {
    beforeAll(async () => {
        await initWasm({ wasmBinary: WASM_BINARY });
        setCurrentApplication({ shapeFactory: new ShapeFactory() } as unknown as IApplication);
    });

    test("rotates a source into N copies and recounts when count changes", () => {
        const doc = new TestDocument() as any;
        const box = new BoxNode({ document: doc, plane: Plane.XY, dx: 5, dy: 5, dz: 5 });
        doc.modelManager.rootNode.add(box);

        const ring = new LinkedCircularArrayNode({
            document: doc,
            sourceId: box.id,
            axis: new Line({
                point: new XYZ({ x: 30, y: 0, z: 0 }),
                direction: new XYZ({ x: 0, y: 0, z: 1 }),
            }),
            count: 4,
            angle: 360,
        });
        doc.modelManager.rootNode.add(ring);

        expect(ring.shape.isOk).toBe(true);
        expect(solidCount(ring)).toBe(4); // 4 copies around the axis

        ring.count = 6;
        expect(solidCount(ring)).toBe(6);
    });
});
