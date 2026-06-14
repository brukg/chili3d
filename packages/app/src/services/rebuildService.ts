// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { type IApplication, type IService, type IView, PubSub, ReferenceShapeNode } from "@chili3d/core";

/**
 * Re-wires referential-feature subscriptions after a document load. The serializer bypasses
 * constructors, so `ReferenceShapeNode`s restored from storage never ran `subscribeInputs()` and
 * would not rebuild when their inputs change. When a view becomes active this service walks the
 * document and re-subscribes every restored `ReferenceShapeNode`.
 */
export class RebuildService implements IService {
    register(_app: IApplication): void {}

    start(): void {
        PubSub.default.sub("activeViewChanged", this.onActiveViewChanged);
    }

    stop(): void {
        PubSub.default.remove("activeViewChanged", this.onActiveViewChanged);
    }

    private readonly onActiveViewChanged = (view: IView | undefined) => {
        if (!view) return;
        const document = view.document;
        const nodes = document.modelManager.findNodes((n) => n instanceof ReferenceShapeNode);
        for (const node of nodes) {
            (node as ReferenceShapeNode).subscribeInputs();
        }
    };
}
