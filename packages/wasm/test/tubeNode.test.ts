// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { readFileSync } from "node:fs";
import path from "node:path";
import { TubeNode } from "@chili3d/app";
import {
    type IApplication,
    type IDocument,
    type ISolid,
    ShapeTypes,
    setCurrentApplication,
    XYZ,
} from "@chili3d/core";
import { initWasm, ShapeFactory } from "@chili3d/wasm";
import { beforeAll, describe, expect, test } from "@rstest/core";

const WASM_BINARY = readFileSync(path.join(process.cwd(), "packages/wasm/lib/chili-wasm.wasm"));

const document = {
    modelManager: { materials: { at: () => undefined } },
} as unknown as IDocument;

function volume(shape: ISolid | { findSubShapes: (t: number) => ISolid[] }): number {
    const solids = (shape as ISolid).findSubShapes(ShapeTypes.solid) as ISolid[];
    return solids.reduce((sum, s) => sum + s.volume(), 0);
}

describe("TubeNode (body node)", () => {
    beforeAll(async () => {
        await initWasm({ wasmBinary: WASM_BINARY });
        setCurrentApplication({ shapeFactory: new ShapeFactory() } as unknown as IApplication);
    });

    test("annular volume = π·(R² − r²)·h", () => {
        const node = new TubeNode({
            document,
            normal: XYZ.unitZ,
            center: XYZ.zero,
            radius: 10,
            innerRadius: 6,
            dz: 20,
        });
        const result = node.generateShape();
        expect(result.isOk).toBe(true);
        const expected = Math.PI * (10 * 10 - 6 * 6) * 20;
        expect(volume(result.value as ISolid)).toBeCloseTo(expected, 1);
    });

    test("a non-positive bore degrades to a solid cylinder", () => {
        const node = new TubeNode({
            document,
            normal: XYZ.unitZ,
            center: XYZ.zero,
            radius: 10,
            innerRadius: 0,
            dz: 20,
        });
        const result = node.generateShape();
        expect(result.isOk).toBe(true);
        expect((result.value as ISolid).volume()).toBeCloseTo(Math.PI * 100 * 20, 1);
    });
});
