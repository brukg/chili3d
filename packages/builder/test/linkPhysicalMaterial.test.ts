// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { readFileSync } from "node:fs";
import path from "node:path";
import { EditableShapeNode, GroupNode, LinkNode, Plane } from "@chili3d/core";
import { initWasm, ShapeFactory } from "@chili3d/wasm";
import { describe, expect, test } from "@rstest/core";
import { TestDocument } from "../../core/test/testDocument";

const WASM_BINARY = readFileSync(path.join(process.cwd(), "packages/wasm/lib/chili-wasm.wasm"));

describe("physical material cascade", () => {
    test("setting a link's physical material sets its mass from density × volume", async () => {
        await initWasm({ wasmBinary: WASM_BINARY });
        const factory = new ShapeFactory();
        const doc = new TestDocument() as any;
        const link = new LinkNode({ document: doc, name: "link" });
        link.add(
            new EditableShapeNode({ document: doc, name: "g", shape: factory.box(Plane.XY, 10, 10, 10) }),
        );

        link.physicalMaterial = "steel";
        // 10×10×10 = 1000 mm³; steel 7850 kg/m³ → 7850 · 1000 · 1e-9 = 0.00785 kg
        expect(link.mass).toBeCloseTo(0.00785, 6);
        expect(link.physicalMaterial).toBe("steel");
    });

    test("a group cascades physical material to its descendant links", async () => {
        await initWasm({ wasmBinary: WASM_BINARY });
        const factory = new ShapeFactory();
        const doc = new TestDocument() as any;
        const group = new GroupNode({ document: doc, name: "g" });
        const link = new LinkNode({ document: doc, name: "link" });
        link.add(
            new EditableShapeNode({ document: doc, name: "b", shape: factory.box(Plane.XY, 20, 10, 10) }),
        );
        group.add(link);

        group.physicalMaterial = "aluminum";
        // 20×10×10 = 2000 mm³; aluminum 2700 → 2700 · 2000 · 1e-9 = 0.0054 kg
        expect(link.mass).toBeCloseTo(0.0054, 6);
    });

    test("changing physical material leaves appearance (materialId) untouched", async () => {
        await initWasm({ wasmBinary: WASM_BINARY });
        const factory = new ShapeFactory();
        const doc = new TestDocument() as any;
        const link = new LinkNode({ document: doc, name: "link" });
        const part = new EditableShapeNode({
            document: doc,
            name: "g",
            shape: factory.box(Plane.XY, 10, 10, 10),
        });
        link.add(part);
        const beforeAppearance = part.materialId;

        link.physicalMaterial = "steel";
        expect(part.materialId).toBe(beforeAppearance); // physical axis never repaints
    });
});
