# Tier C / C3a — Global Parameters + Expression Engine (Design)

**Date:** 2026-06-14
**Status:** Approved (proceeding under standing "continue, you are the expert" authorization).
**Scope:** The first deliverable slice of Tier C. A document-level set of **named parameters** (e.g. `width = 50`, `height = width * 2`) and an **expression engine** so a body-node's numeric property (e.g. a box's `dx`) can be driven by an expression of those parameters. Changing a parameter re-evaluates dependents and regenerates the affected geometry.

This is **C3a — the engine** (evaluator + store + service + propagation), fully headless-testable. **C3b — UI** (parameters panel + expression input in property fields) is a separate follow-up sub-project.

---

## 1. Why this can ship before C1
Chili3D already has the reactive machinery: a body node's property setter calls `setPropertyEmitShapeChanged`, which regenerates that node's shape. So "parameter changes → dimension updates → geometry rebuilds" rides the existing system. The full feature-dependency DAG (C1) is only needed for feature-to-feature references (e.g. a fillet that tracks an extrude's face); parameter-driven *dimensions* — the highest-value, most-requested parametric capability — do not need it.

## 2. Architecture (additive — no core model changes)
- **Storage in `document.userData`** (already serialized verbatim by `Document.serialize()`): no `IDocument` change, no node-class change, no serialization-version bump.
  - `userData.parameters: { name: string; expression: string }[]` — ordered named parameters.
  - `userData.parameterBindings: { [nodeId: string]: { [propertyName: string]: string } }` — which node properties are expression-driven.
- **`evaluateExpression(expr, scope)`** — pure, safe evaluator in `core` (no `eval`).
- **`ParameterStore`** — a thin wrapper over `userData` (CRUD + `resolve()` to a `{name: value}` scope with cycle detection), publishing a `parametersChanged` event.
- **`ParameterService`** (`IService`) — on `parametersChanged` (and on document load), resolves the scope and applies every binding: evaluates the expression and assigns the node's numeric property via its normal setter (→ regen).

## 3. Components

### 3.1 Expression evaluator — `packages/core/src/foundation/expression.ts`
- `evaluateExpression(expression: string, scope: Record<string, number>): Result<number>` — recursive-descent parser/evaluator. Grammar: decimal numbers; identifiers (looked up in `scope`); binary `+ - * / %`; unary `-`/`+`; parentheses; function calls `f(args...)`; constants. Built-ins: `pi`, `e`, `sin cos tan asin acos atan sqrt abs floor ceil round min max pow log exp` (degrees-agnostic — radians, matching Math). Returns `Result.err` on syntax error, unknown identifier/function, or arity mismatch. No `eval`/`Function`.
- `expressionReferences(expression: string): string[]` — the identifier names referenced (excluding built-in functions/constants), for dependency ordering. Tolerant: returns `[]` on parse failure.

### 3.2 Parameter store — `packages/core/src/parameter/parameterStore.ts`
- `class ParameterStore { constructor(document: IDocument) }` reading/writing `document.userData.parameters` (creating the array lazily).
- `list(): Parameter[]`; `get(name): Parameter | undefined`; `set(name, expression)` (add or update, validates name is a legal identifier); `remove(name)`; each mutator pubs `parametersChanged`.
- `resolve(): Result<Record<string, number>>` — evaluate all parameters in dependency order via `expressionReferences` (Kahn topological sort); **cycle → `Result.err`**; unknown reference → `Result.err` naming the parameter.
- `Parameter = { name: string; expression: string }`. A parameter's `expression` may be a literal (`"50"`) or reference other parameters (`"width*2"`).

### 3.3 Parameter service — `packages/app/src/services/parameterService.ts`
- `class ParameterService implements IService` — `register/start/stop`. On `start`, subscribes to `parametersChanged` and `documentChanged`/active-document; `applyAll(document)` resolves the scope and, for each `nodeId → {prop: expr}` in `parameterBindings`, finds the node (`document.modelManager`), evaluates the expression against the scope, and assigns `node[prop] = value` (its setter regenerates the shape). Orphaned bindings (node gone) are skipped/cleaned. On resolve error, pub a toast and skip (don't crash).
- Helper API used by C3b/commands: `bind(node, property, expression)` (store binding + apply now), `unbind(node, property)`, `getBinding(node, property)`.

## 4. Data flow
`user edits parameter → ParameterStore.set → pub parametersChanged → ParameterService.applyAll → ParameterStore.resolve() scope → for each binding: evaluateExpression(expr, scope) → node[prop] = value → setPropertyEmitShapeChanged → generateShape → visual update.`

## 5. Error handling
- Syntax error / unknown identifier / unknown function / arity error → `Result.err` (evaluator); surfaced as a toast by the service, geometry left unchanged.
- Parameter cycle (`a=b, b=a`) → `resolve()` errs; service toasts and makes no changes.
- Binding to a non-existent node or property → skipped silently (orphan cleanup).
- Division by zero → `Result.err`.

## 6. Testing (C3a, headless)
- **Evaluator:** numbers, precedence (`2+3*4==14`), parentheses, unary minus, `%`, functions (`sqrt(16)==4`, `max(1,2,3)==3`), constants (`pi`), identifier lookup from scope, and error cases (syntax, unknown id, unknown function, div-by-zero). No-`eval` safety (e.g. `"constructor"` / `"1;2"` reject).
- **ParameterStore:** set/get/remove round-trip through `userData`; `resolve()` with chained refs (`a=2, b=a*3, c=b+1 → {a:2,b:6,c:7}`); cycle detection errs; unknown-ref errs.
- **Service propagation:** build a `TestDocument` + a `BoxNode`; `bind(box, "dx", "width*2")`, set `width=10`, trigger `applyAll`; assert `box.dx === 20` and the shape regenerated (volume reflects it). Change `width` → `box.dx` updates.

## 7. Files
| File | Action |
|------|--------|
| `packages/core/src/foundation/expression.ts` | Create (evaluator + references) |
| `packages/core/test/expression.test.ts` | Create |
| `packages/core/src/parameter/parameterStore.ts` | Create (store + resolve) |
| `packages/core/src/parameter/index.ts` + `core` index export | Create/wire |
| `packages/core/test/parameterStore.test.ts` | Create |
| `packages/app/src/services/parameterService.ts` | Create (IService + propagation) |
| `packages/app/src/services/index.ts` | Export |
| `packages/app/test/parameterService.test.ts` | Create |
| `packages/core/src/foundation/pubsub.ts` | Add `parametersChanged` event |
| `AppBuilder` services registration | Register `ParameterService` |

## 8. Out of scope (→ C3b / later)
Parameters panel UI; typing expressions directly into property-panel fields; undo/redo of parameter edits (v1 mutates `userData` directly — not history-tracked); copy/paste carrying bindings; feature-to-feature references (that is C1).
