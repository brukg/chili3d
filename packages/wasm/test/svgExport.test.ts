// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { readFileSync } from "node:fs";
import path from "node:path";
import { type IEdge, XYZ } from "@chili3d/core";
import { initWasm, ShapeFactory } from "@chili3d/wasm";
import { describe, expect, test } from "@rstest/core";
import { exportSvg } from "../../builder/src/svg/svgExporter";

const WASM_BINARY = readFileSync(path.join(process.cwd(), "packages/wasm/lib/chili-wasm.wasm"));

describe("SVG export", () => {
    test("a closed circle exports as an <circle> with the right radius and a 10×10 viewBox", async () => {
        await initWasm({ wasmBinary: WASM_BINARY });
        const factory = new ShapeFactory();
        const circle = factory.circle({ x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: 0 }, 5);
        const svg = exportSvg([circle.value as IEdge]);

        expect(svg).toContain("<circle");
        expect(svg).toContain('r="5.0000"');
        // bbox is [-5,5]² → 10×10; centre maps to (5,5) after the −minX shift and y-flip.
        expect(svg).toContain('viewBox="0 0 10.0000 10.0000"');
        expect(svg).toContain('cx="5.0000"');
        expect(svg).toContain('cy="5.0000"');
    });

    test("a line exports as an <line>, flipped into SVG's y-down frame", async () => {
        await initWasm({ wasmBinary: WASM_BINARY });
        const factory = new ShapeFactory();
        // From (0,0) to (10,5): maxY = 5, so y flips to (5, 0).
        const line = factory.line(new XYZ({ x: 0, y: 0, z: 0 }), new XYZ({ x: 10, y: 5, z: 0 }));
        const svg = exportSvg([line.value as IEdge]);

        expect(svg).toContain("<line");
        expect(svg).toContain('x1="0.0000"');
        expect(svg).toContain('y1="5.0000"');
        expect(svg).toContain('x2="10.0000"');
        expect(svg).toContain('y2="0.0000"');
    });
});
