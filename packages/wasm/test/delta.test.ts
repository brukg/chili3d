// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { readFileSync } from "node:fs";
import path from "node:path";
import type { IVertex } from "@chili3d/core";
import { initWasm, ShapeFactory } from "@chili3d/wasm";
import { describe, expect, test } from "@rstest/core";

const WASM_BINARY = readFileSync(path.join(process.cwd(), "packages/wasm/lib/chili-wasm.wasm"));

// Backs the Measure Delta command: the signed component deltas and straight-line distance between two
// vertex points. A 3-4-5 right triangle gives Δ = (3,4,0) and distance 5.
describe("measure delta", () => {
    test("reports signed ΔX/ΔY/ΔZ and the straight-line distance between two vertices", async () => {
        await initWasm({ wasmBinary: WASM_BINARY });
        const factory = new ShapeFactory();
        const a = (factory.point({ x: 1, y: 2, z: 0 }).value as IVertex).point();
        const b = (factory.point({ x: 4, y: 6, z: 0 }).value as IVertex).point();

        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dz = b.z - a.z;
        expect([dx, dy, dz]).toEqual([3, 4, 0]);
        expect(Math.hypot(dx, dy, dz)).toBeCloseTo(5, 6);
    });
});
