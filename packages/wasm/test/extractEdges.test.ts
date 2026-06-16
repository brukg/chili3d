// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { readFileSync } from "node:fs";
import path from "node:path";
import { Plane, ShapeTypes } from "@chili3d/core";
import { initWasm, ShapeFactory } from "@chili3d/wasm";
import { describe, expect, test } from "@rstest/core";

const WASM_BINARY = readFileSync(path.join(process.cwd(), "packages/wasm/lib/chili-wasm.wasm"));

// Mirrors the Extract Edges command's geometry: gather a body's edges and combine them into a
// compound of reference curves.
describe("Extract Edges (headless)", () => {
    test("a box yields its 12 edges, combined into one compound", async () => {
        await initWasm({ wasmBinary: WASM_BINARY });

        const factory = new ShapeFactory();
        const box = factory.box(Plane.XY, 10, 10, 10);
        expect(box.isOk).toBe(true);

        const edges = box.value.findSubShapes(ShapeTypes.edge);
        expect(edges.length).toBe(12);

        const compound = factory.combine(edges);
        expect(compound.isOk).toBe(true);
        // The compound round-trips the same 12 edges as reusable reference geometry.
        expect(compound.value.findSubShapes(ShapeTypes.edge).length).toBe(12);
    });

    test("Extract Faces: a box yields its 6 faces, combined into one compound", async () => {
        await initWasm({ wasmBinary: WASM_BINARY });

        const factory = new ShapeFactory();
        const box = factory.box(Plane.XY, 10, 10, 10);
        const faces = box.value.findSubShapes(ShapeTypes.face);
        expect(faces.length).toBe(6);

        const compound = factory.combine(faces);
        expect(compound.isOk).toBe(true);
        expect(compound.value.findSubShapes(ShapeTypes.face).length).toBe(6);
    });
});
