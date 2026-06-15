// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    command,
    type IApplication,
    type ICommand,
    type INode,
    type INodeLinkedList,
    NodeUtils,
    PubSub,
    Transaction,
} from "@chili3d/core";

// Module-level clipboard shared between the cut and paste commands. It holds the top-level nodes
// captured by the last cut so a node can be reparented by keyboard (Ctrl+X then Ctrl+V on the
// destination) instead of dragging across a large project tree.
let clipboard: INode[] = [];

@command({
    key: "modify.cutNode",
    icon: "icon-delete",
})
export class CutNode implements ICommand {
    async execute(app: IApplication): Promise<void> {
        const document = app.activeView?.document;
        if (!document) return;

        const selected = document.selection.getSelectedNodes();
        if (selected.length === 0) {
            PubSub.default.pub("showToast", "toast.select.noSelected");
            return;
        }

        clipboard = NodeUtils.findTopLevelNodes(new Set(selected));
        PubSub.default.pub("showToast", "toast.cut{0}Objects", clipboard.length);
    }
}

@command({
    key: "modify.pasteNode",
    icon: "icon-clone",
})
export class PasteNode implements ICommand {
    async execute(app: IApplication): Promise<void> {
        const document = app.activeView?.document;
        if (!document) return;

        if (clipboard.length === 0) {
            PubSub.default.pub("showToast", "toast.clipboard.empty");
            return;
        }

        const selected = document.selection.getSelectedNodes();
        if (selected.length === 0) {
            PubSub.default.pub("showToast", "toast.paste.noTarget");
            return;
        }

        // The new parent is the selected node when it can hold children, otherwise the selected
        // node's parent (so pasting "onto" a leaf drops the nodes alongside it).
        const target = selected[0];
        const newParent: INodeLinkedList | undefined = NodeUtils.isLinkedListNode(target)
            ? target
            : target.parent;
        if (!newParent) return;

        // A node cannot be pasted into itself or one of its own descendants — that would detach the
        // moved subtree from the document.
        const movable = clipboard.filter((node) => !isSelfOrAncestor(node, newParent));
        if (movable.length === 0) {
            PubSub.default.pub("showToast", "toast.paste.invalidTarget");
            return;
        }

        document.selection.clearSelection();
        Transaction.execute(document, "paste node", () => {
            movable.forEach((node) => {
                node.parent?.move(node, newParent);
            });
        });
        clipboard = [];
        document.visual.update();
        PubSub.default.pub("showToast", "toast.paste{0}Objects", movable.length);
    }
}

function isSelfOrAncestor(node: INode, candidate: INode): boolean {
    let current: INode | undefined = candidate;
    while (current) {
        if (current === node) return true;
        current = current.parent;
    }
    return false;
}
