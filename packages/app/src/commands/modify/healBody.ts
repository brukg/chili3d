// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    command,
    EditableShapeNode,
    PubSub,
    SelectShapeStep,
    type ShapeNode,
    ShapeTypes,
    Transaction,
    VisualStates,
} from "@chili3d/core";
import { MultistepCommand } from "../multistepCommand";

// Heal Body (Fusion's repair counterpart to Check Geometry): run ShapeFix over a body to repair
// degenerate edges, broken wire order, gaps and bad face orientations, then report whether the result
// is valid. Distinct from Simplify, which merges co-domain faces/edges rather than fixing defects.
@command({
    key: "modify.healBody",
    icon: "icon-simplify",
})
export class HealBodyCommand extends MultistepCommand {
    protected override executeMainTask(): void {
        const node = this.stepDatas[0].shapes[0].owner.node as ShapeNode;
        const shape = this.stepDatas[0].shapes[0].shape;

        const healed = shapeFactory.fixShape(shape);
        if (!healed.isOk) {
            PubSub.default.pub("showToast", "error.default:{0}", healed.error);
            return;
        }

        Transaction.execute(this.document, "heal body", () => {
            const model = new EditableShapeNode({
                document: this.document,
                name: node.name + "_healed",
                shape: healed.value,
                materialId: node.materialId,
            });
            model.transform = node.transform;
            (node.parent ?? this.document.modelManager.rootNode).add(model);
            node.parent?.remove(node);
            this.document.visual.update();
        });

        PubSub.default.pub(
            "showToast",
            healed.value.isValid() ? "toast.measure.geometryValid" : "toast.heal.stillInvalid",
        );
    }

    protected override getSteps() {
        return [
            new SelectShapeStep(ShapeTypes.solid, "prompt.select.solids", {
                selectedState: VisualStates.faceTransparent,
            }),
        ];
    }
}
