// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { readFileSync } from "node:fs";
import path from "node:path";
import { CurveUtils, type IEdge, type ITrimmedCurve } from "@chili3d/core";
import { initWasm, ShapeFactory } from "@chili3d/wasm";
import { describe, expect, test } from "@rstest/core";

const WASM_BINARY = readFileSync(path.join(process.cwd(), "packages/wasm/lib/chili-wasm.wasm"));

// Mirrors the Point-at-Center command: recover a circular edge's centre from its (basis) curve.
describe("Edge centre (circular edge)", () => {
    test("a circle centred at (3,4,0) reports centre (3,4,0)", async () => {
        await initWasm({ wasmBinary: WASM_BINARY });

        const factory = new ShapeFactory();
        const circle = factory.circle({ x: 0, y: 0, z: 1 }, { x: 3, y: 4, z: 0 }, 5);
        expect(circle.isOk).toBe(true);

        const curve = (circle.value as IEdge).curve;
        const basis = CurveUtils.isCircle(curve) ? curve : (curve as ITrimmedCurve).basisCurve;
        expect(CurveUtils.isCircle(basis)).toBe(true);
        const center = CurveUtils.isCircle(basis) ? basis.center : undefined;
        expect(center!.x).toBeCloseTo(3, 6);
        expect(center!.y).toBeCloseTo(4, 6);
        expect(center!.z).toBeCloseTo(0, 6);
    });
});
