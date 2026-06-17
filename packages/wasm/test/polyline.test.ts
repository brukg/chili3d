// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { readFileSync } from "node:fs";
import path from "node:path";
import { type IEdge, ShapeTypes, XYZ } from "@chili3d/core";
import { initWasm, ShapeFactory } from "@chili3d/wasm";
import { describe, expect, test } from "@rstest/core";

const WASM_BINARY = readFileSync(path.join(process.cwd(), "packages/wasm/lib/chili-wasm.wasm"));

// Backs the Polyline command: connected line segments between the picked points form a single wire.
describe("polyline", () => {
    const wireOf = (factory: ShapeFactory, pts: XYZ[], closed: boolean) => {
        const edges: IEdge[] = [];
        const segments = closed ? pts.length : pts.length - 1;
        for (let i = 0; i < segments; i++) {
            const seg = factory.line(pts[i], pts[(i + 1) % pts.length]);
            if (seg.isOk) edges.push(seg.value);
        }
        return factory.wire(edges);
    };

    test("an open 3-point polyline is a wire of 2 edges, length 15", async () => {
        await initWasm({ wasmBinary: WASM_BINARY });
        const factory = new ShapeFactory();
        const pts = [
            new XYZ({ x: 0, y: 0, z: 0 }),
            new XYZ({ x: 10, y: 0, z: 0 }),
            new XYZ({ x: 10, y: 5, z: 0 }),
        ];
        const wire = wireOf(factory, pts, false);
        expect(wire.isOk).toBe(true);
        const edges = wire.value.findSubShapes(ShapeTypes.edge) as IEdge[];
        expect(edges.length).toBe(2);
        expect(edges.reduce((s, e) => s + e.curve.length(), 0)).toBeCloseTo(15, 5);
    });

    test("closing the polyline adds the segment back to the start (3 edges)", async () => {
        await initWasm({ wasmBinary: WASM_BINARY });
        const factory = new ShapeFactory();
        const pts = [
            new XYZ({ x: 0, y: 0, z: 0 }),
            new XYZ({ x: 6, y: 0, z: 0 }),
            new XYZ({ x: 0, y: 8, z: 0 }),
        ];
        const wire = wireOf(factory, pts, true);
        expect(wire.isOk).toBe(true);
        const edges = wire.value.findSubShapes(ShapeTypes.edge) as IEdge[];
        expect(edges.length).toBe(3);
        // 6 + 8 + 10 (the 6-8-10 closing hypotenuse) = 24.
        expect(edges.reduce((s, e) => s + e.curve.length(), 0)).toBeCloseTo(24, 5);
    });
});
