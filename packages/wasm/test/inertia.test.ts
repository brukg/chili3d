// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { readFileSync } from "node:fs";
import path from "node:path";
import { type ISolid, Plane } from "@chili3d/core";
import { initWasm, ShapeFactory } from "@chili3d/wasm";
import { describe, expect, test } from "@rstest/core";

const WASM_BINARY = readFileSync(path.join(process.cwd(), "packages/wasm/lib/chili-wasm.wasm"));

// Backs the Moments of Inertia measure: for a cube of side s and unit density the inertia about the
// centre of mass is isotropic — Ixx = Iyy = Izz = V·(s²+s²)/12 = m·s²/6 — and all products vanish.
describe("measure moments of inertia", () => {
    test("a 20mm cube has equal diagonal moments m·s²/6 and zero products", async () => {
        await initWasm({ wasmBinary: WASM_BINARY });
        const factory = new ShapeFactory();
        const cube = factory.box(Plane.XY, 20, 20, 20);
        const m = (cube.value as ISolid).massProperties();

        const expected = (8000 * (20 ** 2 + 20 ** 2)) / 12; // 533333.33
        expect(m.momentOfInertia.x).toBeCloseTo(expected, 1);
        expect(m.momentOfInertia.y).toBeCloseTo(expected, 1);
        expect(m.momentOfInertia.z).toBeCloseTo(expected, 1);
        // Isotropy: every diagonal entry is the same for a cube.
        expect(m.momentOfInertia.x).toBeCloseTo(m.momentOfInertia.z, 1);
        expect(m.productOfInertia.x).toBeCloseTo(0, 4);
        expect(m.productOfInertia.y).toBeCloseTo(0, 4);
        expect(m.productOfInertia.z).toBeCloseTo(0, 4);
    });
});
