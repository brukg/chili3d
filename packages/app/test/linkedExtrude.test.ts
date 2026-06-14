// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { readFileSync } from "node:fs";
import path from "node:path";
import {
    EditableShapeNode,
    type IApplication,
    type ISolid,
    Plane,
    ShapeTypes,
    type SketchConstraint,
    setCurrentApplication,
    XYZ,
} from "@chili3d/core";
import { initWasm, ShapeFactory } from "@chili3d/wasm";
import { beforeAll, describe, expect, test } from "@rstest/core";
import { TestDocument } from "../../core/test/testDocument";
import { LinkedExtrudeNode } from "../src/bodys/linkedExtrude";
import { SketchNode } from "../src/bodys/sketchNode";

const WASM_BINARY = readFileSync(path.join(process.cwd(), "packages/wasm/lib/chili-wasm.wasm"));

const squareConstraints = (w: number, h: number): SketchConstraint[] => [
    { type: "fixed", point: 0, x: 0, y: 0 },
    { type: "horizontal", a: 0, b: 1 },
    { type: "distance", a: 0, b: 1, d: w },
    { type: "vertical", a: 0, b: 3 },
    { type: "distance", a: 0, b: 3, d: h },
    { type: "horizontal", a: 3, b: 2 },
    { type: "vertical", a: 1, b: 2 },
];

function solidVolume(node: any): number {
    const shape = node.shape;
    if (!shape?.isOk) return 0;
    return (shape.value.findSubShapes(ShapeTypes.solid) as ISolid[]).reduce((s, x) => s + x.volume(), 0);
}

describe("LinkedExtrudeNode (C4 → C1 parametric chain)", () => {
    let factory: ShapeFactory;
    beforeAll(async () => {
        await initWasm({ wasmBinary: WASM_BINARY });
        factory = new ShapeFactory();
        setCurrentApplication({ shapeFactory: factory } as unknown as IApplication);
    });

    const square = (): XYZ[] =>
        [
            [0, 0],
            [10, 0],
            [10, 10],
            [0, 10],
            [0, 0],
        ].map(([x, y]) => new XYZ({ x, y, z: 0 }));

    test("extrudes a FACE profile to a solid (regression: no TopoDS_Wire binding crash)", () => {
        const doc = new TestDocument() as any;
        const faceShape = factory.face([factory.polygon(square()).value]).value;
        const faceNode = new EditableShapeNode({ document: doc, name: "face", shape: faceShape });
        doc.modelManager.rootNode.add(faceNode);

        const extrude = new LinkedExtrudeNode({
            document: doc,
            profileId: faceNode.id,
            direction: new XYZ({ x: 0, y: 0, z: 1 }),
            distance: 5,
        });
        doc.modelManager.rootNode.add(extrude);

        expect(extrude.shape.isOk).toBe(true);
        expect(solidVolume(extrude)).toBeCloseTo(500, 0); // 10 × 10 × 5
    });

    test("a non-extrudable profile (a solid) fails gracefully instead of crashing", () => {
        const doc = new TestDocument() as any;
        const boxNode = new EditableShapeNode({
            document: doc,
            name: "box",
            shape: factory.box(Plane.XY, 10, 10, 10).value,
        });
        doc.modelManager.rootNode.add(boxNode);

        const extrude = new LinkedExtrudeNode({
            document: doc,
            profileId: boxNode.id,
            direction: new XYZ({ x: 0, y: 0, z: 1 }),
            distance: 5,
        });
        doc.modelManager.rootNode.add(extrude);

        // The OCC binding used to throw here; it must now be a clean error Result.
        expect(extrude.shape.isOk).toBe(false);
    });

    test("a constrained sketch extrudes to a solid that rebuilds when a constraint changes", () => {
        const doc = new TestDocument() as any;
        const sketch = new SketchNode({
            document: doc,
            plane: Plane.XY,
            points: [
                { x: 0, y: 0 },
                { x: 9, y: 1 },
                { x: 8, y: 11 },
                { x: 1, y: 9 },
            ],
            constraints: squareConstraints(10, 10),
        });
        doc.modelManager.rootNode.add(sketch);

        const extrude = new LinkedExtrudeNode({
            document: doc,
            profileId: sketch.id,
            direction: new XYZ({ x: 0, y: 0, z: 1 }),
            distance: 5,
        });
        doc.modelManager.rootNode.add(extrude);

        expect(extrude.shape.isOk).toBe(true);
        const v1 = solidVolume(extrude); // 10 × 10 × 5 = 500
        expect(v1).toBeCloseTo(500, 0);

        // Edit a sketch dimension constraint: the solid must rebuild through the whole chain.
        sketch.constraints = squareConstraints(20, 10);
        const v2 = solidVolume(extrude); // 20 × 10 × 5 = 1000
        expect(v2).toBeCloseTo(1000, 0);
    });
});
