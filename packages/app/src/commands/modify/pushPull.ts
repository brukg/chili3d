// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    command,
    EditableShapeNode,
    GeometryUtils,
    I18n,
    type IFace,
    type IStep,
    PubSub,
    property,
    SelectShapeStep,
    type ShapeNode,
    ShapeTypes,
    Transaction,
} from "@chili3d/core";
import { MultistepCommand } from "../multistepCommand";

// Push/Pull: offset a planar face along its normal, adding material (positive distance, pull out) or
// removing it (negative distance, push in) — the core of direct modeling. Only planar faces are
// allowed: the kernel resolves the face to a Geom_Plane, and a non-planar face would fail there.
@command({
    key: "modify.pushPull",
    icon: "icon-prism",
})
export class PushPullCommand extends MultistepCommand {
    @property("option.command.distance")
    get distance() {
        return this.getPrivateValue("distance", 10);
    }
    set distance(value: number) {
        this.setProperty("distance", value);
    }

    protected override executeMainTask(): void {
        Transaction.execute(this.document, `excute ${Object.getPrototypeOf(this).data.name}`, () => {
            const faceData = this.stepDatas[0].shapes[0];
            const node = faceData.owner.node as ShapeNode;
            const face = faceData.shape as IFace;
            const normal = GeometryUtils.normal(face);
            const vec = normal.multiply(this.distance);

            const result = shapeFactory.pushPull(node.shape.value, face, vec);
            if (!result.isOk) {
                PubSub.default.pub("showToast", "toast.converter.error");
                return;
            }

            const model = new EditableShapeNode({
                document: this.document,
                name: I18n.translate("command.modify.pushPull"),
                shape: result,
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
            new SelectShapeStep(ShapeTypes.face, "prompt.select.faces", {
                shapeFilter: {
                    allow: (shape) =>
                        shape.shapeType === ShapeTypes.face && (shape as IFace).surface().isPlanar(),
                },
            }),
        ];
    }
}
