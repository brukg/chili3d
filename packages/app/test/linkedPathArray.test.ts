// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { readFileSync } from "node:fs";
import path from "node:path";
import {
    EditableShapeNode,
    type IApplication,
    type IEdge,
    type ISolid,
    Plane,
    ShapeTypes,
    setCurrentApplication,
} from "@chili3d/core";
import { initWasm, ShapeFactory } from "@chili3d/wasm";
import { beforeAll, describe, expect, test } from "@rstest/core";
import { TestDocument } from "../../core/test/testDocument";
import { BoxNode } from "../src/bodys/box";
import { LinkedPathArrayNode } from "../src/bodys/linkedPathArray";

const WASM_BINARY = readFileSync(path.join(process.cwd(), "packages/wasm/lib/chili-wasm.wasm"));

describe("LinkedPathArrayNode (path pattern)", () => {
    let factory: ShapeFactory;
    beforeAll(async () => {
        await initWasm({ wasmBinary: WASM_BINARY });
        factory = new ShapeFactory();
        setCurrentApplication({ shapeFactory: factory } as unknown as IApplication);
    });

    function solidCount(node: any): number {
        const shape = node.shape;
        if (!shape?.isOk) return 0;
        return (shape.value.findSubShapes(ShapeTypes.solid) as ISolid[]).length;
    }

    test("places N copies along a path edge and recounts when count changes", () => {
        const doc = new TestDocument() as any;
        const box = new BoxNode({ document: doc, plane: Plane.XY, dx: 5, dy: 5, dz: 5 });
        doc.modelManager.rootNode.add(box);

        const lineEdge = factory.line({ x: 0, y: 0, z: 0 }, { x: 100, y: 0, z: 0 });
        const pathNode = new EditableShapeNode({
            document: doc,
            name: "path",
            shape: lineEdge.value as IEdge,
        });
        doc.modelManager.rootNode.add(pathNode);

        const array = new LinkedPathArrayNode({
            document: doc,
            sourceId: box.id,
            pathId: pathNode.id,
            count: 4,
        });
        doc.modelManager.rootNode.add(array);

        expect(array.shape.isOk).toBe(true);
        expect(solidCount(array)).toBe(4);

        array.count = 7;
        expect(solidCount(array)).toBe(7);
    });
});
