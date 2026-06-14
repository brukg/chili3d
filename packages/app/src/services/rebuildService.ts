// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    type IApplication,
    type IDocument,
    type IService,
    type IView,
    type NodeRecord,
    PubSub,
    ReferenceShapeNode,
} from "@chili3d/core";

/**
 * Keeps referential features (C1) in sync with the model:
 *  - after a document load, re-subscribes every restored `ReferenceShapeNode` (the serializer
 *    bypasses the constructor that wires `subscribeInputs()`);
 *  - when a referenced input node is REMOVED from the model, force-rebuilds its dependents (the
 *    per-input `shape` listeners don't fire on structural removal).
 */
export class RebuildService implements IService {
    private readonly observed = new Set<IDocument>();

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
        for (const node of document.modelManager.findNodes((n) => n instanceof ReferenceShapeNode)) {
            (node as ReferenceShapeNode).subscribeInputs();
        }
        if (!this.observed.has(document)) {
            this.observed.add(document);
            document.modelManager.addNodeObserver((records) => this.onNodesChanged(document, records));
        }
    };

    private onNodesChanged(document: IDocument, records: NodeRecord[]): void {
        const removedIds = records.filter((r) => r.action === "remove").map((r) => r.node.id);
        if (removedIds.length === 0) return;
        const dependents = document.modelManager.findNodes(
            (n) =>
                n instanceof ReferenceShapeNode &&
                (n as ReferenceShapeNode).inputIds.some((id) => removedIds.includes(id)),
        );
        for (const dependent of dependents) {
            (dependent as ReferenceShapeNode).forceRebuild();
        }
    }
}
