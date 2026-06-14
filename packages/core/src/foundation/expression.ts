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
    atan2: (a) => Math.atan2(a[0], a[1]),
    hypot: (a) => Math.hypot(...a),
    sign: (a) => Math.sign(a[0]),
    trunc: (a) => Math.trunc(a[0]),
    cbrt: (a) => Math.cbrt(a[0]),
    log10: (a) => Math.log10(a[0]),
    deg: (a) => (a[0] * 180) / Math.PI,
    rad: (a) => (a[0] * Math.PI) / 180,
    clamp: (a) => Math.min(Math.max(a[0], a[1]), a[2]),
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

/**
 * Safely evaluate an arithmetic expression (no `eval`/`Function`). Supports numbers, the operators
 * `+ - * / %`, unary `+`/`-`, parentheses, identifiers looked up in `scope`, the constants `pi`/`e`,
 * and the functions sin/cos/tan/asin/acos/atan/sqrt/abs/floor/ceil/round/exp/log/min/max/pow.
 */
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
            else if (r === 0) error = op === "/" ? "Division by zero" : "Modulo by zero";
            else if (op === "/") v /= r;
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

/** The parameter names an expression references (excluding built-in constants and functions). */
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
