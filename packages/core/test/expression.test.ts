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
        expect(ok("round(pi * 100)")).toBe(314);
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
