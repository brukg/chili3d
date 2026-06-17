// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { readFileSync } from "node:fs";
import path from "node:path";
import { computeArcFromPoints, filletCorner } from "@chili3d/app";
import { CurveUtils, type IEdge, type ITrimmedCurve, XYZ } from "@chili3d/core";
import { initWasm, ShapeFactory } from "@chili3d/wasm";
import { describe, expect, test } from "@rstest/core";

const WASM_BINARY = readFileSync(path.join(process.cwd(), "packages/wasm/lib/chili-wasm.wasm"));

// Backs the Sketch Fillet command: the corner fillet (filletCorner → computeArcFromPoints → arc) is a
// tangent arc of the requested radius.
describe("sketch fillet", () => {
    test("a 90° corner filleted with radius 2 yields a radius-2 arc", async () => {
        await initWasm({ wasmBinary: WASM_BINARY });
        const factory = new ShapeFactory();
        const f = filletCorner(XYZ.zero, new XYZ({ x: 10, y: 0, z: 0 }), new XYZ({ x: 0, y: 10, z: 0 }), 2)!;
        const p = computeArcFromPoints(f.t1, f.mid, f.t2)!;
        const arc = factory.arc(p.normal, p.center, p.start, p.angle);
        expect(arc.isOk).toBe(true);

        const curve = (arc.value as IEdge).curve;
        const basis = CurveUtils.isCircle(curve) ? curve : (curve as ITrimmedCurve).basisCurve;
        expect(CurveUtils.isCircle(basis) ? basis.radius : 0).toBeCloseTo(2, 5);
        // A quarter-turn fillet arc has length (π/2)·r = π.
        expect(curve.length()).toBeCloseTo(Math.PI, 3);
    });
});
