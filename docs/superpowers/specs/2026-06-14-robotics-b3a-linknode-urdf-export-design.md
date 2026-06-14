# Robotics B3a — LinkNode + URDF Export (Design)

**Date:** 2026-06-14
**Status:** Approved design.
**Scope:** First half of Tier B's URDF round-trip. Introduce an explicit `LinkNode` and export the Link/Joint kinematic tree to a URDF ZIP (`.urdf` + per-link STL meshes). The inverse — **B3b URDF import** — is a separate sub-project that targets the model and mapping this spec defines.

---

## 1. Goal & scope

Author a kinematic robot in chili3d as a tree of named links connected by joints, then export it to a standard URDF package that loads in ROS / RViz / Isaac / MuJoCo.

**In scope (B3a):** `LinkNode`, a "Create Link" command, a `UrdfExporter` (tree → URDF XML + per-link STL), ZIP packaging, registration as a `.urdf` export format, and a headless exporter test.

**Deferred:** URDF import (B3b); SRDF/planning groups; per-link explicit collision meshes distinct from visual; full dynamics tuning; Xacro.

---

## 2. Why explicit links (not inferred)

Round-trip requires that link names/identity survive export→import. Inferred links (from geometry grouping) lose stable identity on re-import. So B3a introduces an explicit `LinkNode`; the user marks rigid bodies with **Create Link** and connects them with **Create Joint** (B1). The authored tree is `parentLink → joint → childLink`.

---

## 3. Components

### 3.1 `LinkNode` — `packages/core/src/model/linkNode.ts`
`@serializable() class LinkNode extends GroupNode`. A named container for one rigid body's geometry (its direct geometry children are the link's visual). Adds an optional `@property @serialize() mass: number` (default 1) used for `<inertial>`. No `display()` (GroupNode has none; the tree shows `name`). Exported from `core/src/model/index.ts`.

### 3.2 "Create Link" command — `packages/app/src/commands/modify/createLink.ts`
Key `modify.createLink`. Wraps the selected node(s) in a new `LinkNode` (reparent), mirroring `createJoint.ts`'s `insertBefore` + `move`. Default name `"Link"`. Added to the Modify ribbon group + i18n (en/zh-cn/pt-br: `command.modify.createLink`, `link.mass`).

### 3.3 `UrdfExporter` — `packages/builder/src/urdf/urdfExporter.ts`
Pure function over the model tree; no DOM. Produces `{ urdf: string, meshes: Map<string, Uint8Array> }`.

**Tree walk:** the top `LinkNode` under the exported root is `base_link`. For a `LinkNode` L: its direct geometry descendants (down to the next `JointNode`) form L's visual mesh; each `JointNode` child J connects L (parent) → J's child `LinkNode` (child); recurse into the child link.

**`<link name>`** per `LinkNode`:
- `<visual><geometry><mesh filename="meshes/<name>.stl" scale="0.001 0.001 0.001"/></geometry></visual>`
- `<collision>` identical mesh.
- `<inertial>`: `<mass value="<mass>"/>` + a diagonal box-approximation inertia from the link's bounding box (`ixx = m/12·(dy²+dz²)`, etc., in metres), `<origin>` at the bbox centre. Non-degenerate (satisfies the roboforge checklist).

**`<joint name type>`** per `JointNode`:
- type: `revolute`→`revolute`, `continuous`→`continuous`, `prismatic`→`prismatic`, `fixed`→`fixed`.
- `<parent link="<parentLinkName>"/>`, `<child link="<childLinkName>"/>`.
- `<origin xyz="..." rpy="..."/>`: `joint.origin.translationPart()` × 0.001 (mm→m) for xyz; `joint.origin.getEulerAngles()` → `rpy` (roll pitch yaw, radians).
- `<axis xyz="<unit axis>"/>` (the joint axis; unit, dimensionless).
- `<limit lower upper effort velocity/>`: revolute/continuous → `deg→rad`; prismatic → `mm→m`; `effort`/`velocity` default constants (e.g. 100 / 10) since B1 doesn't model them. `fixed` omits `<limit>`/`<axis>`.

**Per-link mesh:** `shapeFactory.converter.convertToSTL(linkShapes, { binary: true })` → `meshes/<name>.stl`. Link/joint names are sanitized (unique, URDF-safe identifiers).

### 3.4 Packaging + wiring — `packages/builder/src/defaultDataExchange.ts`
Add `.urdf` to `exportFormats()`. In `export()`, when `type === ".urdf"`: run `UrdfExporter`, then **jszip** packs `robot.urdf` + `meshes/*.stl` into one `.zip`; return its bytes as a `BlobPart`. The export command downloads it as `<name>.zip`.

---

## 4. Units (critical)
URDF = **metres + radians**; chili3d = **mm + degrees**. Conversions, applied consistently:
- Joint/link origin xyz, prismatic limits, inertia lengths: **× 0.001** (mm→m).
- Revolute/continuous limits + values, rpy: **deg→rad**.
- Mesh STL stays in mm; URDF `<mesh scale="0.001 0.001 0.001">` scales it to metres.

---

## 5. Error handling & edge cases
- No `LinkNode` in the selection → export returns an error/toast ("no links to export").
- A `JointNode` whose parent or child isn't a `LinkNode` → skip with a warning (URDF joints connect links).
- Name collisions → sanitize + suffix to keep link/joint names unique and URDF-valid.
- A link with no geometry → emit the link without `<visual>`/`<collision>` (kinematic-only) rather than failing.

---

## 6. Testing
Headless (Rstest), no ROS:
- Build `base_link (LinkNode + box) → revolute JointNode(axis Z, origin (100,0,0)mm, limits ±90°) → child_link (LinkNode + box)` programmatically.
- Export; assert the URDF string contains `<link name="base_link">`, `<link name="...child...">`, `<joint ... type="revolute">` with correct `<parent>`/`<child>`, `<origin xyz="0.1 0 0" .../>` (metres), `<axis xyz="0 0 1"/>`, `<limit lower="-1.5708" upper="1.5708" .../>` (radians, within tolerance).
- Assert `meshes` map has an STL entry per link with non-empty bytes.
- A unit test for the name-sanitizer and the mm→m / deg→rad conversions.
(ROS `check_urdf` + RViz sweep is the manual follow-up per `roboforge:urdf-and-kinematics-changes`.)

---

## 7. Files
| File | Action |
|------|--------|
| `packages/core/src/model/linkNode.ts` | Create (`LinkNode`) |
| `packages/core/src/model/index.ts` | Export |
| `packages/app/src/commands/modify/createLink.ts` | Create command |
| `packages/app/src/commands/modify/index.ts` + `packages/builder/src/ribbon.ts` | Register |
| `packages/core/src/i18n/keys.ts` + en/zh-cn/pt-br | `command.modify.createLink`, `link.mass` |
| `packages/builder/src/urdf/urdfExporter.ts` | Create (tree → URDF + meshes) |
| `packages/builder/test/urdfExporter.test.ts` | Create (headless test) |
| `packages/builder/src/defaultDataExchange.ts` | `.urdf` format + zip wiring |

---

## 8. Decomposition note
B3a (this) = LinkNode + export. **B3b** = URDF import (parse `.urdf` + meshes → Link/Joint tree), the inverse against the mapping fixed here. Each is its own spec → plan → build cycle.
