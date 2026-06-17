// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { readFileSync } from "node:fs";
import path from "node:path";
import type { IEdge } from "@chili3d/core";
import { initWasm, ShapeFactory } from "@chili3d/wasm";
import { describe, expect, test } from "@rstest/core";

const WASM_BINARY = readFileSync(path.join(process.cwd(), "packages/wasm/lib/chili-wasm.wasm"));

// Backs the Measure Edge Angle command: acute angle = acos(|d1·d2|) of the edge tangent directions.
describe("edge angle", () => {
    const dir = (e: IEdge) => e.curve.d1(e.curve.firstParameter()).vec.normalize()!;
    const angle = (a: IEdge, b: IEdge) =>
        (Math.acos(Math.min(1, Math.abs(dir(a).dot(dir(b))))) * 180) / Math.PI;

    test("perpendicular and 45° line edges", async () => {
        await initWasm({ wasmBinary: WASM_BINARY });
        const f = new ShapeFactory();
        const x = f.line({ x: 0, y: 0, z: 0 }, { x: 10, y: 0, z: 0 });
        const y = f.line({ x: 0, y: 0, z: 0 }, { x: 0, y: 10, z: 0 });
        const diag = f.line({ x: 0, y: 0, z: 0 }, { x: 5, y: 5, z: 0 });
        expect(x.isOk && y.isOk && diag.isOk).toBe(true);

        expect(angle(x.value as IEdge, y.value as IEdge)).toBeCloseTo(90, 4);
        expect(angle(x.value as IEdge, diag.value as IEdge)).toBeCloseTo(45, 4);
        // A reversed edge gives the same acute angle (orientation-independent).
        const xrev = f.line({ x: 10, y: 0, z: 0 }, { x: 0, y: 0, z: 0 });
        expect(angle(xrev.value as IEdge, diag.value as IEdge)).toBeCloseTo(45, 4);
    });
});
