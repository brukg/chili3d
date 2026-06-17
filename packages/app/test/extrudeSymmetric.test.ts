// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { readFileSync } from "node:fs";
import path from "node:path";
import { type IApplication, Plane, setCurrentApplication } from "@chili3d/core";
import { initWasm, ShapeFactory } from "@chili3d/wasm";
import { beforeAll, describe, expect, test } from "@rstest/core";
import { TestDocument } from "../../core/test/testDocument";
import { ExtrudeNode } from "../src/bodys/extrude";

const WASM_BINARY = readFileSync(path.join(process.cwd(), "packages/wasm/lib/chili-wasm.wasm"));

describe("Symmetric extrude", () => {
    beforeAll(async () => {
        await initWasm({ wasmBinary: WASM_BINARY });
        setCurrentApplication({ shapeFactory: new ShapeFactory() } as unknown as IApplication);
    });

    test("a symmetric extrude of length 10 is centred on the profile (z spans -5..5)", () => {
        const doc = new TestDocument() as any;
        const factory = new ShapeFactory();
        const rect = factory.rect(Plane.XY, 10, 10); // a 10x10 face on z = 0
        expect(rect.isOk).toBe(true);

        const node = new ExtrudeNode({ document: doc, section: rect.value, length: 10, symmetric: true });
        const result = node.generateShape();
        expect(result.isOk).toBe(true);

        const box = result.value.boundingBox();
        // Centred: spans z = -5..5 (one-sided would be 0..10).
        expect(box.min.z).toBeCloseTo(-5, 3);
        expect(box.max.z).toBeCloseTo(5, 3);
    });

    test("a non-symmetric extrude of length 10 spans z = 0..10", () => {
        const doc = new TestDocument() as any;
        const factory = new ShapeFactory();
        const rect = factory.rect(Plane.XY, 10, 10);
        const node = new ExtrudeNode({ document: doc, section: rect.value, length: 10 });
        const box = node.generateShape().value.boundingBox();
        expect(box.min.z).toBeCloseTo(0, 3);
        expect(box.max.z).toBeCloseTo(10, 3);
    });
});
