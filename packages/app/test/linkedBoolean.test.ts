// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { readFileSync } from "node:fs";
import path from "node:path";
import {
    type IApplication,
    type INode,
    type ISolid,
    Plane,
    ShapeTypes,
    setCurrentApplication,
} from "@chili3d/core";
import { initWasm, ShapeFactory } from "@chili3d/wasm";
import { beforeAll, describe, expect, test } from "@rstest/core";
import { TestDocument } from "../../core/test/testDocument";
import { BoxNode } from "../src/bodys/box";
import { LinkedBooleanNode } from "../src/bodys/linkedBoolean";

const WASM_BINARY = readFileSync(path.join(process.cwd(), "packages/wasm/lib/chili-wasm.wasm"));

function totalVolume(node: INode): number {
    const shape = (node as any).shape;
    if (!shape?.isOk) return 0;
    const solids = shape.value.findSubShapes(ShapeTypes.solid) as ISolid[];
    return solids.reduce((sum, s) => sum + s.volume(), 0);
}

describe("ReferenceShapeNode / LinkedBooleanNode (C1 rebuild)", () => {
    beforeAll(async () => {
        await initWasm({ wasmBinary: WASM_BINARY });
        setCurrentApplication({ shapeFactory: new ShapeFactory() } as unknown as IApplication);
    });

    test("editing an upstream input rebuilds the dependent feature", () => {
        const doc = new TestDocument() as any;
        const boxA = new BoxNode({ document: doc, plane: Plane.XY, dx: 20, dy: 20, dz: 20 });
        const boxB = new BoxNode({ document: doc, plane: Plane.XY, dx: 10, dy: 10, dz: 10 });
        doc.modelManager.rootNode.add(boxA, boxB);

        const linked = new LinkedBooleanNode({
            document: doc,
            inputIds: [boxA.id, boxB.id],
            booleanType: "fuse",
        });
        doc.modelManager.rootNode.add(linked);

        expect(linked.shape.isOk).toBe(true);
        const before = totalVolume(linked);
        expect(before).toBeGreaterThan(0);

        // Edit the upstream box. The dependent must rebuild WITHOUT us calling generateShape.
        boxA.dx = 40;
        const after = totalVolume(linked);
        expect(after).toBeGreaterThan(before); // the fused result grew with its input
    });

    test("a chained dependent rebuilds transitively", () => {
        const doc = new TestDocument() as any;
        const boxA = new BoxNode({ document: doc, plane: Plane.XY, dx: 20, dy: 20, dz: 20 });
        const boxB = new BoxNode({ document: doc, plane: Plane.XY, dx: 10, dy: 10, dz: 10 });
        const boxC = new BoxNode({ document: doc, plane: Plane.XY, dx: 5, dy: 5, dz: 5 });
        doc.modelManager.rootNode.add(boxA, boxB, boxC);

        const first = new LinkedBooleanNode({
            document: doc,
            inputIds: [boxA.id, boxB.id],
            booleanType: "fuse",
        });
        doc.modelManager.rootNode.add(first);
        const second = new LinkedBooleanNode({
            document: doc,
            inputIds: [first.id, boxC.id],
            booleanType: "fuse",
        });
        doc.modelManager.rootNode.add(second);

        expect(second.shape.isOk).toBe(true);
        const before = totalVolume(second);
        boxA.dx = 40; // A → first → second, two hops
        const after = totalVolume(second);
        expect(after).toBeGreaterThan(before);
    });
});
