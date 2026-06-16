// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    command,
    EditableShapeNode,
    GetOrSelectNodeStep,
    type IStep,
    PubSub,
    ShapeNode,
    ShapeTypes,
    Transaction,
} from "@chili3d/core";
import { MultistepCommand } from "../multistepCommand";

// Extract Edges: collect all edges of the selected body(ies) into a new reference-geometry node (a
// compound of edges in world space) — Fusion's "include/project geometry" for reusing a part's edges
// as construction curves. The source bodies are left untouched.
@command({
    key: "create.extractEdges",
    icon: "icon-toPoly",
})
export class ExtractEdges extends MultistepCommand {
    protected override getSteps(): IStep[] {
        return [new GetOrSelectNodeStep("prompt.select.shape", { multiple: true })];
    }

    protected override executeMainTask(): void {
        const nodes = (this.stepDatas[0].nodes ?? []).filter((n): n is ShapeNode => n instanceof ShapeNode);
        if (nodes.length === 0) {
            PubSub.default.pub("showToast", "toast.select.noSelected");
            return;
        }

        let created = 0;
        Transaction.execute(this.document, "extract edges", () => {
            for (const node of nodes) {
                const worldShape = node.shape.value.transformedMul(node.transform);
                const edges = worldShape.findSubShapes(ShapeTypes.edge);
                if (edges.length === 0) continue;
                const compound = shapeFactory.combine(edges);
                if (!compound.isOk) continue;
                const edgeNode = new EditableShapeNode({
                    document: this.document,
                    name: `${node.name} edges`,
                    shape: compound.value,
                });
                (node.parent ?? this.document.modelManager.rootNode).add(edgeNode);
                created++;
            }
            this.document.visual.update();
        });

        PubSub.default.pub("showToast", created > 0 ? "toast.success" : "toast.converter.error");
    }
}
