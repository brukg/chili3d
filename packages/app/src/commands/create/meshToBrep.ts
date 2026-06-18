// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    AsyncController,
    CancelableCommand,
    command,
    EditableShapeNode,
    type IDocument,
    MeshNode,
    PubSub,
    SelectNodeStep,
    Transaction,
    type XYZLike,
} from "@chili3d/core";

// Mesh → BRep (Fusion's Mesh → BRep): rebuild an editable faceted B-rep body from a triangle mesh node
// (e.g. an imported STL or a Convert-to-Mesh result). Each triangle becomes a face; sewing stitches them
// into a shell, promoted to a solid when watertight. The reverse of Convert to Mesh.
@command({
    key: "convert.meshToBrep",
    icon: "icon-toSolid",
})
export class MeshToBrep extends CancelableCommand {
    async executeAsync(): Promise<void> {
        const nodes = await this.getOrPickMeshNodes(this.document);
        if (!nodes || nodes.length === 0) {
            PubSub.default.pub("showToast", "toast.select.noSelected");
            return;
        }
        Transaction.execute(this.document, "mesh to brep", () => {
            for (const node of nodes) {
                this.convertOne(node);
            }
            this.document.visual.update();
        });
    }

    private convertOne(node: MeshNode): void {
        const { position, index } = node.mesh;
        if (!position || !index || index.length === 0) {
            PubSub.default.pub("showToast", "toast.converter.error");
            return;
        }

        const transform = node.transform;
        const corners: XYZLike[] = new Array(index.length);
        for (let i = 0; i < index.length; i++) {
            const v = index[i] * 3;
            corners[i] = transform.ofPoint({ x: position[v], y: position[v + 1], z: position[v + 2] });
        }

        const result = shapeFactory.meshToShape(corners);
        if (!result.isOk) {
            PubSub.default.pub("showToast", "error.default:{0}", result.error);
            return;
        }

        const brep = new EditableShapeNode({
            document: this.document,
            name: node.name + "_brep",
            shape: result.value,
        });
        (node.parent ?? this.document.modelManager.rootNode).add(brep);
    }

    private async getOrPickMeshNodes(document: IDocument): Promise<MeshNode[] | undefined> {
        const selected = document.selection
            .getSelectedNodes()
            .filter((n): n is MeshNode => n instanceof MeshNode);
        document.selection.clearSelection();
        if (selected.length > 0) return selected;

        const step = new SelectNodeStep("prompt.select.models", {
            filter: { allow: (n) => n instanceof MeshNode },
            multiple: true,
        });
        this.controller = new AsyncController();
        const data = await step.execute(document, this.controller);
        document.selection.clearSelection();
        return data?.nodes?.filter((n): n is MeshNode => n instanceof MeshNode);
    }
}
