// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import type { IDocument } from "../document";

type Bindings = Record<string, Record<string, string>>; // nodeId -> { property -> expression }

export interface ParameterBindingEntry {
    nodeId: string;
    property: string;
    expression: string;
}

export class ParameterBindings {
    constructor(private readonly document: IDocument) {}

    private get raw(): Bindings {
        if (this.document.userData === undefined) {
            this.document.userData = {};
        }
        const ud = this.document.userData as Record<string, unknown>;
        if (typeof ud["parameterBindings"] !== "object" || ud["parameterBindings"] === null) {
            ud["parameterBindings"] = {};
        }
        return ud["parameterBindings"] as Bindings;
    }

    get(nodeId: string, property: string): string | undefined {
        return this.raw[nodeId]?.[property];
    }

    set(nodeId: string, property: string, expression: string): void {
        const b = this.raw;
        if (b[nodeId] === undefined) {
            b[nodeId] = {};
        }
        b[nodeId][property] = expression;
    }

    remove(nodeId: string, property: string): void {
        const b = this.raw;
        if (b[nodeId] !== undefined) {
            delete b[nodeId][property];
            if (Object.keys(b[nodeId]).length === 0) {
                delete b[nodeId];
            }
        }
    }

    entries(): ParameterBindingEntry[] {
        const b = this.raw;
        const result: ParameterBindingEntry[] = [];
        for (const nodeId of Object.keys(b)) {
            for (const [property, expression] of Object.entries(b[nodeId])) {
                result.push({ nodeId, property, expression });
            }
        }
        return result;
    }
}
