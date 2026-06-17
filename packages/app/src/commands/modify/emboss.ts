// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    command,
    EditableShapeNode,
    type IFace,
    type IStep,
    PubSub,
    property,
    SelectShapeStep,
    type ShapeNode,
    ShapeTypes,
    Transaction,
    VisualStates,
} from "@chili3d/core";
import { MultistepCommand } from "../multistepCommand";

// Emboss: extrude a profile face along its normal and fuse it onto a target body (raise, the default) or
// cut it into the body (engrave) by the given depth — Fusion's emboss/engrave for planar profiles.
@command({
    key: "modify.emboss",
    icon: "icon-prism",
})
export class EmbossCommand extends MultistepCommand {
    @property("common.length")
    get depth() {
        return this.getPrivateValue("depth", 2);
    }
    set depth(value: number) {
        this.setProperty("depth", value);
    }

    @property("option.command.engrave")
    get engrave() {
        return this.getPrivateValue("engrave", false);
    }
    set engrave(value: boolean) {
        this.setProperty("engrave", value);
    }

    protected override executeMainTask(): void {
        const profileData = this.stepDatas[0].shapes[0];
        const targetData = this.stepDatas[1].shapes[0];
        const targetNode = targetData?.owner.node as ShapeNode | undefined;
        if (!profileData || !targetData || !targetNode) {
            PubSub.default.pub("showToast", "toast.select.noSelected");
            return;
        }
        const profile = profileData.shape.transformedMul(profileData.transform) as IFace;
        const normal = profile.normal(0, 0)[1].normalize()!;
        // Raise extrudes outward along the profile normal; engrave goes the other way, into the body.
        const vec = normal.multiply(this.engrave ? -this.depth : this.depth);
        const tool = shapeFactory.prism(profile, vec);
        if (!tool.isOk) {
            PubSub.default.pub("showToast", "error.default:{0}", tool.error);
            return;
        }
        const target = targetData.shape.transformedMul(targetData.transform);
        const result = this.engrave
            ? shapeFactory.booleanCut([target], [tool.value])
            : shapeFactory.booleanFuse([target], [tool.value], true);
        if (!result.isOk) {
            PubSub.default.pub("showToast", "error.default:{0}", result.error);
            return;
        }
        Transaction.execute(this.document, "emboss", () => {
            const node = new EditableShapeNode({
                document: this.document,
                name: targetNode.name,
                shape: result.value,
                materialId: targetNode.materialId,
            });
            targetNode.parent?.insertAfter(targetNode, node);
            targetNode.parent?.remove(targetNode);
            this.document.visual.update();
        });
    }

    protected override getSteps(): IStep[] {
        return [
            new SelectShapeStep(ShapeTypes.face, "prompt.select.faces"),
            new SelectShapeStep(ShapeTypes.solid, "prompt.select.solids", {
                keepSelection: true,
                selectedState: VisualStates.faceTransparent,
            }),
        ];
    }
}
