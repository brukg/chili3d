// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    command,
    EditableShapeNode,
    type IFace,
    type ISubFaceShape,
    MathUtils,
    PubSub,
    property,
    SelectShapeStep,
    type ShapeNode,
    ShapeTypes,
    Transaction,
} from "@chili3d/core";
import { MultistepCommand } from "../multistepCommand";

@command({
    key: "modify.draft",
    icon: "icon-fillet",
})
export class DraftCommand extends MultistepCommand {
    @property("common.angle")
    get angle() {
        return this.getPrivateValue("angle", 5);
    }
    set angle(value: number) {
        this.setProperty("angle", value);
    }

    protected override executeMainTask() {
        Transaction.execute(this.document, `execute ${Object.getPrototypeOf(this).data.name}`, () => {
            const node = this.stepDatas[0].shapes[0].owner.node as ShapeNode;
            const faces = this.stepDatas[0].shapes.map((x) => (x.shape as ISubFaceShape).index);

            const neutralFace = this.stepDatas[1].shapes[0].shape as IFace;
            const [origin, normal] = neutralFace.normal(0.5, 0.5);

            const drafted = shapeFactory.draftAngle(
                node.shape.value,
                faces,
                normal,
                MathUtils.degToRad(this.angle),
                origin,
                normal,
            );
            if (!drafted.isOk) {
                PubSub.default.pub("displayError", drafted.error);
                return;
            }

            const model = new EditableShapeNode({
                document: this.document,
                name: node.name,
                shape: drafted,
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
            new SelectShapeStep(ShapeTypes.face, "prompt.select.faces", {
                multiple: true,
            }),
            new SelectShapeStep(ShapeTypes.face, "prompt.select.neutralFace", {
                keepSelection: true,
            }),
        ];
    }
}
