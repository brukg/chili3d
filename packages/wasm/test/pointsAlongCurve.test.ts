// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { readFileSync } from "node:fs";
import path from "node:path";
import type { IEdge } from "@chili3d/core";
import { initWasm, ShapeFactory } from "@chili3d/wasm";
import { describe, expect, test } from "@rstest/core";

const WASM_BINARY = readFileSync(path.join(process.cwd(), "packages/wasm/lib/chili-wasm.wasm"));

// Backs the Points Along Curve command: uniformAbscissaByCount(n) returns n+1 points equally spaced by
// arc length, including both ends.
describe("points along curve", () => {
    test("a 10mm line divided into 5 gives 6 points 2mm apart", async () => {
        await initWasm({ wasmBinary: WASM_BINARY });
        const factory = new ShapeFactory();
        const line = factory.line({ x: 0, y: 0, z: 0 }, { x: 10, y: 0, z: 0 });
        const pts = (line.value as IEdge).curve.uniformAbscissaByCount(5);
        expect(pts.length).toBe(6);
        expect(pts.map((p) => p.x)).toEqual([0, 2, 4, 6, 8, 10]);
    });

    test("a quarter circle is divided by equal arc length, not chord", async () => {
        await initWasm({ wasmBinary: WASM_BINARY });
        const factory = new ShapeFactory();
        // Quarter circle radius 10 in the XY plane, from (10,0) to (0,10).
        const arc = factory.arc({ x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: 0 }, { x: 10, y: 0, z: 0 }, 90);
        const pts = (arc.value as IEdge).curve.uniformAbscissaByCount(4);
        expect(pts.length).toBe(5);
        // Every point lies on the radius-10 circle, and they are evenly spaced in angle (22.5° steps).
        for (const p of pts) expect(Math.hypot(p.x, p.y)).toBeCloseTo(10, 5);
        const mid = pts[2]; // halfway → 45°
        expect(mid.x).toBeCloseTo(10 * Math.cos(Math.PI / 4), 4);
        expect(mid.y).toBeCloseTo(10 * Math.sin(Math.PI / 4), 4);
    });
});
