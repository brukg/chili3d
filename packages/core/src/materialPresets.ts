// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

// Appearance / physical-material preset library (Batch 10 / Batch 6 foundation). Each preset carries a
// PBR appearance (colour + metalness + roughness) and a physical density (kg/m³) so it can drive both
// the visual material and the mass measure. Pure data + lookup, so it is directly unit-testable.

export interface MaterialPreset {
    /** Stable identifier used for lookup and serialization. */
    id: string;
    /** Human-facing name (i18n is applied at the UI layer). */
    name: string;
    /** sRGB colour as 0xRRGGBB. */
    color: number;
    /** PBR metalness in [0, 1]. */
    metalness: number;
    /** PBR roughness in [0, 1]. */
    roughness: number;
    /** Density in kg/m³ for mass calculations. */
    density: number;
}

// Densities are standard handbook values (kg/m³). Metals are high-metalness/low-roughness; plastics and
// organics are dielectric (metalness 0) with higher roughness.
export const MaterialPresets: readonly MaterialPreset[] = [
    { id: "steel", name: "Steel", color: 0x8c8c94, metalness: 0.9, roughness: 0.35, density: 7850 },
    {
        id: "stainless",
        name: "Stainless Steel",
        color: 0xb0b2b6,
        metalness: 0.9,
        roughness: 0.25,
        density: 8000,
    },
    { id: "aluminum", name: "Aluminum", color: 0xc9ccd1, metalness: 0.9, roughness: 0.3, density: 2700 },
    { id: "brass", name: "Brass", color: 0xc8a13a, metalness: 0.9, roughness: 0.3, density: 8500 },
    { id: "copper", name: "Copper", color: 0xb87333, metalness: 0.9, roughness: 0.3, density: 8960 },
    { id: "titanium", name: "Titanium", color: 0x9a9591, metalness: 0.9, roughness: 0.4, density: 4500 },
    { id: "gold", name: "Gold", color: 0xd4af37, metalness: 1.0, roughness: 0.2, density: 19300 },
    { id: "abs", name: "ABS Plastic", color: 0x2b2b2b, metalness: 0.0, roughness: 0.6, density: 1050 },
    { id: "pla", name: "PLA Plastic", color: 0x3f7fbf, metalness: 0.0, roughness: 0.55, density: 1240 },
    { id: "nylon", name: "Nylon", color: 0xf2f2ef, metalness: 0.0, roughness: 0.5, density: 1140 },
    { id: "rubber", name: "Rubber", color: 0x1a1a1a, metalness: 0.0, roughness: 0.95, density: 1100 },
    { id: "glass", name: "Glass", color: 0xa6c8d6, metalness: 0.0, roughness: 0.05, density: 2500 },
    { id: "wood", name: "Wood", color: 0x9c6b3f, metalness: 0.0, roughness: 0.8, density: 700 },
    { id: "concrete", name: "Concrete", color: 0x9e9e98, metalness: 0.0, roughness: 0.9, density: 2400 },
    { id: "water", name: "Water", color: 0x3a7bd5, metalness: 0.0, roughness: 0.1, density: 1000 },
] as const;

/** Look up a preset by its id (case-insensitive); undefined when no preset matches. */
export function findMaterialPreset(id: string): MaterialPreset | undefined {
    const key = id.toLowerCase();
    return MaterialPresets.find((p) => p.id === key);
}
