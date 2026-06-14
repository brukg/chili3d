// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { readFileSync } from "node:fs";
import path from "node:path";
import { Plane } from "@chili3d/core";
import { initWasm, ShapeFactory } from "@chili3d/wasm";
import { describe, expect, test } from "@rstest/core";
import { exportThreeMf } from "../src/threemf/threeMfExporter";

const WASM_BINARY = readFileSync(path.join(process.cwd(), "packages/wasm/lib/chili-wasm.wasm"));

describe("exportThreeMf", () => {
    test("exports a 10mm box as a valid 3MF package (indexed mesh, mm units)", async () => {
        await initWasm({ wasmBinary: WASM_BINARY });
        const factory = new ShapeFactory();
        const box = factory.box(Plane.XY, 10, 10, 10);
        expect(box.isOk).toBe(true);

        const result = await exportThreeMf([box.value], factory.converter);
        expect(result.isOk).toBe(true);

        const JSZip = (await import("jszip")).default;
        const zip = await JSZip.loadAsync(result.value);

        expect(zip.file("[Content_Types].xml")).toBeTruthy();
        expect(zip.file("_rels/.rels")).toBeTruthy();
        const model = await zip.file("3D/3dmodel.model")!.async("string");

        expect(model).toContain('unit="millimeter"');
        expect(model).toContain("<build>");
        expect(model).toContain('objectid="1"');

        const vtxCount = (model.match(/<vertex /g) || []).length;
        const triCount = (model.match(/<triangle /g) || []).length;
        // A flat box: 8 unique corners, 12 facets (2 per face). Verifies vertex dedup/indexing.
        expect(vtxCount).toBe(8);
        expect(triCount).toBe(12);
    });
});
