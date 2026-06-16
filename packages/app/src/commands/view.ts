// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { command, type IApplication, type ICommand, type INode, NodeUtils, VisualNode } from "@chili3d/core";

// Select every object in the document (Ctrl+A).
@command({
    key: "edit.selectAll",
    icon: "icon-select",
})
export class SelectAll implements ICommand {
    async execute(app: IApplication): Promise<void> {
        const document = app.activeView?.document;
        if (!document) return;

        const nodes: INode[] = [];
        const walk = (node: INode) => {
            if (node instanceof VisualNode) nodes.push(node);
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
        document.selection.setSelection(nodes, false);
    }
}

// Frame the whole model in the active view (F).
@command({
    key: "view.zoomFit",
    icon: "icon-fitcontent",
})
export class ZoomFit implements ICommand {
    async execute(app: IApplication): Promise<void> {
        const view = app.activeView;
        if (!view) return;
        view.cameraController.fitContent();
        view.update();
    }
}
