// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    evaluateExpression,
    type IApplication,
    type IDocument,
    type INode,
    type IService,
    type Node,
    ParameterStore,
    PubSub,
} from "@chili3d/core";

const documentOf = (node: INode): IDocument => (node as Node).document;

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
        if (document.userData === undefined) document.userData = {};
        const ud = document.userData as Record<string, unknown>;
        if (typeof ud["parameterBindings"] !== "object" || ud["parameterBindings"] === null) {
            ud["parameterBindings"] = {};
        }
        return ud["parameterBindings"] as Bindings;
    }

    bind(node: INode, property: string, expression: string): void {
        const b = this.bindings(documentOf(node));
        if (b[node.id] === undefined) b[node.id] = {};
        b[node.id][property] = expression;
        this.applyNode(node, property, expression);
    }

    unbind(node: INode, property: string): void {
        const b = this.bindings(documentOf(node));
        if (b[node.id]) {
            delete b[node.id][property];
            if (Object.keys(b[node.id]).length === 0) delete b[node.id];
        }
    }

    getBinding(node: INode, property: string): string | undefined {
        return this.bindings(documentOf(node))[node.id]?.[property];
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
        document.visual?.update?.();
    }

    private applyNode(node: INode, property: string, expression: string): void {
        const scope = new ParameterStore(documentOf(node)).resolve();
        if (scope.isOk) this.applyExpression(node, property, expression, scope.value);
    }

    private applyExpression(
        node: INode,
        property: string,
        expression: string,
        scope: Record<string, number>,
    ): void {
        const value = evaluateExpression(expression, scope);
        if (value.isOk && property in node) {
            (node as unknown as Record<string, unknown>)[property] = value.value;
        }
    }
}
