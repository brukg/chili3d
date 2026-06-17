// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { readFileSync } from "node:fs";
import path from "node:path";
import { type ISolid, type ISubEdgeShape, Plane, ShapeTypes } from "@chili3d/core";
import { initWasm, ShapeFactory } from "@chili3d/wasm";
import { describe, expect, test } from "@rstest/core";

const WASM_BINARY = readFileSync(path.join(process.cwd(), "packages/wasm/lib/chili-wasm.wasm"));

// Backs the Fillet All Edges command: filleting every edge of a box (where three fillets meet at each
// corner) must produce a valid solid.
describe("Fillet all edges (headless)", () => {
    test("filleting all 12 edges of a 20mm cube yields a valid, smaller solid", async () => {
        await initWasm({ wasmBinary: WASM_BINARY });

        const factory = new ShapeFactory();
        const box = factory.box(Plane.XY, 20, 20, 20);
        const edges = box.value.findSubShapes(ShapeTypes.edge).map((e) => (e as ISubEdgeShape).index);
        expect(edges.length).toBe(12);

        const filleted = factory.fillet(box.value, edges, 2);
        expect(filleted.isOk).toBe(true);
        const solids = filleted.value.findSubShapes(ShapeTypes.solid) as ISolid[];
        const vol = solids.reduce((s, x) => s + x.volume(), 0);
        // Rounding the convex edges removes material: 0 < volume < 8000.
        expect(vol).toBeGreaterThan(0);
        expect(vol).toBeLessThan(8000);
    });
});
