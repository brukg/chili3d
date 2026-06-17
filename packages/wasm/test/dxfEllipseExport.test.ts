// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { readFileSync } from "node:fs";
import path from "node:path";
import { initWasm, ShapeFactory } from "@chili3d/wasm";
import { describe, expect, test } from "@rstest/core";
import { exportDxf } from "../../builder/src/dxf/dxfExporter";
import { parseDxf } from "../../builder/src/dxf/dxfImporter";

const WASM_BINARY = readFileSync(path.join(process.cwd(), "packages/wasm/lib/chili-wasm.wasm"));

// The DXF exporter now emits a native ELLIPSE entity (not a tessellated polyline) for ellipse edges,
// so an exported ellipse round-trips back through the importer as an ellipse.
describe("DXF native ellipse export", () => {
    test("an ellipse edge exports as an ELLIPSE entity and re-parses faithfully", async () => {
        await initWasm({ wasmBinary: WASM_BINARY });
        const factory = new ShapeFactory();
        // major 5 along +x, minor 2, centre (1,2,0).
        const ellipse = factory.ellipse(
            { x: 0, y: 0, z: 1 },
            { x: 1, y: 2, z: 0 },
            { x: 1, y: 0, z: 0 },
            5,
            2,
        );
        expect(ellipse.isOk).toBe(true);

        const dxf = exportDxf([ellipse.value]);
        expect(dxf).toContain("ELLIPSE");
        const entities = parseDxf(dxf);
        expect(entities.length).toBe(1);
        const e = entities[0];
        expect(e.type).toBe("ellipse");
        if (e.type === "ellipse") {
            expect(e.cx).toBeCloseTo(1, 5);
            expect(e.cy).toBeCloseTo(2, 5);
            expect(e.mx).toBeCloseTo(5, 5); // major-axis endpoint vector = xAxis·majorRadius
            expect(e.my).toBeCloseTo(0, 5);
            expect(e.ratio).toBeCloseTo(0.4, 5); // minor/major = 2/5
        }
    });
});
