// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { readFileSync } from "node:fs";
import path from "node:path";
import { CurveUtils, type IEdge, type ITrimmedCurve, Plane, ShapeTypes, XYZ } from "@chili3d/core";
import { initWasm, ShapeFactory } from "@chili3d/wasm";
import { describe, expect, test } from "@rstest/core";

const WASM_BINARY = readFileSync(path.join(process.cwd(), "packages/wasm/lib/chili-wasm.wasm"));

// Backs the Project to Plane command: a curve projected orthographically onto a plane along its normal.
describe("project to plane", () => {
    test("a circle 5mm above XY projects to a same-radius circle on XY", async () => {
        await initWasm({ wasmBinary: WASM_BINARY });
        const factory = new ShapeFactory();
        const circle = factory.circle({ x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: 5 }, 3);
        const face = factory.rect(
            new Plane({ origin: new XYZ({ x: -50, y: -50, z: 0 }), normal: XYZ.unitZ, xvec: XYZ.unitX }),
            100,
            100,
        );
        const projected = factory.curveProjection(
            circle.value as IEdge,
            face.value,
            new XYZ({ x: 0, y: 0, z: -1 }),
        );
        expect(projected.isOk).toBe(true);

        const edge = (projected.value.findSubShapes(ShapeTypes.edge) as IEdge[])[0];
        const c = edge.curve;
        const basis = CurveUtils.isCircle(c) ? c : (c as ITrimmedCurve).basisCurve;
        expect(CurveUtils.isCircle(basis)).toBe(true);
        if (CurveUtils.isCircle(basis)) {
            expect(basis.radius).toBeCloseTo(3, 4); // radius preserved
            expect(basis.center.z).toBeCloseTo(0, 4); // now on the XY plane
        }
    });
});
