// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { describe, expect, test } from "@rstest/core";
import { AppearancePresets, findAppearancePreset } from "../src/appearancePresets";

describe("appearance presets", () => {
    test("every preset has a unique id and in-range PBR fields", () => {
        const ids = new Set<string>();
        for (const p of AppearancePresets) {
            expect(ids.has(p.id)).toBe(false);
            ids.add(p.id);
            expect(p.color).toBeGreaterThanOrEqual(0);
            expect(p.color).toBeLessThanOrEqual(0xffffff);
            expect(p.metalness).toBeGreaterThanOrEqual(0);
            expect(p.metalness).toBeLessThanOrEqual(1);
            expect(p.roughness).toBeGreaterThanOrEqual(0);
            expect(p.roughness).toBeLessThanOrEqual(1);
        }
    });

    test("metals are metallic and paints are dielectric", () => {
        expect(findAppearancePreset("gold")?.metalness).toBe(1.0);
        expect(findAppearancePreset("steel")?.metalness).toBeGreaterThan(0.5);
        expect(findAppearancePreset("red-paint")?.metalness).toBe(0);
    });

    test("lookup is case-insensitive and returns undefined for unknown ids", () => {
        expect(findAppearancePreset("STEEL")?.id).toBe("steel");
        expect(findAppearancePreset("plutonium")).toBeUndefined();
    });
});
