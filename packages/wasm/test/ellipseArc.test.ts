// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { readFileSync } from "node:fs";
import path from "node:path";
import type { IEdge } from "@chili3d/core";
import { initWasm, ShapeFactory } from "@chili3d/wasm";
import { describe, expect, test } from "@rstest/core";

const WASM_BINARY = readFileSync(path.join(process.cwd(), "packages/wasm/lib/chili-wasm.wasm"));

// Backs the Elliptical Arc command: the arc runs between two eccentric angles, where angle θ maps to
// (major·cosθ) along the x axis and (minor·sinθ) along the y axis.
describe("elliptical arc", () => {
    test("a quarter arc (0 → π/2) runs from the major vertex to the minor vertex", async () => {
        await initWasm({ wasmBinary: WASM_BINARY });
        const factory = new ShapeFactory();
        const arc = factory.ellipseArc(
            { x: 0, y: 0, z: 1 },
            { x: 0, y: 0, z: 0 },
            { x: 1, y: 0, z: 0 },
            10,
            5,
            0,
            Math.PI / 2,
        );
        expect(arc.isOk).toBe(true);
        const curve = (arc.value as IEdge).curve;

        const start = curve.value(curve.firstParameter());
        const end = curve.value(curve.lastParameter());
        expect([start.x, start.y, start.z]).toEqual([10, 0, 0]); // major vertex
        expect(end.x).toBeCloseTo(0, 6);
        expect(end.y).toBeCloseTo(5, 6); // minor vertex
        // The point at θ = π/4 is (10·cos45°, 5·sin45°).
        const mid = curve.value(Math.PI / 4);
        expect(mid.x).toBeCloseTo(10 * Math.cos(Math.PI / 4), 5);
        expect(mid.y).toBeCloseTo(5 * Math.sin(Math.PI / 4), 5);
    });
});
