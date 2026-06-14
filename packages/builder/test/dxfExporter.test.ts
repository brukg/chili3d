// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { readFileSync } from "node:fs";
import path from "node:path";
import type { IEdge } from "@chili3d/core";
import { initWasm, ShapeFactory } from "@chili3d/wasm";
import { describe, expect, test } from "@rstest/core";
import { exportDxf } from "../src/dxf/dxfExporter";

const WASM_BINARY = readFileSync(path.join(process.cwd(), "packages/wasm/lib/chili-wasm.wasm"));
const Z = { x: 0, y: 0, z: 1 };

describe("exportDxf", () => {
    test("emits LINE and CIRCLE entities with correct coordinates", async () => {
        await initWasm({ wasmBinary: WASM_BINARY });
        const factory = new ShapeFactory();

        const line = factory.line({ x: 0, y: 0, z: 0 }, { x: 10, y: 5, z: 0 });
        const circle = factory.circle(Z, { x: 2, y: 3, z: 0 }, 4);
        expect(line.isOk).toBe(true);
        expect(circle.isOk).toBe(true);

        const dxf = exportDxf([line.value as IEdge, circle.value as IEdge]);

        // Valid DXF skeleton.
        expect(dxf).toContain("SECTION");
        expect(dxf).toContain("ENTITIES");
        expect(dxf.trimEnd().endsWith("EOF")).toBe(true);

        // LINE with both endpoints (code 10/20 = start, 11/21 = end).
        expect(dxf).toMatch(/\bLINE\b/);
        expect(dxf).toContain("\n11\n10\n"); // end x = 10
        expect(dxf).toContain("\n21\n5\n"); // end y = 5

        // CIRCLE with center + radius.
        expect(dxf).toMatch(/\bCIRCLE\b/);
        expect(dxf).toContain("\n40\n4\n"); // radius = 4
    });

    test("emits an ARC for a partial circle", async () => {
        await initWasm({ wasmBinary: WASM_BINARY });
        const factory = new ShapeFactory();
        // 90° arc about origin from +X to +Y.
        const arc = factory.arc(Z, { x: 0, y: 0, z: 0 }, { x: 5, y: 0, z: 0 }, 90);
        expect(arc.isOk).toBe(true);

        const dxf = exportDxf([arc.value as IEdge]);
        expect(dxf).toMatch(/\bARC\b/);
        expect(dxf).not.toMatch(/\bCIRCLE\b/);
        expect(dxf).toContain("\n40\n5\n"); // radius = 5
    });
});
