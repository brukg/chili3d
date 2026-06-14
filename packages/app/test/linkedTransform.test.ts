// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { readFileSync } from "node:fs";
import path from "node:path";
import { type IApplication, type ISolid, Matrix4, Plane, setCurrentApplication } from "@chili3d/core";
import { initWasm, ShapeFactory } from "@chili3d/wasm";
import { beforeAll, describe, expect, test } from "@rstest/core";
import { TestDocument } from "../../core/test/testDocument";
import { BoxNode } from "../src/bodys/box";
import { LinkedTransformNode } from "../src/bodys/linkedTransform";

const WASM_BINARY = readFileSync(path.join(process.cwd(), "packages/wasm/lib/chili-wasm.wasm"));

describe("LinkedTransformNode (C1 referential generalisation)", () => {
    beforeAll(async () => {
        await initWasm({ wasmBinary: WASM_BINARY });
        setCurrentApplication({ shapeFactory: new ShapeFactory() } as unknown as IApplication);
    });

    test("a transformed copy is offset from its source and rebuilds when the source changes", () => {
        const doc = new TestDocument() as any;
        const box = new BoxNode({ document: doc, plane: Plane.XY, dx: 10, dy: 10, dz: 10 });
        doc.modelManager.rootNode.add(box);

        const copy = new LinkedTransformNode({
            document: doc,
            sourceId: box.id,
            appliedTransform: Matrix4.fromTranslation(50, 0, 0),
        });
        doc.modelManager.rootNode.add(copy);

        expect(copy.shape.isOk).toBe(true);
        const copyBox = (copy.shape.value as ISolid).boundingBox();
        // The copy sits at x ∈ [50, 60] (source [0,10] translated +50).
        expect(copyBox.min.x).toBeCloseTo(50, 4);
        expect(copyBox.max.x).toBeCloseTo(60, 4);
        const beforeVolume = (copy.shape.value as ISolid).volume();

        // Edit the source: the copy must rebuild bigger.
        box.dx = 30;
        const after = copy.shape.value as ISolid;
        expect(after.volume()).toBeGreaterThan(beforeVolume);
        expect(after.boundingBox().max.x).toBeCloseTo(80, 4); // [0,30] + 50
    });
});
