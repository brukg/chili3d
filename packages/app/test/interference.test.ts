// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { readFileSync } from "node:fs";
import path from "node:path";
import { Plane, XYZ } from "@chili3d/core";
import { initWasm, ShapeFactory } from "@chili3d/wasm";
import { beforeAll, describe, expect, test } from "@rstest/core";
import { checkInterference } from "../src/measure/interference";

const WASM_BINARY = readFileSync(path.join(process.cwd(), "packages/wasm/lib/chili-wasm.wasm"));

describe("checkInterference", () => {
    let factory: ShapeFactory;
    beforeAll(async () => {
        await initWasm({ wasmBinary: WASM_BINARY });
        factory = new ShapeFactory();
    });

    test("overlapping bodies interfere by their overlap volume", () => {
        const a = factory.box(Plane.XY, 10, 10, 10); // (0,0,0)-(10,10,10)
        // box B shifted +5 in x → overlap region is 5×10×10 = 500
        const b = factory.box(
            new Plane({ origin: new XYZ({ x: 5, y: 0, z: 0 }), normal: XYZ.unitZ, xvec: XYZ.unitX }),
            10,
            10,
            10,
        );
        const r = checkInterference(a.value, b.value, factory);
        expect(r.interferes).toBe(true);
        expect(r.volume).toBeCloseTo(500, 0);
    });

    test("disjoint bodies do not interfere", () => {
        const a = factory.box(Plane.XY, 10, 10, 10);
        const b = factory.box(
            new Plane({ origin: new XYZ({ x: 50, y: 0, z: 0 }), normal: XYZ.unitZ, xvec: XYZ.unitX }),
            10,
            10,
            10,
        );
        const r = checkInterference(a.value, b.value, factory);
        expect(r.interferes).toBe(false);
        expect(r.volume).toBeCloseTo(0, 6);
    });
});
