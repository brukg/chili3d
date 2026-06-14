# Tier C / C1 — Referential Features + Rebuild Engine (Design)

**Date:** 2026-06-14
**Status:** Approved (standing "continue, you are the expert" authorization).
**Scope:** The keystone of Tier C, delivered as a working, **additive, opt-in** slice (not a forced migration of every feature, no serialization-version bump). A feature node can **reference its input nodes by id** instead of baking a frozen result shape; when an upstream input's shape changes, the feature **rebuilds automatically**, cascading transitively. Proven by a referential boolean feature + headless tests.

This is the de-risking spike AND a real deliverable: it proves a feature-dependency rebuild graph coexists with the current destructive-modify model.

---

## 1. Mechanism (rides the existing observable system)
`ShapeNode.setShape` calls `setProperty("shape", …)`, which emits a `"shape"` `propertyChanged`. So a referential node simply **subscribes to each input node's `"shape"` change** and regenerates itself. Its own regen emits *its* `"shape"` change → ITS dependents rebuild. The dependency graph emerges from subscriptions; topological order is implicit in the propagation chain (A→B→C rebuilds in order). A reentrancy guard prevents cycles from looping. **No separate graph/engine object, no version bump** — the new `inputIds` field is additive.

## 2. Components

### 2.1 `ReferenceShapeNode` — `packages/core/src/model/referenceShapeNode.ts`
`abstract class ReferenceShapeNode extends ParameterShapeNode`:
- `@serialize() get inputIds(): string[]` — referenced input node ids.
- Constructor `{ document, inputIds, materialId?, id? }` → stores `inputIds`, then `subscribeInputs()`.
- `protected resolveInputShapes(): IShape[]` — for each id, `document.modelManager.findNode(n => n.id === id)`; if it is a `ShapeNode` with an ok shape, push `shape.value.transformedMul(node.transform)` (world placement).
- `subscribeInputs()` — resolve each input node; `node.onPropertyChanged(handler)` where the handler regenerates this node when `property === "shape"`. Idempotent (unsubscribe first). Public so a service can re-wire after document load.
- `private rebuild()` — guarded by `_rebuilding` flag; `this.setShape(this.generateShape())`.
- `override disposeInternal()` — unsubscribe, then `super`.

### 2.2 `LinkedBooleanNode` — `packages/app/src/bodys/linkedBoolean.ts`
`extends ReferenceShapeNode`; `@serialize() @property("linkedBoolean.type") booleanType: "common"|"cut"|"fuse"`. `generateShape()` resolves input shapes (≥2 required) and calls `shapeFactory.booleanCut/Fuse/Common`. `display()` → `"body.linkedBoolean"`.

### 2.3 `Linked Boolean` command — `packages/app/src/commands/modify/linkedBoolean.ts`
A `MultistepCommand` (mirrors `boolean.ts`) that selects ≥2 shapes but, unlike the destructive boolean, **keeps the input nodes** and creates a `LinkedBooleanNode` referencing their ids. Subclasses `LinkedCut`/`LinkedFuse`/`LinkedCommon` (or one command + type). Ribbon (Boolean group) + i18n.

### 2.4 `RebuildService` — `packages/app/src/services/rebuildService.ts`
An `IService` that, on document load (and document-changed), walks `modelManager.findNodes(n => n instanceof ReferenceShapeNode)` and calls `subscribeInputs()` on each — re-wiring subscriptions that the constructor set for freshly-created nodes but that the serializer (which bypasses constructors) does not. Registered in `AppBuilder.getServices()`.

## 3. Data flow
`edit upstream BoxNode.dx → setPropertyEmitShapeChanged → setShape → emits "shape" change → ReferenceShapeNode's subscribed handler → rebuild() → generateShape() (re-reads input shapes) → setShape → emits "shape" → cascades to further dependents → visual.update.`

## 4. Error handling / edges
- Missing input (deleted node) → `resolveInputShapes` skips it; `generateShape` returns `Result.err` if < 2 → shape unchanged + error surfaced; the stale result remains (no crash).
- Reentrancy / cycles → `_rebuilding` guard.
- Dispose → unsubscribe (no leaks / no rebuilds on dead nodes).

## 5. Testing (headless, real WASM)
- Build doc; `BoxNode` A (20³) + `BoxNode` B (10³, overlapping) added to `modelManager`; `LinkedBooleanNode([A.id, B.id], "cut")`. Assert `generateShape().isOk` and volume ≈ A − overlap.
- **Rebuild proof:** change `A.dx` (bigger) → assert the linked node's shape regenerated (volume increased) WITHOUT manually calling generateShape — i.e. the subscription fired.
- **Transitive:** `LinkedBooleanNode` C referencing the first linked node + another box; editing A cascades to C.
- Reentrancy guard: editing an input doesn't infinite-loop.

## 6. Files
| File | Action |
|------|--------|
| `packages/core/src/model/referenceShapeNode.ts` | Create |
| `packages/core/src/model/index.ts` / core index | Export |
| `packages/core/test/referenceShapeNode.test.ts` | Create (rebuild proof) |
| `packages/app/src/bodys/linkedBoolean.ts` | Create + export |
| `packages/app/src/commands/modify/linkedBoolean.ts` | Create + export |
| `packages/app/src/services/rebuildService.ts` | Create + export + register |
| `ribbon.ts` + i18n (`keys.ts`, en/zh-cn/pt-br) | Wire |

## 7. Out of scope (later C1 / C2 / C4)
Migrating all existing destructive features to referential (this is opt-in via new linked features); the editable feature timeline UI (C2); global suppress/reorder; constraint sketcher (C4). No serialization-version bump (additive fields only).
