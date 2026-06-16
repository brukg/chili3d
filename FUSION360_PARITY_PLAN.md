# Chili3D → Fusion 360 Parity Plan

Goal: bring Chili3D to Fusion-360-level feature coverage. This is the master checklist —
every Fusion 360 capability is listed and mapped to Chili3D's current state. Work proceeds
batch by batch; nothing is "done" until it's `tsc`-clean, tests green, and committed on
`feature/cad-completeness`.

Status legend: ✅ done · 🟡 partial / kernel-exists-but-no-UX · ❌ missing · ⛔ out of scope (browser CAD)

Items marked **[session]** were shipped in the current rollout.

## Progress log (most recent first)

- **Batch 1 (partial):** interactive sketch constraints — 13 commands (Horizontal, Vertical,
  Coincident, Fix, Parallel, Perpendicular, Equal, Point-on-Line, **Symmetric**, Dimension,
  Horizontal/Vertical/Angle dimension). Symmetric is a NEW solver constraint (added `symmetric()` to
  the Gauss-Newton solver). Every other command wires the pre-existing solver to viewport sub-shape
  selection. _Remaining in Batch 1: constraint glyphs, drag-to-solve, DOF colour,
  sketch fillet/trim/offset/mirror (all viewport-rendering work)._
- **Batch 4 (partial):** construction planes — Offset, At-Angle, Midplane. _Remaining: tangent
  plane, plane-along-path, construction axes, construction points._
- **Batch 2 (progressing):** Thicken (open face/shell → solid via makeThickSolidBySimple);
  Ellipsoid primitive (completed a half-wired kernel binding); **Torus** primitive (new C++
  `BRepPrimAPI_MakeTorus` kernel fn + WASM rebuild + TorusNode). _Remaining: hole dialog,
  replace-face, emboss, boundary-fill, align. (split-body/split-face already covered by modify.split;
  coil/spring already covered by the Thread primitive — it sweeps a circular profile along a helix.)_
- **Batch 8 (started):** Center of Mass marker — drops a parametric point at a selected solid's
  world-space centroid (`ISolid.massProperties().centerOfMass`). _Remaining: section analysis,
  draft/curvature/zebra analysis._
- **Batch 6/11 (started):** Move to Origin — recentres the selection's combined world bbox at the
  origin (pure post-multiplied translation; pattern proven by a Matrix4 convention test). Create
  Bounding Box — an AABB box matching the selection's world extents (stock/extents utility).
  _NOTE: zoom-fit (F) is already selection-aware (frames the selection when one exists) — no separate
  fit-to-selection needed. Deferred, need live verification: Align face-to-face, Replace-face
  (replaceSubShape is fragile — swaps raw topology), per-face appearances/colour._

---

## Batch 0 — Already present in Chili3D (baseline, not re-doing)

These exist and work; listed so the gap analysis is honest.

- ✅ Primitives: box, sphere, cylinder, cone, pyramid, thread
- ✅ Sketch curves: line, arc (2pt/3pt), circle, ellipse, bezier, polygon, rect, regular polygon, point
- ✅ Features: extrude, revolve, sweep, loft, pipe, shell (thick solid), rib, hole, draft
- ✅ Fillet (constant + variable), chamfer, remove-fillet **[session]**
- ✅ Booleans: cut / join / common (destructive + linked/non-destructive)
- ✅ Transforms: move, rotate, scale **[session]**, mirror, array (rect/circular/path, linked)
- ✅ Convert: to face/wire/shell/solid, section, offset, curve projection
- ✅ Push/Pull on planar faces **[session]**
- ✅ Surface: fill n-sided, sew, simplify, remove faces/feature
- ✅ Working planes: XY/YZ/ZX, from-face, from-3-points **[session]**, from-section, dynamic
- ✅ Measure: length, angle, properties (vol/area/CoG/inertia), interference
- ✅ Selection: type filters, brush add/remove, snapping (12+ snap types)
- ✅ Organization: folder/group **[session]**, isolate/hide/show/lock **[session]**, cut/copy/paste/duplicate **[session]**, select-all **[session]**
- ✅ View: solid / wireframe / both cycle **[session]**, zoom-fit **[session]**
- ✅ Parameters: named user parameters + expressions driving dimensions
- ✅ 2D constraint solver: 12 constraint types, Gauss-Newton, DOF/over-constrained feedback (NO interactive UI yet — see Batch 1)
- ✅ I/O: STEP, IGES, BREP, STL import/export; URDF export
- ✅ Robotics: LinkNode/JointNode kinematic tree, joint gizmo, URDF
- ✅ History: undo/redo stack, transactions
- ✅ Plugins, MCP AI integration

---

## Batch 1 — Interactive Sketch Constraints (BIGGEST GAP) ❌

The solver exists in `packages/core/src/sketch/` but there is no interactive UX. In Fusion,
sketching is the heart of parametric modeling. This is the single most important batch.

- ❌ Sketch mode entry/exit (enter sketch on a plane/face, exit back to 3D) — partial: SketchNode exists
- ❌ Live constraint inference while drawing (auto horizontal/vertical/coincident/tangent)
- ❌ Apply geometric constraints from toolbar: coincident, collinear, concentric, midpoint,
      fix/ground, parallel, perpendicular, horizontal/vertical, tangent, equal, symmetric, smooth
- ❌ Dimensional constraints (sketch dimension tool): linear, aligned, angular, radial, diameter
- ❌ Constraint glyphs rendered on sketch + click-to-delete
- ❌ Drag-to-solve (move a point, solver updates the rest live)
- ❌ Degree-of-freedom / fully-constrained color feedback in viewport
- ❌ Sketch palette toggles (construction geometry, slice, show profile)
- ❌ Project / intersect geometry into active sketch
- ❌ Sketch fillet, trim, extend, offset, mirror, rectangular/circular sketch pattern
- ❌ Slot, polygon-inscribed/circumscribed, conic curve, fit-point spline, text-on-sketch

## Batch 2 — Solid feature gaps 🟡

- ❌ Hole feature dialog: simple / counterbore / countersink, with thread spec
- ❌ Coil / spring primitive (helical sweep)
- ❌ Torus primitive
- ❌ Emboss / engrave (project profile onto face, raise/cut)
- ❌ Web feature (thin support between faces; rib exists, web doesn't)
- ❌ Boundary fill (region-based solid from intersecting surfaces/planes)
- ❌ Thicken surface → solid (kernel `makeThickSolidBySimple` exists, no command) 🟡
- ❌ Replace face (kernel `replaceSubShape` exists, unexposed) 🟡
- ❌ Split face (by plane/surface/sketch)
- ❌ Split body
- ❌ Silhouette split
- ❌ Align (face-to-face placement)
- ❌ Rule fillet / full-round fillet / set-back corners
- ❌ Move face (offset/rotate a face set)

## Batch 3 — Surface (patch) modeling ❌

- 🟡 Patch (fill exists as `fillSurface`; needs proper command + guide curves)
- ❌ Offset surface (command)
- ❌ Extend surface
- ❌ Trim / untrim surface
- ❌ Stitch / unstitch (sew exists 🟡; need unstitch + UX)
- ❌ Ruled surface
- ❌ Reverse normal
- ❌ Surface loft / sweep / revolve / extrude as open surfaces (solids exist; need open-surface mode)

## Batch 4 — Construction geometry ❌

- ✅ Plane from 3 points **[session]**, from face, from section
- ❌ Offset plane (parallel at distance)
- ❌ Plane at angle (about an edge)
- ❌ Midplane (between two faces)
- ❌ Tangent plane (to cylinder at point)
- ❌ Plane along path (normal to curve at parameter)
- ❌ Construction axis (through edge, two points, two planes, cylinder/cone axis, normal-to-face-at-point)
- ❌ Construction point (vertex, edge-plane intersection, two-edge intersection, center of circle/sphere/torus)

## Batch 5 — Assembly & joints (beyond robotics) ❌

Chili3D has robotics joints (URDF). Fusion's mechanical assembly joints are a different model.

- 🟡 Components vs bodies distinction (groups/links exist; need true component instances)
- ❌ Assembly joints: rigid, revolute, slider, cylindrical, pin-slot, planar, ball
- ❌ Joint origins / as-built joints
- ❌ Joint limits + drive/animate joint
- ❌ Rigid groups
- ❌ Contact sets + interference-driven motion
- ❌ Motion study / animation of mechanisms
- ✅ Interference detection (measure.interference exists)

## Batch 6 — Modify / direct-edit gaps 🟡

- ✅ Press/Pull **[session]** (planar only; extend to edges/fillet via press-pull)
- ❌ Delete face with heal (removeFeature exists 🟡; needs friendly command)
- ❌ Copy/paste bodies in 3D (node clipboard exists; geometric paste with placement)
- ❌ Physical material assignment + density-driven mass
- ❌ Appearance (per-face material/color override) — material system exists, need face-level UX

## Batch 7 — Mesh workflows ❌

- 🟡 STL import exists (as mesh node)
- ❌ Insert mesh / OBJ / 3MF import
- ❌ Mesh → BRep conversion
- ❌ Reduce / remesh / repair mesh
- ❌ Mesh section / plane cut

## Batch 8 — Inspection & analysis 🟡

- ✅ Measure length/angle/properties/interference
- ❌ Section analysis (live section plane with capping)
- ❌ Curvature comb / zebra / draft analysis / curvature map
- ❌ Center of mass display marker
- ❌ Component color cycling / appearance-by-state

## Batch 9 — Drawings & documentation ❌

- ❌ 2D drawing from model (orthographic/iso views)
- ❌ Dimensions & annotations on drawings
- ❌ Section / detail views
- ❌ BOM / parts list table
- ❌ Title block, sheets, export PDF/DXF

## Batch 10 — Visualization / render 🟡

- ✅ Solid/wireframe/both view modes **[session]**
- ❌ Appearance library (metals, plastics, glass) with drag-apply
- ❌ Scene environment (ground, lighting, background)
- ❌ Exploded view + animation
- ❌ Ray-traced / high-quality render mode

## Batch 11 — Utilities / quality-of-life 🟡

- ✅ Many keyboard shortcuts; multiple shortcut profiles (Fusion/Blender/Revit/Solidworks)
- ❌ View cube (corner orientation widget)
- ❌ Named views / saved camera positions
- ❌ Measure with running total / chain
- ❌ Repair bodies / check geometry
- ❌ Standard view shortcuts (front/top/right/iso = 1..7)

## Out of scope for a browser CAD (Fusion has, we won't chase) ⛔

- ⛔ CAM / toolpath generation / post-processors
- ⛔ FEA simulation (static/modal/thermal)
- ⛔ Generative design (cloud compute)
- ⛔ Sheet-metal full flat-pattern manufacturing suite (could do a lite version later)
- ⛔ Cloud PDM / version history / branching / collaboration
- ⛔ T-Spline/freeform sculpting (huge kernel surface; revisit only if requested)

---

## Execution order (priority)

1. **Batch 1** — interactive sketch constraints (unlocks real parametric modeling) ← biggest impact
2. **Batch 4** — construction geometry (cheap, high-leverage; planes/axes/points)
3. **Batch 2** — solid feature gaps (coil, torus, thicken, replace-face, split — kernel mostly ready)
4. **Batch 8 + 11** — inspection + view-cube/named-views (quick wins)
5. **Batch 3** — surface modeling
6. **Batch 6** — direct-edit + appearances
7. **Batch 5** — assembly joints
8. **Batch 7** — mesh
9. **Batch 10** — render
10. **Batch 9** — drawings (largest standalone subsystem)

Each batch: implement → `npx tsc --noEmit` clean → `npm test` green → commit. No build breakage.
