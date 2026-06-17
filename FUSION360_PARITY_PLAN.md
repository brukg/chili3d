# Chili3D → Fusion 360 Parity Plan

Goal: bring Chili3D to Fusion-360-level feature coverage. This is the master checklist —
every Fusion 360 capability is listed and mapped to Chili3D's current state. Work proceeds
batch by batch; nothing is "done" until it's `tsc`-clean, tests green, and committed on
`feature/cad-completeness`.

Status legend: ✅ done · 🟡 partial / kernel-exists-but-no-UX · ❌ missing · ⛔ out of scope (browser CAD)

Items marked **[session]** were shipped in the current rollout.

## Progress log (most recent first)

- **Batch 3:** **Offset Surface** — a new surface parallel to the selected face(s)/shell at a signed
  normal distance (Fusion's "Offset" surface), via a NEW kernel factory `offsetSurface` (C++
  BRepOffsetAPI_MakeOffsetShape::PerformBySimple; WASM rebuilt). Distinct from Thicken (which closes
  to a solid). WASM test: a 10×10 face offset by 5 is a parallel 100 mm² face on the z=5 plane.

- **Batch 3:** **Ruled Surface** — a dedicated 2-rail ruled surface command (Fusion's "Ruled"): select
  two edges/wires, build the straight-line surface between them via a ruled, non-solid loft. Discoverable
  one-click alternative to the general Loft. WASM test: a ruled surface between two parallel 10mm
  segments 5mm apart is a 50 mm² strip.

- **Batch 1:** **Fit Point Spline** — a B-spline curve passing through every picked point (Fusion's
  fit-point spline), via a NEW kernel factory `interpolate(points, periodic)` (C++ GeomAPI_Interpolate;
  WASM rebuilt). Click the first point again to close into a smooth periodic spline. Distinct from
  Bezier (control points). WASM test: the spline passes through every fit point (distance ~0); <2
  points fails cleanly. Unblocks future DXF SPLINE import.

- **Batch 4:** **Axis Normal to Face** — construction axis perpendicular to a face at a picked point
  (Fusion's "axis perpendicular to face at point"), via recovered surface parameters → true normal
  (works on curved faces). Completes the axis family: circular-edge axis, two-faces axis, normal-to-
  face axis. WASM test: normal recovered from a picked box-face point matches the face normal.

- **Batch 4:** **Plane Normal to Curve** — construction plane along a path (Fusion's "plane along
  path"): pick an edge and a point on it; the workplane sits there with its normal along the curve
  tangent (`curve.d1(u).vec`), ready for a sweep/loft profile drawn perpendicular to the path. WASM
  test: a line's tangent is its direction; a circle's tangent is ⟂ to its radius and in-plane.

- **Batch 2:** **Tube primitive** — parametric hollow cylinder (`TubeNode`, serializable). Same picks
  as Cylinder (centre, outer radius, height) plus an editable wall-thickness property; bore = outer −
  thickness, built by cutting the inner cylinder from the outer. A non-positive bore degrades to a
  solid cylinder. WASM node tests: annular volume = π·(R²−r²)·h, and degenerate-bore = solid cylinder.

- **Batch 4:** **Axis at Two Faces** — construction axis on the line where two planar faces intersect
  (Fusion's axis-through-two-planes), derived from the faces' planes via a new pure `intersectTwoPlanes`
  helper (direction = n1×n2; nearest-origin point); parallel faces are rejected. Distinct from the line
  tool. Unit tests: XY∩XZ = X axis, offset planes z=5/y=2 → line (t,2,5), parallel → undefined.

- **Batch 4:** **Construction Axis** — reference line along the revolution axis of each selected
  circular edge (circle/arc), through the centre along the circle's `axis`, spanning ±2·radius — a
  ready-made axis for Revolve / circular patterns. Reuses the centre+axis extraction (direct circle
  or trimmed basis curve). WASM test asserts a circle edge yields centre (2,3,4), axis ±Z, radius 5.

- **Batch 8:** **Measure Face Angle** — angle between two selected faces, taken between their outward
  normals (Fusion's face-to-face angle). Two single-select face steps → toast in degrees. WASM test:
  box faces are pairwise 90° (adjacent) / 180° (opposite). Complements the 3-point Measure Angle.

- **Batch 3:** **Reverse Normal** — flip a face/shell's topological orientation (surface normals) via
  the already-bound `TopoDS_Shape.reversed()`, surfaced as `IShape.reversed()` (no WASM rebuild).
  New `modify.reverseNormal` command builds reversed EditableShapeNodes from the selection. Useful
  before sewing/thickening or 3D-print export. WASM test asserts orientation flips and double-reverse
  restores it. (Patch via fillSurface and ruled/open surfaces via loft were already present.)

- **Batch 6/8:** **Measure Mass** — physical-material density → mass (Fusion's physical material).
  Editable `density` property (kg/m³, default steel 7850); reports mass in g and kg from the solid's
  kernel volume: mass(g) = density · volume(mm³) · 1e-6. WASM test: 10 mm steel cube → 7.85 g.

- **Batch 8:** **Measure Distance** — minimum (extrema) gap between two selected shapes of any
  topology (vertex/edge/face/solid), via the existing `IShape.extremaDistance` (BRepExtrema_DistShapeShape).
  Two single-select steps → toast. Complements free point-to-point Measure Length. WASM test asserts
  analytic values (3-4-5 points → 5; box face to external point → 5).

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
  `BRepPrimAPI_MakeTorus` kernel fn + WASM rebuild + TorusNode); **counterbore + countersink hole**
  options on the Hole command (compose makeHole + booleanCut of a wider cylinder / a cone; defaults
  keep a plain hole). The Hole command now covers all three Fusion hole types.
  _Remaining: replace-face, emboss, boundary-fill, align. (split-body/split-face already covered by
  modify.split; coil/spring already covered by the Thread primitive — helical sweep of a circle.)_
- **Batch 8 (started):** Center of Mass marker — drops a parametric point at a selected solid's
  world-space centroid (`ISolid.massProperties().centerOfMass`). Measure Bounding Box — reports the
  selection's overall dx×dy×dz. Measure Radius — radius/diameter of a circular edge (via CurveUtils.
  isCircle). Measure Edge Length — total true (curve) length of selected edges/wires, so arcs measure
  along the curve. Measure Area — total surface area of selected faces (IFace.area()). Measure Topology
  — face/edge/vertex counts of a body (box → 6/12/8). _Remaining: section analysis, draft/curvature/
  zebra analysis._
- **Batch 11:** Toggle Perspective/Orthographic projection command (flips `cameraController.cameraType`).
- **Batch 11:** Invert Selection (Ctrl+Shift+A) — selects every object not currently selected.
- **Batch 2/6 (modify):** Fillet All Edges — rounds every edge of a selected body with one radius
  (collects all edge indices, single fillet call) — Fusion's body-level fillet. Headless test confirms
  all 12 edges of a cube fillet to a valid solid (the corners where 3 fillets meet hold up). Chamfer
  All Edges too (same pattern with the chamfer op).
- **Batch 2 (solid):** Hole "Through All" option — drills the full extent of the solid. NOTE: the
  kernel's `makeHole` is BLIND-ONLY (fails once depth reaches the far face), so through-all cuts a
  full-length cylinder via booleanCut instead. Headless test confirms a clean through-hole (π·r²·h).
- **Batch 2 (solid):** symmetric extrude — ExtrudeNode gains a `symmetric` option that extrudes half
  the length each way from the profile plane (centred result), Fusion's symmetric extrude. Backward
  compatible (default off). Headless test: length 10 symmetric spans z −5..5 vs 0..10 one-sided.
- **Batch 4 (construction):** Tangent Plane — pick a face + a point on it; the working plane becomes
  tangent to the face there (origin = point, normal = surface normal via `surface.parameter` +
  `face.normal`). For curved faces this is the local tangent plane to sketch on.
- **Batch 4 (construction):** Point at Midpoint — drops a construction point at each selected edge's
  true midpoint (curve mid-parameter, correct for arcs too). Headless test: line midpoint (5,0,2).
  Point at Center — drops a point at a circular edge's centre (via the curve/basis-curve, CurveUtils.
  isCircle). Headless test: circle centred (3,4,0) → centre (3,4,0). Point at Intersection — drops a
  point wherever two edges cross (IEdge.intersect). Headless test: an X of two lines → (0,0,0).
  Construction-point tools now match Fusion (location, midpoint, centre, intersection).
  _CORRECTION: Move/Rotate/Mirror already support a copy/clone option (TransformedCommand.isClone) —
  Move/Copy is not a gap._
- **Batch 1 (arc support — step 1 DONE):** SketchNode now supports **arc segments** via an optional
  per-segment `bulges` field (DXF tan(θ/4) convention) — pure geometry-build params, NO solver/
  constraint change, fully backward compatible (empty bulges = the old polygon exactly). generateShape
  builds a mixed line/arc wire. Headless test: a 2-point sketch bulged both sides = a circle (area πr²).
  **Sketch Circle tool (step 2 DONE):** centre + radius creates an editable SketchNode circle (two
  diameter points + bulges [1,1]) — a real sketch profile, not a static face.
  **Sketch Slot tool (step 3 DONE):** centre line + radius → an editable slot (two straight sides +
  bulged semicircular end caps, bulges [0,1,0,1]). Headless test: area = L·2r + π·r².
  **Sketch Polygon tool (DONE):** inscribed regular N-gon as an editable SketchNode (N pinned corners
  on the radius circle; sides count is a property). Headless test: area = ½·N·r²·sin(2π/N).
  **Sketch Center Rectangle (DONE):** centre + corner → centred constrained rectangle (same proven
  fixed-4-corner pattern as Sketch Rectangle).
  **Sketch 3-Point Circle (DONE):** circle through three picked points (centre/radius from
  computeCircleFromPoints, built as the bulge circle). Pure-math test covers the 3-point circle logic.
  **Sketch 3-Point Rectangle (DONE):** angled rectangle from a base edge (2 points) + width point;
  same fixed-corner construction in a base-edge-aligned frame.
  The sketch toolbar now has line, rectangle (2-corner, centre, 3-point/angled), circle (centre+radius
  & 3-point), slot, polygon (+ existing arcs) and the full geometric/dimensional constraint set —
  effectively Fusion-complete for 2D sketching.
  **Midpoint constraint (DONE):** new solver constraint pinning a point to a segment's midpoint
  (added `midpoint()` to the solver, like symmetric). Headless test: point pinned to (5,2).
  **Collinear constraint (DONE):** new solver constraint putting two segments on the same line
  (added `collinear()`). Headless test: a skew segment drops onto the first segment's line.
  **Concentric constraint (DONE):** new solver constraint making two diameter segments share a centre
  (equal midpoints) — concentric circles/arcs. Headless test: a diameter's centre moves to the origin.
  **Tangent constraint (circles) (DONE):** new solver constraint making two sketch circles externally
  tangent (centre distance = r1+r2); the command rejects non-circular picks so it's never misapplied.
  Headless test: a circle's centre moves to distance r1+r2.
  The solver now has 18 constraint functions (5 added this run: symmetric, midpoint, collinear,
  concentric, tangent-circles).
- **Batch 1 (parametric):** expression-driven dimensions — the Dimension / Horizontal / Vertical /
  **Angle** dimension commands take an optional expression evaluated against the document's named
  parameters, instead of only a literal (angle wraps the degrees expression with the deg→rad factor).
  Changing a parameter resizes the sketch — core Fusion parametric behaviour. Headless tests: a "w*2"
  distance solves to 10 at w=5; a "w" degrees angle solves to 90° at w=90.
- **Batch 2 (primitive):** Coil — a discoverable Coil command + parametric CoilNode (Fusion's Coil/
  spring). Same helical-sweep kernel as Thread but presented as a spring with loose-turn defaults;
  previously the only access to a helix was the Thread primitive.
  _CORRECTION: `modify.array` already does 3D rectangular (X×Y×Z) AND circular patterns — patterns
  are comprehensive, not a gap._
  _Next steps: a freehand Sketch Arc tool; tangent/concentric constraints (need the solver to see arc
  centres — larger)._
- **CORRECTION — I/O is already comprehensive:** export covers STEP/IGES/BREP/STL/3MF/PLY/OBJ/GLTF/
  GLB/DXF/URDF; import covers STEP/IGES/BREP/STL/URDF. (Earlier inventory understated this.) The only
  real I/O gap is mesh import (OBJ/PLY/3MF/GLTF → mesh node), which needs a three.js loader.
- **Batch 7 (mesh, DONE for OBJ):** OBJ mesh import — a pure-TS Wavefront OBJ parser (no three.js
  dependency) → Mesh (surface) → MeshNode, wired into DefaultDataExchange (`.obj` added to import
  formats). Handles polygons (fan-triangulated), v/vt/vn face tokens, negative indices; computes
  per-vertex normals. Headless tests: a cube parses to 8 verts / 12 triangles. **ASCII PLY import**
  too (shared buildSurfaceMeshNode helper; binary PLY rejected gracefully). **3MF import** too (JSZip
  to open the package, order-independent regex parse of the `<model>` vertices/triangles). Mesh import
  now covers STL/OBJ/PLY/3MF — matching what the exporter supports. _Remaining: GLTF/binary PLY import,
  mesh→BRep, reduce/remesh._
- **Batch 11 (2D I/O):** DXF import — parses LINE/CIRCLE/ARC group-code entities into edges (XY plane)
  → compound EditableShapeNode (import 2D profiles to extrude; round-trips with the DXF export). Pure
  parser is headless-tested. **LWPOLYLINE** too (the common polyline entity; accumulates the repeated
  10/20 vertex codes, honours the closed flag, builds line segments). **Bulge arcs** too (code 42):
  a non-zero bulge curves the segment into an arc via the proven apex → computeArcFromPoints recipe
  (exported from app and reused). Headless test: bulge 1 = a radius-5 semicircle. **Full ELLIPSE
  entities** too (centre + major axis + ratio → shapeFactory.ellipse; partial ellipse arcs skipped).
  **SPLINE entities** now too (fit points preferred over control points → shapeFactory.interpolate;
  closed flag → periodic). DXF import covers LINE/CIRCLE/ARC/LWPOLYLINE(+bulge)/ELLIPSE/SPLINE — the
  full common DXF 2D entity set. Parser tests cover fit-point preference and control-point fallback.
- **Batch 1/3 (started):** Sketch Rectangle — two-corner rectangle created as a fully-constrained
  SketchNode (H/V edges + signed width/height dimensions), editable like a real sketch profile
  (vs the static create.rect face). Headless test: solves to an exact 30×20 rectangle.
- **Batch 3/reference (started):** Extract Edges / Extract Faces — combine a body's edges / faces
  into a reusable compound of reference geometry. Headless tests: a box yields exactly 12 edges / 6 faces.
- **Batch 6 (modify):** Non-uniform Scale — resize selection by independent X/Y/Z factors about each
  body's bbox centre (Fusion's non-uniform scale; uniform Scale already existed). Matrix test verifies
  a corner maps by per-axis factors.
- **Batch 6/11 (started):** Move to Origin — recentres the selection's combined world bbox at the
  origin (pure post-multiplied translation; pattern proven by a Matrix4 convention test). Create
  Bounding Box — an AABB box matching the selection's world extents (stock/extents utility).
  **Appearance** (Set Color + opacity) — applies a new material with a chosen colour (colour-picker
  property via `{ type: "color" }`) and opacity (< 1 = see-through) to the selection; Fusion's
  appearance override.
  _NOTE: zoom-fit (F) is already selection-aware (frames the selection when one exists) — no separate
  fit-to-selection needed. Deferred, need live verification: Align face-to-face, Replace-face
  (replaceSubShape is fragile — swaps raw topology), per-FACE (vs per-body) appearances._

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
