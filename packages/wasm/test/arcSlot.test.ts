// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { readFileSync } from "node:fs";
import path from "node:path";
import { curvedSlotEdges } from "@chili3d/app";
import { type IApplication, type IFace, ShapeTypes, setCurrentApplication, XYZ } from "@chili3d/core";
import { initWasm, ShapeFactory } from "@chili3d/wasm";
import { beforeAll, describe, expect, test } from "@rstest/core";

const WASM_BINARY = readFileSync(path.join(process.cwd(), "packages/wasm/lib/chili-wasm.wasm"));

// Backs the Arc Slot command: a curved slot of half-width r around a centre arc (radius R, sweep θ) has
// area 2·R·r·θ + π·r² (annular sector + two semicircular caps).
describe("arc slot", () => {
    beforeAll(async () => {
        await initWasm({ wasmBinary: WASM_BINARY });
        setCurrentApplication({ shapeFactory: new ShapeFactory() } as unknown as IApplication);
    });

    test("a semicircular centre arc (R=10, θ=π) with r=2 → area 44π", () => {
        const factory = new ShapeFactory();
        const edges = curvedSlotEdges(
            new XYZ({ x: 10, y: 0, z: 0 }),
            new XYZ({ x: 0, y: 10, z: 0 }),
            new XYZ({ x: -10, y: 0, z: 0 }),
            2,
        )!;
        expect(edges.length).toBe(4);
        const face = factory.wire(edges).value.toFace();
        expect(face.isOk).toBe(true);
        const area = (face.value.findSubShapes(ShapeTypes.face) as IFace[]).reduce((s, f) => s + f.area(), 0);
        expect(area).toBeCloseTo(2 * 10 * 2 * Math.PI + Math.PI * 4, 1); // 44π ≈ 138.23
    });
});
