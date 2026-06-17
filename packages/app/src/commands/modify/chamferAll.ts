// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    command,
    EditableShapeNode,
    GetOrSelectNodeStep,
    type IStep,
    type ISubEdgeShape,
    PubSub,
    property,
    ShapeNode,
    ShapeTypes,
    Transaction,
} from "@chili3d/core";
import { MultistepCommand } from "../multistepCommand";

// Chamfer All Edges: bevel every edge of the selected body with one distance — Fusion's body-level
// chamfer, saving the user from picking each edge.
@command({
    key: "modify.chamferAll",
    icon: "icon-chamfer",
})
export class ChamferAllEdges extends MultistepCommand {
    @property("common.length")
    get distance() {
        return this.getPrivateValue("distance", 2);
    }
    set distance(value: number) {
        this.setProperty("distance", value);
    }

    protected override getSteps(): IStep[] {
        return [
            new GetOrSelectNodeStep("prompt.select.models", {
                filter: { allow: (node) => node instanceof ShapeNode },
            }),
        ];
    }

    protected override executeMainTask(): void {
        const node = this.stepDatas[0].nodes?.[0];
        if (!(node instanceof ShapeNode)) {
            PubSub.default.pub("showToast", "toast.select.noSelected");
            return;
        }

        Transaction.execute(this.document, "chamfer all edges", () => {
            const shape = node.shape.value;
            const edges = shape.findSubShapes(ShapeTypes.edge).map((e) => (e as ISubEdgeShape).index);
            if (edges.length === 0) {
                PubSub.default.pub("showToast", "toast.converter.error");
                return;
            }
            const result = shapeFactory.chamfer(shape, edges, this.distance);
            if (!result.isOk) {
                PubSub.default.pub("showToast", "toast.converter.error");
                return;
            }
            const model = new EditableShapeNode({
                document: this.document,
                name: node.name,
                shape: result,
                materialId: node.materialId,
            });
            model.transform = node.transform;
            (node.parent ?? this.document.modelManager.rootNode).add(model);
            node.parent?.remove(node);
            this.document.visual.update();
        });
    }
}
