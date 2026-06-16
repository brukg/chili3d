// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    command,
    FolderNode,
    type IApplication,
    type ICommand,
    type INode,
    type INodeLinkedList,
    NodeUtils,
    PubSub,
    Transaction,
} from "@chili3d/core";

// Group the selected node(s) into a new folder (lightweight container), unlike create.group which
// builds a reusable Component. The folder is created under the first selection's parent and the
// nodes are moved into it.
@command({
    key: "modify.groupFolder",
    icon: "icon-group",
})
export class GroupFolder implements ICommand {
    async execute(app: IApplication): Promise<void> {
        const document = app.activeView?.document;
        if (!document) return;

        const selected = document.selection.getSelectedNodes();
        if (selected.length === 0) {
            PubSub.default.pub("showToast", "toast.select.noSelected");
            return;
        }

        const top = NodeUtils.findTopLevelNodes(new Set(selected));
        const parent: INodeLinkedList = top[0].parent ?? document.modelManager.rootNode;
        document.selection.clearSelection();
        const folder = new FolderNode({ document, name: "Group" });
        Transaction.execute(document, "group", () => {
            parent.add(folder);
            for (const node of top) {
                node.parent?.move(node, folder);
            }
        });
        document.selection.setSelection([folder], false);
        document.visual.update();
    }
}

// Dissolve the selected folder/group: its children are moved up into its parent (keeping order and
// position) and the now-empty container is removed.
@command({
    key: "modify.ungroup",
    icon: "icon-group",
})
export class Ungroup implements ICommand {
    async execute(app: IApplication): Promise<void> {
        const document = app.activeView?.document;
        if (!document) return;

        const selected = document.selection
            .getSelectedNodes()
            .filter((node): node is INodeLinkedList => NodeUtils.isLinkedListNode(node));
        if (selected.length === 0) {
            PubSub.default.pub("showToast", "toast.select.noSelected");
            return;
        }

        const promoted: INode[] = [];
        document.selection.clearSelection();
        Transaction.execute(document, "ungroup", () => {
            for (const folder of selected) {
                const parent = folder.parent;
                if (!parent) continue;
                let previous: INode = folder;
                const children: INode[] = [];
                let child = folder.firstChild;
                while (child) {
                    children.push(child);
                    child = child.nextSibling;
                }
                for (const node of children) {
                    folder.move(node, parent, previous);
                    previous = node;
                    promoted.push(node);
                }
                parent.remove(folder);
            }
        });
        document.selection.setSelection(promoted, false);
        document.visual.update();
    }
}
