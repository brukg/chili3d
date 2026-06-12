// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { readFileSync } from "node:fs";
import path from "node:path";
import type { IEdge, IFace } from "@chili3d/core";
import { initWasm, ShapeFactory } from "@chili3d/wasm";
import { describe, expect, test } from "@rstest/core";

const WASM_BINARY = readFileSync(path.join(process.cwd(), "packages/wasm/lib/chili-wasm.wasm"));

describe("Surface fill (headless)", () => {
    test("fills a face bounded by four edges forming a square", async () => {
        await initWasm({ wasmBinary: WASM_BINARY });

        const factory = new ShapeFactory();
        // a closed 10x10 square boundary in the XY plane (shared endpoints)
        const e1 = factory.line({ x: 0, y: 0, z: 0 }, { x: 10, y: 0, z: 0 });
        const e2 = factory.line({ x: 10, y: 0, z: 0 }, { x: 10, y: 10, z: 0 });
        const e3 = factory.line({ x: 10, y: 10, z: 0 }, { x: 0, y: 10, z: 0 });
        const e4 = factory.line({ x: 0, y: 10, z: 0 }, { x: 0, y: 0, z: 0 });
        for (const e of [e1, e2, e3, e4]) expect(e.isOk).toBe(true);

        const filled = factory.fillSurface([
            e1.value as IEdge,
            e2.value as IEdge,
            e3.value as IEdge,
            e4.value as IEdge,
        ]);
        expect(filled.isOk).toBe(true);
        expect((filled.value as IFace).area()).toBeGreaterThan(0);
    });
});
