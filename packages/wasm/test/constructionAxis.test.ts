// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { readFileSync } from "node:fs";
import path from "node:path";
import { CurveUtils, type ICircle, type IEdge, type ITrimmedCurve } from "@chili3d/core";
import { initWasm, ShapeFactory } from "@chili3d/wasm";
import { describe, expect, test } from "@rstest/core";

const WASM_BINARY = readFileSync(path.join(process.cwd(), "packages/wasm/lib/chili-wasm.wasm"));

// Backs the Construction Axis command: a circle edge exposes centre + axis, from which the axis line
// (centre ± axis·2r) is built.
describe("construction axis", () => {
    test("circle edge yields centre, axis and radius", async () => {
        await initWasm({ wasmBinary: WASM_BINARY });
        const factory = new ShapeFactory();
        const circle = factory.circle({ x: 0, y: 0, z: 1 }, { x: 2, y: 3, z: 4 }, 5);
        expect(circle.isOk).toBe(true);

        // A circle edge's curve is a trimmed curve over a circular basis, so resolve it the same way
        // the command's asCircle() does: direct circle, else the basis curve.
        const curve = (circle.value as IEdge).curve;
        const c: ICircle | undefined = CurveUtils.isCircle(curve)
            ? curve
            : CurveUtils.isCircle((curve as ITrimmedCurve).basisCurve)
              ? ((curve as ITrimmedCurve).basisCurve as ICircle)
              : undefined;
        expect(c).toBeDefined();
        expect(c!.radius).toBeCloseTo(5, 5);
        expect([c!.center.x, c!.center.y, c!.center.z]).toEqual([2, 3, 4]);
        // The circle was defined with a +Z normal, so its axis is ±Z.
        expect(Math.abs(c!.axis.z)).toBeCloseTo(1, 5);
        expect(c!.axis.x).toBeCloseTo(0, 5);
        expect(c!.axis.y).toBeCloseTo(0, 5);
    });
});
