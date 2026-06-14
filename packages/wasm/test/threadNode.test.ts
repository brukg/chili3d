// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { readFileSync } from "node:fs";
import path from "node:path";
import { ThreadNode } from "@chili3d/app";
import { type IApplication, type IDocument, type ISolid, setCurrentApplication, XYZ } from "@chili3d/core";
import { initWasm, ShapeFactory } from "@chili3d/wasm";
import { beforeAll, describe, expect, test } from "@rstest/core";

const WASM_BINARY = readFileSync(path.join(process.cwd(), "packages/wasm/lib/chili-wasm.wasm"));

// Minimal document stub: ThreadNode's base constructor only reads
// document.modelManager.materials.at(0) and stores the reference;
// generateShape() never touches the document.
const document = {
    modelManager: { materials: { at: () => undefined } },
} as unknown as IDocument;

describe("ThreadNode (body node)", () => {
    beforeAll(async () => {
        await initWasm({ wasmBinary: WASM_BINARY });
        // generateShape() reaches for the global `shapeFactory`, which is the
        // current application's factory. Wire a minimal app exposing the real one.
        setCurrentApplication({ shapeFactory: new ShapeFactory() } as unknown as IApplication);
    });

    test("generateShape builds a valid solid coil with positive volume", () => {
        const node = new ThreadNode({
            document,
            normal: XYZ.unitZ,
            center: XYZ.zero,
            radius: 10,
            pitch: 4,
            height: 20,
            profileRadius: 1,
            leftHanded: false,
        });

        const result = node.generateShape();
        expect(result.isOk).toBe(true);
        expect((result.value as ISolid).volume()).toBeGreaterThan(0);
    });
});
