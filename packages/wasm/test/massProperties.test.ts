// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { readFileSync } from "node:fs";
import path from "node:path";
import { type ISolid, Plane } from "@chili3d/core";
import { initWasm, ShapeFactory } from "@chili3d/wasm";
import { describe, expect, test } from "@rstest/core";

const WASM_BINARY = readFileSync(path.join(process.cwd(), "packages/wasm/lib/chili-wasm.wasm"));

describe("Solid.massProperties (measure)", () => {
    test("reports volume, area, centre of mass and inertia of a box", async () => {
        await initWasm({ wasmBinary: WASM_BINARY });
        const factory = new ShapeFactory();
        const box = factory.box(Plane.XY, 10, 20, 30); // (0,0,0)-(10,20,30)
        expect(box.isOk).toBe(true);

        const m = (box.value as ISolid).massProperties();
        expect(m.volume).toBeCloseTo(6000, 2); // 10·20·30
        expect(m.area).toBeCloseTo(2 * (10 * 20 + 20 * 30 + 10 * 30), 2); // 2200
        expect(m.centerOfMass.x).toBeCloseTo(5, 6);
        expect(m.centerOfMass.y).toBeCloseTo(10, 6);
        expect(m.centerOfMass.z).toBeCloseTo(15, 6);
        // Inertia about the centre of mass is positive on every axis.
        expect(m.momentOfInertia.x).toBeGreaterThan(0);
        expect(m.momentOfInertia.y).toBeGreaterThan(0);
        expect(m.momentOfInertia.z).toBeGreaterThan(0);
    });
});
