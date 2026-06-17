// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    command,
    EditableShapeNode,
    type ISubEdgeShape,
    PubSub,
    property,
    SelectShapeStep,
    type ShapeNode,
    ShapeTypes,
    Transaction,
    VisualStates,
} from "@chili3d/core";
import { MultistepCommand } from "../multistepCommand";

// Two-distance (asymmetric) chamfer: bevel the selected edges setting back distance1 on one adjacent
// face and distance2 on the other (Fusion's two-distance chamfer), unlike the equal-distance Chamfer.
@command({
    key: "modify.chamferAsym",
    icon: "icon-chamfer",
})
export class ChamferAsymCommand extends MultistepCommand {
    @property("option.command.distance")
    get distance1() {
        return this.getPrivateValue("distance1", 10);
    }
    set distance1(value: number) {
        this.setProperty("distance1", value);
    }

    @property("common.length")
    get distance2() {
        return this.getPrivateValue("distance2", 5);
    }
    set distance2(value: number) {
        this.setProperty("distance2", value);
    }

    protected override executeMainTask() {
        Transaction.execute(this.document, "chamferAsym", () => {
            const node = this.stepDatas[0].shapes[0].owner.node as ShapeNode;
            const edges = this.stepDatas.at(-1)!.shapes.map((x) => (x.shape as ISubEdgeShape).index);
            const result = shapeFactory.chamferAsym(node.shape.value, edges, this.distance1, this.distance2);
            if (!result.isOk) {
                PubSub.default.pub("showToast", "error.default:{0}", result.error);
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

    protected override getSteps() {
        return [
            new SelectShapeStep(ShapeTypes.shape, "prompt.select.shape", {
                shapeFilter: {
                    allow: (shape) =>
                        shape.shapeType === ShapeTypes.solid ||
                        shape.shapeType === ShapeTypes.compound ||
                        shape.shapeType === ShapeTypes.compoundSolid,
                },
                selectedState: VisualStates.faceTransparent,
            }),
            new SelectShapeStep(ShapeTypes.edge, "prompt.select.edges", {
                multiple: true,
                keepSelection: true,
            }),
        ];
    }
}
