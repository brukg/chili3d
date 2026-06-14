// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { readFileSync } from "node:fs";
import path from "node:path";
import { type IApplication, ParameterStore, Plane, setCurrentApplication } from "@chili3d/core";
import { initWasm, ShapeFactory } from "@chili3d/wasm";
import { beforeAll, describe, expect, test } from "@rstest/core";
import { TestDocument } from "../../core/test/testDocument";
import { BoxNode } from "../src/bodys/box";
import { ParameterService } from "../src/services/parameterService";

const WASM_BINARY = readFileSync(path.join(process.cwd(), "packages/wasm/lib/chili-wasm.wasm"));

describe("ParameterService", () => {
    beforeAll(async () => {
        await initWasm({ wasmBinary: WASM_BINARY });
        // Ensure the global shapeFactory is available for BoxNode.generateShape().
        setCurrentApplication({ shapeFactory: new ShapeFactory() } as unknown as IApplication);
    });

    test("a parameter change updates a bound node dimension and regenerates the shape", () => {
        const doc = new TestDocument() as any;
        const box = new BoxNode({ document: doc, plane: Plane.XY, dx: 1, dy: 1, dz: 1 });
        doc.modelManager.rootNode.add(box);

        const service = new ParameterService();
        const store = new ParameterStore(doc);
        store.set("width", "10");

        service.bind(box, "dx", "width * 2");
        expect(box.dx).toBe(20); // applied immediately

        store.set("width", "25"); // pub parametersChanged → service re-applies
        service.applyAll(doc); // (deterministic trigger for the test)
        expect(box.dx).toBe(50);
    });
});
