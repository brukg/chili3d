// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { readFileSync } from "node:fs";
import path from "node:path";
import { Plane } from "@chili3d/core";
import { initWasm, ShapeFactory } from "@chili3d/wasm";
import { beforeAll, describe, expect, test } from "@rstest/core";
import { convexHullSTL, verticesFromBinarySTL } from "../src/urdf/stlMesh";

const WASM_BINARY = readFileSync(path.join(process.cwd(), "packages/wasm/lib/chili-wasm.wasm"));

describe("stlMesh (convex collision from tessellated STL)", () => {
    let factory: ShapeFactory;
    beforeAll(async () => {
        await initWasm({ wasmBinary: WASM_BINARY });
        factory = new ShapeFactory();
    });

    test("hull STL of a tessellated box re-parses to the box's 8 corners", () => {
        const box = factory.box(Plane.XY, 10, 20, 30).value;
        const visual = factory.converter.convertToSTL([box], { binary: true }).value;

        const hullStl = convexHullSTL(visual);
        expect(hullStl).toBeDefined();

        const verts = verticesFromBinarySTL(hullStl!);
        expect(verts.length).toBeGreaterThanOrEqual(12); // ≥4 triangles × 3

        // Every hull vertex sits on the box; the 8 corners are all present.
        const within = (v: number, lo: number, hi: number) => v >= lo - 1e-3 && v <= hi + 1e-3;
        for (const [x, y, z] of verts) {
            expect(within(x, 0, 10) && within(y, 0, 20) && within(z, 0, 30)).toBe(true);
        }
        const has = (x: number, y: number, z: number) =>
            verts.some((v) => Math.hypot(v[0] - x, v[1] - y, v[2] - z) < 1e-3);
        for (const x of [0, 10])
            for (const y of [0, 20])
                for (const z of [0, 30]) {
                    expect(has(x, y, z)).toBe(true);
                }
    });
});
