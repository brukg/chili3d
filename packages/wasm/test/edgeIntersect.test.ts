// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { readFileSync } from "node:fs";
import path from "node:path";
import type { IEdge } from "@chili3d/core";
import { initWasm, ShapeFactory } from "@chili3d/wasm";
import { describe, expect, test } from "@rstest/core";

const WASM_BINARY = readFileSync(path.join(process.cwd(), "packages/wasm/lib/chili-wasm.wasm"));

// Backs the Point-at-Intersection command: IEdge.intersect finds where two edges cross.
describe("Edge intersection", () => {
    test("an X of two lines through the origin intersects at (0,0,0)", async () => {
        await initWasm({ wasmBinary: WASM_BINARY });

        const factory = new ShapeFactory();
        const a = factory.line({ x: -5, y: -5, z: 0 }, { x: 5, y: 5, z: 0 });
        const b = factory.line({ x: -5, y: 5, z: 0 }, { x: 5, y: -5, z: 0 });
        const hits = (a.value as IEdge).intersect(b.value as IEdge);
        expect(hits.length).toBe(1);
        expect(hits[0].point.x).toBeCloseTo(0, 6);
        expect(hits[0].point.y).toBeCloseTo(0, 6);
        expect(hits[0].point.z).toBeCloseTo(0, 6);
    });
});
