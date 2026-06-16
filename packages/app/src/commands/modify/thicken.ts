// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    command,
    EditableShapeNode,
    I18n,
    type IStep,
    PubSub,
    property,
    SelectShapeStep,
    type ShapeNode,
    ShapeTypes,
    Transaction,
} from "@chili3d/core";
import { MultistepCommand } from "../multistepCommand";

// Thicken: give an open surface (a face or shell) a uniform thickness, turning it into a solid by
// offsetting both sides — Fusion's Thicken. A positive thickness offsets along the surface normal;
// a negative one offsets the other way. The original surface is kept so it can be re-thickened.
@command({
    key: "modify.thicken",
    icon: "icon-thickSolid",
})
export class ThickenCommand extends MultistepCommand {
    @property("option.command.thickness")
    get thickness() {
        return this.getPrivateValue("thickness", 2);
    }
    set thickness(value: number) {
        this.setProperty("thickness", value);
    }

    protected override executeMainTask(): void {
        Transaction.execute(this.document, `excute ${Object.getPrototypeOf(this).data.name}`, () => {
            const node = this.stepDatas[0].shapes[0].owner.node as ShapeNode;
            const shape = this.transformdFirstShape(this.stepDatas[0]);
            const result = shapeFactory.makeThickSolidBySimple(shape, this.thickness);
            if (!result.isOk) {
                PubSub.default.pub("showToast", "toast.converter.error");
                return;
            }

            const model = new EditableShapeNode({
                document: this.document,
                name: I18n.translate("command.modify.thicken"),
                shape: result,
                materialId: node.materialId,
            });
            (node.parent ?? this.document.modelManager.rootNode).add(model);
            this.document.visual.update();
            PubSub.default.pub("showToast", "toast.success");
        });
    }

    protected override getSteps(): IStep[] {
        return [
            new SelectShapeStep(ShapeTypes.shape, "prompt.select.shape", {
                shapeFilter: {
                    allow: (shape) =>
                        shape.shapeType === ShapeTypes.face || shape.shapeType === ShapeTypes.shell,
                },
            }),
        ];
    }
}
