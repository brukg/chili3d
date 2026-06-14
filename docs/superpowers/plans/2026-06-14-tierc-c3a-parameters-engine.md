# Tier C / C3a — Parameters + Expression Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`).

**Goal:** Named document parameters + a safe expression engine that drives body-node dimensions; changing a parameter regenerates dependent geometry. (C3a = engine only; UI is C3b.)

**Architecture:** Storage in `document.userData` (serialized as-is). Pure evaluator in `core`. A `ParameterService` resolves the scope on change and assigns bound node properties via their normal setters (which already trigger shape regen). Design: `docs/superpowers/specs/2026-06-14-tierc-c3a-parameters-engine-design.md`.

**Verified hooks:** `Result` at `packages/core/src/foundation/result.ts`; `IService` at `packages/core/src/service.ts`; services registered in `packages/builder/src/appBuilder.ts:171` `getServices()`; `PubSubEventMap` in `packages/core/src/foundation/pubsub.ts`; `document.modelManager.findNode(pred)`/`findNodes(pred)`; `INode.id`; `TestDocument` at `packages/core/test/testDocument.ts`; `BoxNode` (`@chili3d/core`? no — `@chili3d/app`) with `dx/dy/dz`. `document.userData: Record<string, unknown>` exists.

---

## UNIT A — Expression evaluator (pure, fully tested)

**Files:** Create `packages/core/src/foundation/expression.ts`, test `packages/core/test/expression.test.ts`.

### Task 1: Failing test
`packages/core/test/expression.test.ts`:
```ts
// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { describe, expect, test } from "@rstest/core";
import { evaluateExpression, expressionReferences } from "../src/foundation/expression";

const ok = (expr: string, scope = {}) => {
    const r = evaluateExpression(expr, scope);
    expect(r.isOk).toBe(true);
    return r.value;
};

describe("evaluateExpression", () => {
    test("numbers, precedence, parentheses, unary", () => {
        expect(ok("1")).toBe(1);
        expect(ok("2 + 3 * 4")).toBe(14);
        expect(ok("(2 + 3) * 4")).toBe(20);
        expect(ok("-5 + 2")).toBe(-3);
        expect(ok("10 % 3")).toBe(1);
        expect(ok("3.5 * 2")).toBe(7);
    });
    test("identifiers from scope", () => {
        expect(ok("width * 2", { width: 10 })).toBe(20);
        expect(ok("a + b", { a: 3, b: 4 })).toBe(7);
    });
    test("functions and constants", () => {
        expect(ok("sqrt(16)")).toBe(4);
        expect(ok("max(1, 2, 3)")).toBe(3);
        expect(ok("min(5, 2)")).toBe(2);
        expect(ok("pow(2, 10)")).toBe(1024);
        expect(ok("abs(-7)")).toBe(7);
        expect(ok("round(pi * 100) ")).toBe(314);
    });
    test("errors: syntax, unknown id, unknown fn, div by zero", () => {
        expect(evaluateExpression("2 +", {}).isOk).toBe(false);
        expect(evaluateExpression("foo + 1", {}).isOk).toBe(false);
        expect(evaluateExpression("nope(2)", {}).isOk).toBe(false);
        expect(evaluateExpression("1 / 0", {}).isOk).toBe(false);
        expect(evaluateExpression("(1 + 2", {}).isOk).toBe(false);
    });
    test("no code execution (safe)", () => {
        expect(evaluateExpression("constructor", {}).isOk).toBe(false);
        expect(evaluateExpression("1; 2", {}).isOk).toBe(false);
        expect(evaluateExpression("globalThis", {}).isOk).toBe(false);
    });
});

describe("expressionReferences", () => {
    test("returns referenced parameter names, excluding functions/constants", () => {
        expect(expressionReferences("width * 2 + height").sort()).toEqual(["height", "width"]);
        expect(expressionReferences("sqrt(area) + pi")).toEqual(["area"]);
        expect(expressionReferences("5 + 3")).toEqual([]);
        expect(expressionReferences("@@@")).toEqual([]);
    });
});
```
- [ ] Run `npx rstest packages/core/test/expression.test.ts` → FAIL (module not found).

### Task 2: Implement
`packages/core/src/foundation/expression.ts`:
```ts
// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { Result } from "./result";

const CONSTANTS: Record<string, number> = { pi: Math.PI, e: Math.E };

const FUNCTIONS: Record<string, (args: number[]) => number> = {
    sin: (a) => Math.sin(a[0]),
    cos: (a) => Math.cos(a[0]),
    tan: (a) => Math.tan(a[0]),
    asin: (a) => Math.asin(a[0]),
    acos: (a) => Math.acos(a[0]),
    atan: (a) => Math.atan(a[0]),
    sqrt: (a) => Math.sqrt(a[0]),
    abs: (a) => Math.abs(a[0]),
    floor: (a) => Math.floor(a[0]),
    ceil: (a) => Math.ceil(a[0]),
    round: (a) => Math.round(a[0]),
    exp: (a) => Math.exp(a[0]),
    log: (a) => Math.log(a[0]),
    min: (a) => Math.min(...a),
    max: (a) => Math.max(...a),
    pow: (a) => a[0] ** a[1],
};

type Token = { type: "num" | "id" | "op" | "lparen" | "rparen" | "comma"; value: string };

function tokenize(s: string): Token[] | undefined {
    const tokens: Token[] = [];
    let i = 0;
    while (i < s.length) {
        const c = s[i];
        if (c === " " || c === "\t") {
            i++;
        } else if (c >= "0" && c <= "9") {
            let j = i;
            while (j < s.length && ((s[j] >= "0" && s[j] <= "9") || s[j] === ".")) j++;
            tokens.push({ type: "num", value: s.slice(i, j) });
            i = j;
        } else if ((c >= "a" && c <= "z") || (c >= "A" && c <= "Z") || c === "_") {
            let j = i;
            while (
                j < s.length &&
                ((s[j] >= "a" && s[j] <= "z") ||
                    (s[j] >= "A" && s[j] <= "Z") ||
                    (s[j] >= "0" && s[j] <= "9") ||
                    s[j] === "_")
            )
                j++;
            tokens.push({ type: "id", value: s.slice(i, j) });
            i = j;
        } else if ("+-*/%".includes(c)) {
            tokens.push({ type: "op", value: c });
            i++;
        } else if (c === "(") {
            tokens.push({ type: "lparen", value: c });
            i++;
        } else if (c === ")") {
            tokens.push({ type: "rparen", value: c });
            i++;
        } else if (c === ",") {
            tokens.push({ type: "comma", value: c });
            i++;
        } else {
            return undefined;
        }
    }
    return tokens;
}

export function evaluateExpression(expression: string, scope: Record<string, number>): Result<number> {
    const tokens = tokenize(expression);
    if (!tokens) return Result.err(`Invalid characters in expression: "${expression}"`);
    if (tokens.length === 0) return Result.err("Empty expression");

    let pos = 0;
    let error: string | undefined;
    const peek = () => tokens[pos];
    const advance = () => tokens[pos++];

    const parseExpr = (): number => {
        let v = parseTerm();
        while (!error && peek()?.type === "op" && (peek().value === "+" || peek().value === "-")) {
            const op = advance().value;
            const r = parseTerm();
            v = op === "+" ? v + r : v - r;
        }
        return v;
    };
    const parseTerm = (): number => {
        let v = parseFactor();
        while (!error && peek()?.type === "op" && "*/%".includes(peek().value)) {
            const op = advance().value;
            const r = parseFactor();
            if (op === "*") v *= r;
            else if (r === 0) {
                error = op === "/" ? "Division by zero" : "Modulo by zero";
            } else if (op === "/") v /= r;
            else v %= r;
        }
        return v;
    };
    const parseFactor = (): number => {
        const t = peek();
        if (t?.type === "op" && (t.value === "-" || t.value === "+")) {
            advance();
            const v = parseFactor();
            return t.value === "-" ? -v : v;
        }
        return parsePrimary();
    };
    const parsePrimary = (): number => {
        const t = peek();
        if (!t) {
            error = "Unexpected end of expression";
            return 0;
        }
        if (t.type === "num") {
            advance();
            const n = Number(t.value);
            if (Number.isNaN(n)) error = `Invalid number: "${t.value}"`;
            return n;
        }
        if (t.type === "lparen") {
            advance();
            const v = parseExpr();
            if (peek()?.type !== "rparen") error = "Missing closing parenthesis";
            else advance();
            return v;
        }
        if (t.type === "id") {
            advance();
            const name = t.value;
            if (peek()?.type === "lparen") {
                advance();
                const args: number[] = [];
                if (peek()?.type !== "rparen") {
                    args.push(parseExpr());
                    while (!error && peek()?.type === "comma") {
                        advance();
                        args.push(parseExpr());
                    }
                }
                if (peek()?.type !== "rparen") error = "Missing closing parenthesis in function call";
                else advance();
                const fn = FUNCTIONS[name];
                if (!fn) {
                    error = `Unknown function: "${name}"`;
                    return 0;
                }
                return fn(args);
            }
            if (Object.hasOwn(CONSTANTS, name)) return CONSTANTS[name];
            if (Object.hasOwn(scope, name)) return scope[name];
            error = `Unknown identifier: "${name}"`;
            return 0;
        }
        error = `Unexpected token: "${t.value}"`;
        return 0;
    };

    const value = parseExpr();
    if (error) return Result.err(error);
    if (pos < tokens.length) return Result.err(`Unexpected token: "${peek().value}"`);
    if (!Number.isFinite(value)) return Result.err("Expression did not evaluate to a finite number");
    return Result.ok(value);
}

export function expressionReferences(expression: string): string[] {
    const tokens = tokenize(expression);
    if (!tokens) return [];
    const refs = new Set<string>();
    for (let i = 0; i < tokens.length; i++) {
        const t = tokens[i];
        if (t.type === "id" && tokens[i + 1]?.type !== "lparen" && !Object.hasOwn(CONSTANTS, t.value)) {
            refs.add(t.value);
        }
    }
    return [...refs];
}
```
VERIFY: export `expression` from the foundation barrel if there is one (`packages/core/src/foundation/index.ts`) AND from `packages/core/src/index.ts` (so `@chili3d/core` exposes `evaluateExpression`/`expressionReferences`) — match how `result.ts` is re-exported.
- [ ] `npx rstest packages/core/test/expression.test.ts` → PASS.
- [ ] `npm run check` (stage only the 2 files + any barrel edits). Commit: `git commit -m "✨ feat(core): add safe expression evaluator for parameters"`.

---

## UNIT B — ParameterStore (store + resolve, tested)

**Files:** Create `packages/core/src/parameter/parameterStore.ts`, `packages/core/src/parameter/index.ts`; test `packages/core/test/parameterStore.test.ts`. Wire `parametersChanged` into `pubsub.ts`. Export `parameter` from `packages/core/src/index.ts`.

### Task 3: Failing test
`packages/core/test/parameterStore.test.ts`:
```ts
// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { describe, expect, test } from "@rstest/core";
import { ParameterStore } from "../src/parameter/parameterStore";
import { TestDocument } from "./testDocument";

describe("ParameterStore", () => {
    test("set/get/list/remove round-trip through document.userData", () => {
        const doc = new TestDocument() as any;
        const store = new ParameterStore(doc);
        store.set("width", "50");
        store.set("height", "width * 2");
        expect(store.get("width")?.expression).toBe("50");
        expect(store.list().length).toBe(2);
        expect((doc.userData.parameters as any[]).length).toBe(2); // persisted in userData
        store.remove("width");
        expect(store.get("width")).toBeUndefined();
    });

    test("resolve evaluates chained references in dependency order", () => {
        const doc = new TestDocument() as any;
        const store = new ParameterStore(doc);
        store.set("a", "2");
        store.set("b", "a * 3");
        store.set("c", "b + 1");
        const scope = store.resolve();
        expect(scope.isOk).toBe(true);
        expect(scope.value).toEqual({ a: 2, b: 6, c: 7 });
    });

    test("resolve errors on cycles and unknown references", () => {
        const doc = new TestDocument() as any;
        const store = new ParameterStore(doc);
        store.set("a", "b");
        store.set("b", "a");
        expect(store.resolve().isOk).toBe(false);

        const doc2 = new TestDocument() as any;
        const store2 = new ParameterStore(doc2);
        store2.set("x", "missing + 1");
        expect(store2.resolve().isOk).toBe(false);
    });

    test("rejects invalid parameter names", () => {
        const doc = new TestDocument() as any;
        const store = new ParameterStore(doc);
        expect(store.set("2bad", "1").isOk).toBe(false);
        expect(store.set("good_name", "1").isOk).toBe(true);
    });
});
```
- [ ] Run → FAIL.

### Task 4: Implement `pubsub.ts` event + `parameterStore.ts`
- In `packages/core/src/foundation/pubsub.ts`, add to `PubSubEventMap` (keep alphabetical placement): `parametersChanged: (document: IDocument) => void;` (import type `IDocument` if not already imported there — check existing imports).
- `packages/core/src/parameter/parameterStore.ts`:
```ts
// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import type { IDocument } from "../document";
import { evaluateExpression, expressionReferences } from "../foundation/expression";
import { PubSub } from "../foundation/pubsub";
import { Result } from "../foundation/result";

export interface Parameter {
    name: string;
    expression: string;
}

const NAME_RE = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

export class ParameterStore {
    constructor(private readonly document: IDocument) {}

    private get raw(): Parameter[] {
        const ud = this.document.userData as Record<string, unknown>;
        if (!Array.isArray(ud.parameters)) ud.parameters = [];
        return ud.parameters as Parameter[];
    }

    list(): Parameter[] {
        return [...this.raw];
    }

    get(name: string): Parameter | undefined {
        return this.raw.find((p) => p.name === name);
    }

    set(name: string, expression: string): Result<void> {
        if (!NAME_RE.test(name)) return Result.err(`Invalid parameter name: "${name}"`);
        const existing = this.raw.find((p) => p.name === name);
        if (existing) existing.expression = expression;
        else this.raw.push({ name, expression });
        PubSub.default.pub("parametersChanged", this.document);
        return Result.ok(undefined);
    }

    remove(name: string): void {
        const arr = this.raw;
        const i = arr.findIndex((p) => p.name === name);
        if (i >= 0) {
            arr.splice(i, 1);
            PubSub.default.pub("parametersChanged", this.document);
        }
    }

    // Evaluate every parameter into a {name: value} scope, in dependency order.
    resolve(): Result<Record<string, number>> {
        const params = this.raw;
        const byName = new Map(params.map((p) => [p.name, p]));
        const scope: Record<string, number> = {};
        const visiting = new Set<string>();
        const done = new Set<string>();

        const visit = (name: string): Result<void> => {
            if (done.has(name)) return Result.ok(undefined);
            if (visiting.has(name)) return Result.err(`Parameter cycle involving "${name}"`);
            const p = byName.get(name);
            if (!p) return Result.err(`Unknown parameter: "${name}"`);
            visiting.add(name);
            for (const ref of expressionReferences(p.expression)) {
                const r = visit(ref);
                if (!r.isOk) return r;
            }
            visiting.delete(name);
            const val = evaluateExpression(p.expression, scope);
            if (!val.isOk) return Result.err(`Parameter "${name}": ${val.error}`);
            scope[name] = val.value;
            done.add(name);
            return Result.ok(undefined);
        };

        for (const p of params) {
            const r = visit(p.name);
            if (!r.isOk) return Result.err(r.error);
        }
        return Result.ok(scope);
    }
}
```
- `packages/core/src/parameter/index.ts`: `export * from "./parameterStore";`. Add `export * from "./parameter";` to `packages/core/src/index.ts` (match the existing export style/ordering).
VERIFY: the `IDocument` import path (`../document`); that `TestDocument` provides a writable `userData` (it extends the real `Document` which initializes `userData = {}` — confirm; if `TestDocument`'s userData is undefined, the `raw` getter's lazy init still works because it assigns `ud.parameters`). `Result.err(...).error` accessor exists.
- [ ] `npx rstest packages/core/test/parameterStore.test.ts` → PASS. Commit: `git commit -m "✨ feat(core): add ParameterStore with dependency-ordered resolve"`.

---

## UNIT C — ParameterService (propagation, tested + registered)

**Files:** Create `packages/app/src/services/parameterService.ts`, export from `packages/app/src/services/index.ts`; register in `packages/builder/src/appBuilder.ts`. Test `packages/app/test/parameterService.test.ts` (or `packages/core/test/` if app has no harness — see verify note).

### Task 5: Failing test
`packages/app/test/parameterService.test.ts` (mirror an existing app/core test's bootstrapping; it needs WASM to build a box):
```ts
// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { readFileSync } from "node:fs";
import path from "node:path";
import { ParameterStore, Plane } from "@chili3d/core";
import { initWasm, ShapeFactory } from "@chili3d/wasm";
import { describe, expect, test } from "@rstest/core";
import { BoxNode } from "../src/bodys/box";
import { ParameterService } from "../src/services/parameterService";
import { TestDocument } from "../../core/test/testDocument";

const WASM_BINARY = readFileSync(path.join(process.cwd(), "packages/wasm/lib/chili-wasm.wasm"));

describe("ParameterService", () => {
    test("a parameter change updates a bound node dimension and regenerates the shape", async () => {
        await initWasm({ wasmBinary: WASM_BINARY });
        // Ensure the global shapeFactory is available for BoxNode.generateShape().
        const { setCurrentApplication } = await import("@chili3d/core");
        setCurrentApplication({ shapeFactory: new ShapeFactory() } as any);

        const doc = new TestDocument() as any;
        const box = new BoxNode({ document: doc, plane: Plane.XY, dx: 1, dy: 1, dz: 1 });
        doc.modelManager.rootNode.add(box);

        const service = new ParameterService();
        const store = new ParameterStore(doc);
        store.set("width", "10");

        service.bind(box, "dx", "width * 2");
        expect(box.dx).toBe(20); // applied immediately

        store.set("width", "25"); // pub parametersChanged → service re-applies
        service.applyAll(doc); // (deterministic trigger for the test)
        expect(box.dx).toBe(50);
    });
});
```
- [ ] Run → FAIL.

### Task 6: Implement `ParameterService`
`packages/app/src/services/parameterService.ts`:
```ts
// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    type IApplication,
    type IDocument,
    type INode,
    type IService,
    ParameterStore,
    PubSub,
} from "@chili3d/core";

type Bindings = Record<string, Record<string, string>>; // nodeId -> { property -> expression }

export class ParameterService implements IService {
    private app?: IApplication;

    register(app: IApplication): void {
        this.app = app;
    }
    start(): void {
        PubSub.default.sub("parametersChanged", this.onParametersChanged);
    }
    stop(): void {
        PubSub.default.remove("parametersChanged", this.onParametersChanged);
    }

    private readonly onParametersChanged = (document: IDocument) => {
        this.applyAll(document);
    };

    private bindings(document: IDocument): Bindings {
        const ud = document.userData as Record<string, unknown>;
        if (typeof ud.parameterBindings !== "object" || ud.parameterBindings === null) {
            ud.parameterBindings = {};
        }
        return ud.parameterBindings as Bindings;
    }

    bind(node: INode, property: string, expression: string): void {
        const b = this.bindings(node.document);
        (b[node.id] ??= {})[property] = expression;
        this.applyNode(node, property, expression);
    }

    unbind(node: INode, property: string): void {
        const b = this.bindings(node.document);
        if (b[node.id]) {
            delete b[node.id][property];
            if (Object.keys(b[node.id]).length === 0) delete b[node.id];
        }
    }

    getBinding(node: INode, property: string): string | undefined {
        return this.bindings(node.document)[node.id]?.[property];
    }

    applyAll(document: IDocument): void {
        const scope = new ParameterStore(document).resolve();
        if (!scope.isOk) {
            PubSub.default.pub("showToast", "error.default:{0}", scope.error);
            return;
        }
        const b = this.bindings(document);
        for (const nodeId of Object.keys(b)) {
            const node = document.modelManager.findNode((n) => n.id === nodeId);
            if (!node) {
                delete b[nodeId]; // orphan cleanup
                continue;
            }
            for (const [property, expression] of Object.entries(b[nodeId])) {
                this.applyExpression(node, property, expression, scope.value);
            }
        }
        document.visual.update();
    }

    private applyNode(node: INode, property: string, expression: string): void {
        const scope = new ParameterStore(node.document).resolve();
        if (scope.isOk) this.applyExpression(node, property, expression, scope.value);
    }

    private applyExpression(
        node: INode,
        property: string,
        expression: string,
        scope: Record<string, number>,
    ): void {
        // evaluateExpression is re-exported from core
        const { evaluateExpression } = require("@chili3d/core") as typeof import("@chili3d/core");
        const value = evaluateExpression(expression, scope);
        if (value.isOk && property in node) {
            (node as unknown as Record<string, unknown>)[property] = value.value;
        }
    }
}
```
VERIFY: do NOT use `require` if the codebase is ESM-only — instead `import { evaluateExpression }` at the top from `@chili3d/core` (the plan shows `require` only as a fallback; prefer the static import — add `evaluateExpression` to the import list and delete the inline `require`). Confirm `INode` has `document` and `id`. Confirm `setCurrentApplication` exists in `@chili3d/core` (the thread/rib UI tests used it). Confirm `node[property] = value` triggers the setter (for `BoxNode.dx` it does → `setPropertyEmitShapeChanged`).
- Export from `packages/app/src/services/index.ts`: `export * from "./parameterService";`.
- Register in `packages/builder/src/appBuilder.ts`: import `ParameterService` and add `new ParameterService()` to the `getServices()` array.
- [ ] `npx rstest packages/app/test/parameterService.test.ts` → PASS (if the cross-package `../../core/test/testDocument` import doesn't resolve, mirror how `packages/wasm/test/threadNode.test.ts` or `packages/builder/test/urdfExporter.test.ts` import `TestDocument`).
- [ ] `npm run build 2>&1 | grep -iE "error TS|ERROR in" | head` → clean. Commit: `git commit -m "✨ feat(app): add ParameterService propagating parameters to bound node dimensions"`.

---

## Self-Review
- **Spec coverage:** evaluator §3.1 → Unit A; store+resolve §3.2 → Unit B; service+propagation §3.3 → Unit C; storage in userData §2 (no model/version change); errors §5 (Result + toast). ✅
- **No placeholders:** evaluator is complete; store/service complete. The one flagged choice (static import vs `require` for `evaluateExpression`) has an explicit instruction: prefer static import.
- **Type consistency:** `evaluateExpression(expr, scope): Result<number>`, `expressionReferences(expr): string[]`, `ParameterStore.set(name, expr): Result<void>` / `resolve(): Result<Record<string,number>>`, `ParameterService.bind(node, property, expression)` — identical across tasks.
- **v1 limits (don't fix here):** no UI (C3b), no undo/redo of parameter edits, bindings keyed by nodeId in userData (copy/paste won't carry them), no feature-to-feature refs (C1).
