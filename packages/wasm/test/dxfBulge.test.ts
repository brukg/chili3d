// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { readFileSync } from "node:fs";
import path from "node:path";
import { computeArcFromPoints } from "@chili3d/app";
import { CurveUtils, type IEdge, type ITrimmedCurve, XYZ } from "@chili3d/core";
import { initWasm, ShapeFactory } from "@chili3d/wasm";
import { describe, expect, test } from "@rstest/core";

const WASM_BINARY = readFileSync(path.join(process.cwd(), "packages/wasm/lib/chili-wasm.wasm"));

// Validates the DXF LWPOLYLINE bulge path: a bulge of 1 over the chord (0,0)→(10,0) is a semicircle
// of radius 5 (apex at (5,5)), built from apex → computeArcFromPoints → shapeFactory.arc.
describe("DXF bulge arc", () => {
    test("bulge 1 builds a radius-5 semicircle (arc length π·5)", async () => {
        await initWasm({ wasmBinary: WASM_BINARY });

        const factory = new ShapeFactory();
        const a = new XYZ({ x: 0, y: 0, z: 0 });
        const apex = new XYZ({ x: 5, y: 5, z: 0 }); // midpoint + left-normal · (bulge·chord/2)
        const b = new XYZ({ x: 10, y: 0, z: 0 });

        const params = computeArcFromPoints(a, apex, b);
        expect(params).toBeDefined();
        const arc = factory.arc(params!.normal, params!.center, params!.start, params!.angle);
        expect(arc.isOk).toBe(true);

        const curve = (arc.value as IEdge).curve;
        const basis = CurveUtils.isCircle(curve) ? curve : (curve as ITrimmedCurve).basisCurve;
        expect(CurveUtils.isCircle(basis) ? basis.radius : 0).toBeCloseTo(5, 4);
        // Semicircle arc length = π·r = π·5 ≈ 15.708.
        expect(curve.length()).toBeCloseTo(Math.PI * 5, 3);
    });
});
