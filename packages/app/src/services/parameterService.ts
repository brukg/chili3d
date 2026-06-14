// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    evaluateExpression,
    type IApplication,
    type IDocument,
    type INode,
    type IService,
    type Node,
    ParameterBindings,
    ParameterStore,
    PubSub,
} from "@chili3d/core";

const documentOf = (node: INode): IDocument => (node as Node).document;

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

    bind(node: INode, property: string, expression: string): void {
        new ParameterBindings(documentOf(node)).set(node.id, property, expression);
        this.applyNode(node, property, expression);
    }

    unbind(node: INode, property: string): void {
        new ParameterBindings(documentOf(node)).remove(node.id, property);
    }

    getBinding(node: INode, property: string): string | undefined {
        return new ParameterBindings(documentOf(node)).get(node.id, property);
    }

    applyAll(document: IDocument): void {
        const scope = new ParameterStore(document).resolve();
        if (!scope.isOk) {
            PubSub.default.pub("showToast", "error.default:{0}", scope.error);
            return;
        }
        const bindings = new ParameterBindings(document);
        for (const { nodeId, property, expression } of bindings.entries()) {
            const node = document.modelManager.findNode((n) => n.id === nodeId);
            if (!node) {
                bindings.remove(nodeId, property); // orphan cleanup
                continue;
            }
            this.applyExpression(node, property, expression, scope.value);
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
