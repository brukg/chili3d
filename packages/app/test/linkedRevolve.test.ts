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
import { LinkedRevolveNode } from "../src/bodys/linkedRevolve";
import { RectNode } from "../src/bodys/rect";

const WASM_BINARY = readFileSync(path.join(process.cwd(), "packages/wasm/lib/chili-wasm.wasm"));

function solidVolume(node: any): number {
    const shape = node.shape;
    if (!shape?.isOk) return 0;
    const value = shape.value;
    if (value.shapeType === ShapeTypes.solid) return (value as ISolid).volume();
    return (value.findSubShapes(ShapeTypes.solid) as ISolid[]).reduce((s, x) => s + x.volume(), 0);
}

describe("LinkedRevolveNode (C1 referential revolve)", () => {
    beforeAll(async () => {
        await initWasm({ wasmBinary: WASM_BINARY });
        setCurrentApplication({ shapeFactory: new ShapeFactory() } as unknown as IApplication);
    });

    test("revolves a profile into a solid that rebuilds when the profile changes", () => {
        const doc = new TestDocument() as any;
        const rect = new RectNode({ document: doc, plane: Plane.XY, dx: 5, dy: 3 }); // face x∈[0,5], y∈[0,3]
        doc.modelManager.rootNode.add(rect);

        // Revolve about a Y axis offset to x = -2, so the profile (x ∈ [0,5]) sweeps an annular
        // tube (inner r=2, outer r=7) — a clean closed solid.
        const revolve = new LinkedRevolveNode({
            document: doc,
            profileId: rect.id,
            axis: new Line({
                point: new XYZ({ x: -2, y: 0, z: 0 }),
                direction: new XYZ({ x: 0, y: 1, z: 0 }),
            }),
            angle: 360,
        });
        doc.modelManager.rootNode.add(revolve);

        expect(revolve.shape.isOk).toBe(true);
        const v1 = solidVolume(revolve); // π(7²−2²)·3 = π·45·3 ≈ 424
        expect(v1).toBeGreaterThan(300);

        rect.dx = 10; // widen the profile → bigger outer radius (x ∈ [0,10] → r ∈ [2,12])
        const v2 = solidVolume(revolve); // π(12²−2²)·3 = π·140·3 ≈ 1319
        expect(v2).toBeGreaterThan(v1 * 2); // grew substantially
    });
});
