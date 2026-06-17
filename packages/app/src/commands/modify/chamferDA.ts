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

// Distance-and-angle chamfer: set back `distance` on one adjacent face; the chamfer bevel makes `angle`
// degrees with that face (Fusion's distance-and-angle chamfer). Completes the chamfer trio with the
// equal-distance Chamfer and the Two-Distance Chamfer.
@command({
    key: "modify.chamferDA",
    icon: "icon-chamfer",
})
export class ChamferDACommand extends MultistepCommand {
    @property("option.command.distance")
    get distance() {
        return this.getPrivateValue("distance", 10);
    }
    set distance(value: number) {
        this.setProperty("distance", value);
    }

    @property("common.angle")
    get angle() {
        return this.getPrivateValue("angle", 45);
    }
    set angle(value: number) {
        this.setProperty("angle", value);
    }

    protected override executeMainTask() {
        Transaction.execute(this.document, "chamferDA", () => {
            const node = this.stepDatas[0].shapes[0].owner.node as ShapeNode;
            const edges = this.stepDatas.at(-1)!.shapes.map((x) => (x.shape as ISubEdgeShape).index);
            const result = shapeFactory.chamferDA(
                node.shape.value,
                edges,
                this.distance,
                (this.angle * Math.PI) / 180,
            );
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
