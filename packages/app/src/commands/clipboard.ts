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

// Module-level clipboard shared between the cut/copy and paste commands. It holds the top-level
// nodes captured by the last cut or copy plus the mode, so a node can be reparented or duplicated by
// keyboard (Ctrl+X/Ctrl+C then Ctrl+V on the destination) instead of dragging across a large tree.
type ClipboardMode = "cut" | "copy";
let clipboard: { nodes: INode[]; mode: ClipboardMode } = { nodes: [], mode: "cut" };

// `node.clone()` only copies a node's own serialized fields, so a folder clones to an EMPTY folder.
// Deep-clone the subtree by cloning each node and re-attaching cloned children, so duplicating a
// finger/assembly reproduces its whole contents.
function deepClone(node: INode): INode {
    const copy = node.clone();
    if (NodeUtils.isLinkedListNode(node) && NodeUtils.isLinkedListNode(copy)) {
        let child = node.firstChild;
        while (child) {
            copy.add(deepClone(child));
            child = child.nextSibling;
        }
    }
    return copy;
}

function isSelfOrAncestor(node: INode, candidate: INode): boolean {
    let current: INode | undefined = candidate;
    while (current) {
        if (current === node) return true;
        current = current.parent;
    }
    return false;
}

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

        clipboard = { nodes: NodeUtils.findTopLevelNodes(new Set(selected)), mode: "cut" };
        PubSub.default.pub("showToast", "toast.cut{0}Objects", clipboard.nodes.length);
    }
}

@command({
    key: "modify.copyNode",
    icon: "icon-clone",
})
export class CopyNode implements ICommand {
    async execute(app: IApplication): Promise<void> {
        const document = app.activeView?.document;
        if (!document) return;

        const selected = document.selection.getSelectedNodes();
        if (selected.length === 0) {
            PubSub.default.pub("showToast", "toast.select.noSelected");
            return;
        }

        clipboard = { nodes: NodeUtils.findTopLevelNodes(new Set(selected)), mode: "copy" };
        PubSub.default.pub("showToast", "toast.copy{0}Objects", clipboard.nodes.length);
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

        if (clipboard.nodes.length === 0) {
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

        if (clipboard.mode === "cut") {
            // Moving: a node cannot be pasted into itself or one of its own descendants.
            const movable = clipboard.nodes.filter((node) => !isSelfOrAncestor(node, newParent));
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
            clipboard = { nodes: [], mode: "cut" };
            document.visual.update();
            PubSub.default.pub("showToast", "toast.paste{0}Objects", movable.length);
        } else {
            // Copying: clone each source into the target. The clipboard is kept so the same copy can
            // be pasted repeatedly.
            const clones: INode[] = [];
            document.selection.clearSelection();
            Transaction.execute(document, "paste node", () => {
                clipboard.nodes.forEach((node) => {
                    const clone = deepClone(node);
                    newParent.add(clone);
                    clones.push(clone);
                });
            });
            document.selection.setSelection(clones, false);
            document.visual.update();
            PubSub.default.pub("showToast", "toast.paste{0}Objects", clones.length);
        }
    }
}

// Clone the selected node(s) in place (next to each original) without touching the clipboard.
@command({
    key: "modify.duplicate",
    icon: "icon-clone",
})
export class DuplicateNode implements ICommand {
    async execute(app: IApplication): Promise<void> {
        const document = app.activeView?.document;
        if (!document) return;

        const selected = document.selection.getSelectedNodes();
        if (selected.length === 0) {
            PubSub.default.pub("showToast", "toast.select.noSelected");
            return;
        }

        const sources = NodeUtils.findTopLevelNodes(new Set(selected));
        const clones: INode[] = [];
        document.selection.clearSelection();
        Transaction.execute(document, "duplicate", () => {
            sources.forEach((node) => {
                const clone = deepClone(node);
                node.parent?.insertAfter(node, clone);
                clones.push(clone);
            });
        });
        document.selection.setSelection(clones, false);
        document.visual.update();
        PubSub.default.pub("showToast", "toast.duplicate{0}Objects", clones.length);
    }
}
