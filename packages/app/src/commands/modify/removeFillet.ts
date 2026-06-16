// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    command,
    EditableShapeNode,
    I18n,
    type IFace,
    type IStep,
    PubSub,
    SelectShapeStep,
    type ShapeNode,
    ShapeTypes,
    Transaction,
    VisualStates,
} from "@chili3d/core";
import { MultistepCommand } from "../multistepCommand";

// Remove Fillet: select a solid, then its fillet/round faces, and reconstruct the sharp edges they
// replaced — the inverse of Fillet. Backed by the kernel's removeFillet (ChFi3d unfillet).
@command({
    key: "modify.removeFillet",
    icon: "icon-removeFeature",
})
export class RemoveFilletCommand extends MultistepCommand {
    protected override executeMainTask(): void {
        Transaction.execute(this.document, `excute ${Object.getPrototypeOf(this).data.name}`, () => {
            const node = this.stepDatas[0].shapes[0].owner.node as ShapeNode;
            const faces = this.stepDatas[1].shapes.map((x) => x.shape as IFace);
            const result = shapeFactory.removeFillet(node.shape.value, faces);
            if (!result.isOk) {
                PubSub.default.pub("showToast", "toast.converter.error");
                return;
            }

            const model = new EditableShapeNode({
                document: this.document,
                name: I18n.translate("command.modify.removeFillet"),
                shape: result.value.shape,
                materialId: node.materialId,
            });
            model.transform = node.transform;
            node.parent?.insertAfter(node, model);
            node.parent?.remove(node);
            this.document.visual.update();
            PubSub.default.pub("showToast", "toast.success");
        });
    }

    protected override getSteps(): IStep[] {
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
            new SelectShapeStep(ShapeTypes.face, "prompt.select.faces", {
                multiple: true,
                keepSelection: true,
            }),
        ];
    }
}
