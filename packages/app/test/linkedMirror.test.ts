// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { readFileSync } from "node:fs";
import path from "node:path";
import { type IApplication, type ISolid, Plane, ShapeTypes, setCurrentApplication } from "@chili3d/core";
import { initWasm, ShapeFactory } from "@chili3d/wasm";
import { beforeAll, describe, expect, test } from "@rstest/core";
import { TestDocument } from "../../core/test/testDocument";
import { BoxNode } from "../src/bodys/box";
import { LinkedMirrorNode } from "../src/bodys/linkedMirror";

const WASM_BINARY = readFileSync(path.join(process.cwd(), "packages/wasm/lib/chili-wasm.wasm"));

describe("LinkedMirrorNode (mirror feature)", () => {
    beforeAll(async () => {
        await initWasm({ wasmBinary: WASM_BINARY });
        setCurrentApplication({ shapeFactory: new ShapeFactory() } as unknown as IApplication);
    });

    test("reflects a source across a plane and rebuilds when the source changes", () => {
        const doc = new TestDocument() as any;
        const box = new BoxNode({ document: doc, plane: Plane.XY, dx: 10, dy: 10, dz: 10 }); // x∈[0,10]
        doc.modelManager.rootNode.add(box);

        // Mirror across the YZ plane (x = 0).
        const mirror = new LinkedMirrorNode({ document: doc, sourceId: box.id, plane: Plane.YZ });
        doc.modelManager.rootNode.add(mirror);

        expect(mirror.shape.isOk).toBe(true);
        const b1 = (mirror.shape.value as ISolid).boundingBox();
        expect(b1.min.x).toBeCloseTo(-10, 4); // reflected to x∈[-10,0]
        expect(b1.max.x).toBeCloseTo(0, 4);

        box.dx = 20; // grow the source
        const b2 = (mirror.shape.value as ISolid).boundingBox();
        expect(b2.min.x).toBeCloseTo(-20, 4); // mirror follows: x∈[-20,0]

        // Volume magnitude is preserved under reflection (the sign flips with orientation).
        expect(Math.abs((mirror.shape.value as ISolid).volume())).toBeCloseTo(20 * 10 * 10, 0);
    });
});
