// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { readFileSync } from "node:fs";
import path from "node:path";
import { type IFace, type ISolid, Plane, ShapeTypes } from "@chili3d/core";
import { initWasm, ShapeFactory } from "@chili3d/wasm";
import { describe, expect, test } from "@rstest/core";

const WASM_BINARY = readFileSync(path.join(process.cwd(), "packages/wasm/lib/chili-wasm.wasm"));

describe("Draft angle (headless)", () => {
    test("tapers a vertical box face about a horizontal neutral plane, changing volume", async () => {
        await initWasm({ wasmBinary: WASM_BINARY });

        const factory = new ShapeFactory();
        const box = factory.box(Plane.XY, 20, 20, 20);
        expect(box.isOk).toBe(true);
        const before = (box.value as ISolid).volume();

        // Face order is implementation-defined, so query for the +X side face.
        const faces = box.value.findSubShapes(ShapeTypes.face);
        let targetIndex = -1;
        for (let i = 0; i < faces.length; i++) {
            const [, n] = (faces[i] as IFace).normal(0.5, 0.5);
            if (Math.abs(n.x - 1) < 1e-3) {
                targetIndex = i;
                break;
            }
        }
        expect(targetIndex).toBeGreaterThanOrEqual(0);

        const drafted = factory.draftAngle(
            box.value,
            [targetIndex],
            { x: 0, y: 0, z: 1 },
            (5 * Math.PI) / 180,
            { x: 0, y: 0, z: 0 },
            { x: 0, y: 0, z: 1 },
        );
        expect(drafted.isOk).toBe(true);

        const after = (drafted.value as ISolid).volume();
        expect(Math.abs(after - before)).toBeGreaterThan(1);
    });
});
