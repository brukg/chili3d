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

@command({
    key: "modify.variableFillet",
    icon: "icon-fillet",
})
export class VariableFilletCommand extends MultistepCommand {
    @property("common.length")
    get radius1() {
        return this.getPrivateValue("radius1", 5);
    }
    set radius1(value: number) {
        this.setProperty("radius1", value);
    }

    @property("common.length")
    get radius2() {
        return this.getPrivateValue("radius2", 15);
    }
    set radius2(value: number) {
        this.setProperty("radius2", value);
    }

    protected override executeMainTask() {
        Transaction.execute(this.document, `execute ${Object.getPrototypeOf(this).data.name}`, () => {
            const node = this.stepDatas[0].shapes[0].owner.node as ShapeNode;
            const edges = this.stepDatas.at(-1)!.shapes.map((x) => (x.shape as ISubEdgeShape).index);
            const filleted = shapeFactory.variableFillet(node.shape.value, edges, this.radius1, this.radius2);
            if (!filleted.isOk) {
                PubSub.default.pub("displayError", filleted.error);
                return;
            }

            const model = new EditableShapeNode({
                document: this.document,
                name: node.name,
                shape: filleted,
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
                    allow: (shape) => {
                        return (
                            shape.shapeType === ShapeTypes.solid ||
                            shape.shapeType === ShapeTypes.compound ||
                            shape.shapeType === ShapeTypes.compoundSolid
                        );
                    },
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
