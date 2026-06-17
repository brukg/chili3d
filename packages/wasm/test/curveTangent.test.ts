// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { readFileSync } from "node:fs";
import path from "node:path";
import { type IEdge, XYZ } from "@chili3d/core";
import { initWasm, ShapeFactory } from "@chili3d/wasm";
import { describe, expect, test } from "@rstest/core";

const WASM_BINARY = readFileSync(path.join(process.cwd(), "packages/wasm/lib/chili-wasm.wasm"));

// Backs the "Plane Normal to Curve" command: the plane normal is the curve tangent (curve.d1.vec) at
// the picked point.
describe("curve tangent (d1)", () => {
    test("a line's tangent is its direction", async () => {
        await initWasm({ wasmBinary: WASM_BINARY });
        const factory = new ShapeFactory();
        const line = factory.line({ x: 0, y: 0, z: 0 }, { x: 10, y: 0, z: 0 });
        expect(line.isOk).toBe(true);
        const curve = (line.value as IEdge).curve;
        const u = curve.parameter(new XYZ({ x: 5, y: 0, z: 0 }), 1e-3)!;
        const t = curve.d1(u).vec.normalize()!;
        expect(Math.abs(t.x)).toBeCloseTo(1, 6);
        expect(t.y).toBeCloseTo(0, 6);
        expect(t.z).toBeCloseTo(0, 6);
    });

    test("a circle's tangent is perpendicular to its radius and in-plane", async () => {
        await initWasm({ wasmBinary: WASM_BINARY });
        const factory = new ShapeFactory();
        const circle = factory.circle({ x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: 0 }, 5);
        expect(circle.isOk).toBe(true);
        const curve = (circle.value as IEdge).curve;
        // At the point (5,0,0) the radius points along +X, so the tangent is ±Y and has no Z.
        const u = curve.parameter(new XYZ({ x: 5, y: 0, z: 0 }), 1e-3)!;
        const t = curve.d1(u).vec.normalize()!;
        expect(t.x).toBeCloseTo(0, 5);
        expect(Math.abs(t.y)).toBeCloseTo(1, 5);
        expect(t.z).toBeCloseTo(0, 5);
    });
});
