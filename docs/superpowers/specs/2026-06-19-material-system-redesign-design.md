# Material system redesign — Physical material vs Appearance (Fusion-style)

Date: 2026-06-19 · Branch: `feature/cad-completeness`

## Problem

The robot "Apply Material" command conflated two independent concerns: it painted a PBR
appearance *and* set density-driven mass from one pick. Users want them separate (changing a
part's physical material for mass reasons must not repaint it), a ready-made list of materials
to pick from (no typing), and the ability to apply a material to **nodes** (groups/links), not
just individual parts. Today the appearance picker (`materialId`) only exists on
`GeometryNode`/`MeshNode` (parts); the renderer resolves material per-part with no group cascade.

## Decision

Two independent axes, both pick-from-a-catalog, both applicable to nodes (cascading to parts):

- **Appearance** — colour + metalness + roughness (how it looks). Never affects mass.
- **Physical material** — density (drives mass). Never affects appearance.

## Design

### Catalogs (core, pure data)
- `core/src/appearancePresets.ts` — ~20 named looks `{ id, name, color, metalness, roughness }`
  (metals, plastics, woods, glass, rubber, paints) + `findAppearancePreset`. Unit-tested.
- Physical catalog = the existing `core/src/materialPresets.ts` (already `{ …, density }`).

### Node-level appearance (core model)
- Add `materialId` to `GroupNode` with `@property("common.material", { type: "materialId" })`.
  The setter **cascades**: bake the chosen material id onto every descendant `GeometryNode`
  (`canShowMaterialProperty` doesn't filter by node type, so the existing `MaterialProperty`
  picker renders for groups/links automatically; the renderer already paints each part).
- Parts keep their own per-part `materialId` picker.
- Appearance never touches mass.

### Node-level physical material (core model)
- Add `physicalMaterial` (string id, default "") to `GroupNode` with
  `@property("link.physicalMaterial", { type: "select", options })`. The setter **cascades**:
  for every descendant `LinkNode` (and itself if a link) set its density-driven mass
  (`mass = density · volume`, volume summed from the link's own solids via `IShape.massProperties`).
- Physical material never touches appearance.

### Seeding (app)
- In `application.ts newDocument`, seed `modelManager.materials` with `PhysicalMaterial`
  entries built from the appearance catalog (keep a neutral default first), so the picker lists
  them with no typing.

### Cleanup
- Remove the conflated robot `Apply Material` command (`modify.applyMaterial`) and its ribbon/i18n
  entries; the two node properties replace it.

## Verification
Catalogs, the cascade setters, and the mass recompute are headless-testable (model + a wasm test
for volume). The property-panel rendering of the two pickers on a group/link follows the existing
mechanism but is a visual behaviour the user should confirm in-app. Build stays green throughout.

## Out of scope (possible follow-ups)
- Live (renderer) group-material cascade instead of bake-on-set.
- Texture maps in the appearance catalog.
- A one-click "apply to selection" command alongside the property-panel pickers.
