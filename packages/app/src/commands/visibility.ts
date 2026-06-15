// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    command,
    type IApplication,
    type ICommand,
    type IDocument,
    type INode,
    NodeUtils,
    PubSub,
} from "@chili3d/core";

function forEachNode(document: IDocument, action: (node: INode) => void) {
    const walk = (node: INode) => {
        action(node);
        if (NodeUtils.isLinkedListNode(node)) {
            let child = node.firstChild;
            while (child) {
                walk(child);
                child = child.nextSibling;
            }
        }
    };
    let child = document.modelManager.rootNode.firstChild;
    while (child) {
        walk(child);
        child = child.nextSibling;
    }
}

function collectSubtree(node: INode, into: Set<INode>) {
    into.add(node);
    if (NodeUtils.isLinkedListNode(node)) {
        let child = node.firstChild;
        while (child) {
            collectSubtree(child, into);
            child = child.nextSibling;
        }
    }
}

function collectAncestors(node: INode, into: Set<INode>) {
    let parent = node.parent;
    while (parent) {
        into.add(parent);
        parent = parent.parent;
    }
}

// Show only the selected node(s): everything else is hidden. The selected subtree and the chain of
// parents above it stay visible (a hidden parent would hide the selection through parentVisible).
@command({
    key: "modify.isolate",
    icon: "icon-eye",
})
export class Isolate implements ICommand {
    async execute(app: IApplication): Promise<void> {
        const document = app.activeView?.document;
        if (!document) return;
        const selected = document.selection.getSelectedNodes();
        if (selected.length === 0) {
            PubSub.default.pub("showToast", "toast.select.noSelected");
            return;
        }

        const keep = new Set<INode>();
        for (const node of selected) {
            collectSubtree(node, keep);
            collectAncestors(node, keep);
        }
        forEachNode(document, (node) => {
            node.visible = keep.has(node);
        });
        document.visual.update();
    }
}

// Hide every node that is not selected (and not an ancestor of a selection), leaving the rest of the
// scene as-is. Unlike Isolate this does not re-show anything — it only hides.
@command({
    key: "modify.hideOthers",
    icon: "icon-eye-slash",
})
export class HideOthers implements ICommand {
    async execute(app: IApplication): Promise<void> {
        const document = app.activeView?.document;
        if (!document) return;
        const selected = document.selection.getSelectedNodes();
        if (selected.length === 0) {
            PubSub.default.pub("showToast", "toast.select.noSelected");
            return;
        }

        const keep = new Set<INode>();
        for (const node of selected) {
            collectSubtree(node, keep);
            collectAncestors(node, keep);
        }
        forEachNode(document, (node) => {
            if (!keep.has(node)) node.visible = false;
        });
        document.visual.update();
    }
}

// Make every node in the document visible again — the counterpart to Isolate / Hide Others.
@command({
    key: "modify.showAll",
    icon: "icon-eye",
})
export class ShowAll implements ICommand {
    async execute(app: IApplication): Promise<void> {
        const document = app.activeView?.document;
        if (!document) return;
        forEachNode(document, (node) => {
            node.visible = true;
        });
        document.visual.update();
    }
}
