// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { readFileSync } from "node:fs";
import path from "node:path";
import {
    type IApplication,
    type ISolid,
    ParameterStore,
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

// A square whose side is driven by an expression (e.g. a parameter name).
const squareSide = (side: string): SketchConstraint[] => [
    { type: "fixed", point: 0, x: 0, y: 0 },
    { type: "horizontal", a: 0, b: 1 },
    { type: "distance", a: 0, b: 1, d: side },
    { type: "vertical", a: 0, b: 3 },
    { type: "distance", a: 0, b: 3, d: side },
    { type: "horizontal", a: 3, b: 2 },
    { type: "vertical", a: 1, b: 2 },
];

function solidVolume(node: any): number {
    const shape = node.shape;
    if (!shape?.isOk) return 0;
    return (shape.value.findSubShapes(ShapeTypes.solid) as ISolid[]).reduce((s, x) => s + x.volume(), 0);
}

describe("Parametric sketch (C3 → C4 → C1 full chain)", () => {
    beforeAll(async () => {
        await initWasm({ wasmBinary: WASM_BINARY });
        setCurrentApplication({ shapeFactory: new ShapeFactory() } as unknown as IApplication);
    });

    test("a named parameter drives a sketch dimension through to the extruded solid", () => {
        const doc = new TestDocument() as any;
        const store = new ParameterStore(doc);
        store.set("side", "10");

        const sketch = new SketchNode({
            document: doc,
            plane: Plane.XY,
            points: [
                { x: 0, y: 0 },
                { x: 9, y: 1 },
                { x: 8, y: 11 },
                { x: 1, y: 9 },
            ],
            constraints: squareSide("side"), // the side length is the parameter "side"
        });
        doc.modelManager.rootNode.add(sketch);

        const extrude = new LinkedExtrudeNode({
            document: doc,
            profileId: sketch.id,
            direction: new XYZ({ x: 0, y: 0, z: 1 }),
            distance: 5,
        });
        doc.modelManager.rootNode.add(extrude);

        const v1 = solidVolume(extrude); // 10 × 10 × 5 = 500
        expect(v1).toBeCloseTo(500, 0);

        store.set("side", "20"); // changing the PARAMETER must flow: param → sketch → solid
        const v2 = solidVolume(extrude); // 20 × 20 × 5 = 2000
        expect(v2).toBeCloseTo(2000, 0);

        store.set("side", "10 + 5"); // an expression, not just a literal
        const v3 = solidVolume(extrude); // 15 × 15 × 5 = 1125
        expect(v3).toBeCloseTo(1125, 0);
    });
});
