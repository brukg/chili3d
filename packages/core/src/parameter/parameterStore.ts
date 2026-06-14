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
        if (!this.document.userData) {
            this.document.userData = {};
        }
        const ud = this.document.userData as Record<string, unknown>;
        if (!Array.isArray(ud["parameters"])) {
            ud["parameters"] = [];
        }
        return ud["parameters"] as Parameter[];
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
