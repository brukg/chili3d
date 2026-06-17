// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { readFileSync } from "node:fs";
import path from "node:path";
import { type IEdge, type IFace, Plane, ShapeTypes } from "@chili3d/core";
import { initWasm, ShapeFactory } from "@chili3d/wasm";
import { describe, expect, test } from "@rstest/core";

const WASM_BINARY = readFileSync(path.join(process.cwd(), "packages/wasm/lib/chili-wasm.wasm"));

// Backs the Measure Perimeter command: summing a face's bounding-edge curve lengths gives the true
// boundary length — 2·(w+h) for a rectangle, 2πr for a disc.
describe("measure perimeter", () => {
    const perimeterOf = (face: IFace) =>
        (face.findSubShapes(ShapeTypes.edge) as IEdge[]).reduce((s, e) => s + e.curve.length(), 0);

    test("a 10×20 rectangular face has perimeter 60", async () => {
        await initWasm({ wasmBinary: WASM_BINARY });
        const factory = new ShapeFactory();
        const rect = factory.rect(Plane.XY, 10, 20);
        expect(perimeterOf(rect.value as IFace)).toBeCloseTo(60, 4);
    });

    test("a disc of radius 5 has perimeter 2π·5", async () => {
        await initWasm({ wasmBinary: WASM_BINARY });
        const factory = new ShapeFactory();
        const circle = factory.circle({ x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: 0 }, 5);
        const face = factory.wire([circle.value as IEdge]).value.toFace().value;
        expect(perimeterOf(face)).toBeCloseTo(2 * Math.PI * 5, 4);
    });
});
