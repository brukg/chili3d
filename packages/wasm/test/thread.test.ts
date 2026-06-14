// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { readFileSync } from "node:fs";
import path from "node:path";
import type { ISolid } from "@chili3d/core";
import { initWasm, ShapeFactory } from "@chili3d/wasm";
import { describe, expect, test } from "@rstest/core";

const WASM_BINARY = readFileSync(path.join(process.cwd(), "packages/wasm/lib/chili-wasm.wasm"));

const Z = { x: 0, y: 0, z: 1 };

describe("Thread / helical sweep (headless)", () => {
    test("sweeps a circular profile along a helix into a solid coil", async () => {
        await initWasm({ wasmBinary: WASM_BINARY });
        const factory = new ShapeFactory();

        // axis +Z at origin; radius 10, pitch 4, height 20 (5 turns), wire radius 1.
        const thread = factory.thread(Z, { x: 0, y: 0, z: 0 }, 10, 4, 20, 1, false);
        expect(thread.isOk).toBe(true);

        const solid = thread.value as ISolid;
        const volume = solid.volume();
        // A coil of 5 turns: a torus-ish tube. Volume must be clearly positive and in a sane
        // range — far above zero, far below the bounding cylinder. ≈ length × πr².
        // length ≈ turns × √((2πR)² + pitch²) ≈ 5 × √(62.8² + 4²) ≈ 314.6; ×π×1² ≈ 988.
        expect(volume).toBeGreaterThan(500);
        expect(volume).toBeLessThan(2000);

        // Bounding box: the coil spans ±(R+r) in X/Y and roughly [0, height] in Z.
        const box = solid.boundingBox();
        expect(box.max.x - box.min.x).toBeGreaterThan(20); // ~2*(R+r)=22
        expect(box.max.z - box.min.z).toBeGreaterThan(18); // ~height
    });

    test("places the coil at the given center", async () => {
        await initWasm({ wasmBinary: WASM_BINARY });
        const factory = new ShapeFactory();
        const center = { x: 100, y: 0, z: 50 };
        const thread = factory.thread(Z, center, 10, 4, 20, 1, false);
        expect(thread.isOk).toBe(true);
        const box = (thread.value as ISolid).boundingBox();
        // X spans center.x ± (R+r) ≈ [89, 111]; Z starts near center.z = 50.
        expect((box.min.x + box.max.x) / 2).toBeCloseTo(100, 0);
        expect(box.min.z).toBeGreaterThan(45);
    });

    test("rejects invalid parameters", async () => {
        await initWasm({ wasmBinary: WASM_BINARY });
        const factory = new ShapeFactory();
        const o = { x: 0, y: 0, z: 0 };
        expect(factory.thread(Z, o, 0, 4, 20, 1, false).isOk).toBe(false);
        expect(factory.thread(Z, o, 10, 0, 20, 1, false).isOk).toBe(false);
        expect(factory.thread(Z, o, 10, 4, 20, 0, false).isOk).toBe(false);
    });
});
