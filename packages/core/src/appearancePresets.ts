// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

// Appearance preset library — the visual half of the material system (the physical half, with density,
// is materialPresets.ts). Each entry is a named PBR look (colour + metalness + roughness) used to seed a
// document's material library so the appearance picker lists ready-made materials instead of forcing the
// user to author each one. Pure data + lookup, directly unit-testable. Appearance carries NO mass — it
// is independent of the physical material.

export interface AppearancePreset {
    /** Stable identifier used for lookup. */
    id: string;
    /** Human-facing name (shown in the material picker). */
    name: string;
    /** sRGB colour as 0xRRGGBB. */
    color: number;
    /** PBR metalness in [0, 1]. */
    metalness: number;
    /** PBR roughness in [0, 1]. */
    roughness: number;
}

// Metals are high-metalness/low-roughness; plastics, organics and paints are dielectric (metalness 0).
export const AppearancePresets: readonly AppearancePreset[] = [
    { id: "steel", name: "Steel", color: 0x8c8c94, metalness: 0.9, roughness: 0.35 },
    { id: "stainless", name: "Stainless Steel", color: 0xb0b2b6, metalness: 0.9, roughness: 0.25 },
    { id: "aluminum", name: "Aluminum", color: 0xc9ccd1, metalness: 0.9, roughness: 0.3 },
    { id: "brass", name: "Brass", color: 0xc8a13a, metalness: 0.9, roughness: 0.3 },
    { id: "copper", name: "Copper", color: 0xb87333, metalness: 0.9, roughness: 0.3 },
    { id: "bronze", name: "Bronze", color: 0x9c7a3c, metalness: 0.9, roughness: 0.35 },
    { id: "gold", name: "Gold", color: 0xd4af37, metalness: 1.0, roughness: 0.2 },
    { id: "chrome", name: "Chrome", color: 0xdfe2e6, metalness: 1.0, roughness: 0.05 },
    { id: "titanium", name: "Titanium", color: 0x9a9591, metalness: 0.9, roughness: 0.4 },
    { id: "abs-black", name: "ABS Black", color: 0x2b2b2b, metalness: 0.0, roughness: 0.6 },
    { id: "abs-white", name: "ABS White", color: 0xf2f2f2, metalness: 0.0, roughness: 0.6 },
    { id: "pla-blue", name: "PLA Blue", color: 0x3f7fbf, metalness: 0.0, roughness: 0.55 },
    { id: "nylon", name: "Nylon", color: 0xf2f2ef, metalness: 0.0, roughness: 0.5 },
    { id: "rubber", name: "Rubber", color: 0x1a1a1a, metalness: 0.0, roughness: 0.95 },
    { id: "oak", name: "Oak", color: 0xb88a4a, metalness: 0.0, roughness: 0.7 },
    { id: "walnut", name: "Walnut", color: 0x5a3a22, metalness: 0.0, roughness: 0.7 },
    { id: "glass", name: "Glass", color: 0xa6c8d6, metalness: 0.0, roughness: 0.05 },
    { id: "concrete", name: "Concrete", color: 0x9e9e98, metalness: 0.0, roughness: 0.9 },
    { id: "red-paint", name: "Red Paint", color: 0xc0392b, metalness: 0.0, roughness: 0.4 },
    { id: "blue-paint", name: "Blue Paint", color: 0x2471a3, metalness: 0.0, roughness: 0.4 },
    { id: "green-paint", name: "Green Paint", color: 0x27ae60, metalness: 0.0, roughness: 0.4 },
    { id: "yellow-paint", name: "Yellow Paint", color: 0xf1c40f, metalness: 0.0, roughness: 0.4 },
] as const;

/** Look up an appearance preset by its id (case-insensitive); undefined when no preset matches. */
export function findAppearancePreset(id: string): AppearancePreset | undefined {
    const key = id.toLowerCase();
    return AppearancePresets.find((p) => p.id === key);
}
