// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { describe, expect, test } from "@rstest/core";
import { findMaterialPreset, MaterialPresets } from "../src/materialPresets";

describe("material presets", () => {
    test("every preset has a unique id and physically sensible fields", () => {
        const ids = new Set<string>();
        for (const p of MaterialPresets) {
            expect(ids.has(p.id)).toBe(false);
            ids.add(p.id);
            expect(p.density).toBeGreaterThan(0);
            expect(p.metalness).toBeGreaterThanOrEqual(0);
            expect(p.metalness).toBeLessThanOrEqual(1);
            expect(p.roughness).toBeGreaterThanOrEqual(0);
            expect(p.roughness).toBeLessThanOrEqual(1);
            expect(p.color).toBeGreaterThanOrEqual(0);
            expect(p.color).toBeLessThanOrEqual(0xffffff);
        }
    });

    test("known densities match handbook values (kg/m³)", () => {
        expect(findMaterialPreset("steel")?.density).toBe(7850);
        expect(findMaterialPreset("aluminum")?.density).toBe(2700);
        expect(findMaterialPreset("water")?.density).toBe(1000);
    });

    test("lookup is case-insensitive and returns undefined for unknown ids", () => {
        expect(findMaterialPreset("STEEL")?.id).toBe("steel");
        expect(findMaterialPreset("unobtanium")).toBeUndefined();
    });
});
