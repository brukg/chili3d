// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    command,
    EditableShapeNode,
    I18n,
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

// Shell: hollow a solid to a uniform wall thickness, opening it on the selected face(s). The user
// gives a positive wall thickness; the kernel is called with a NEGATIVE offset so the walls grow
// inward and the outer dimensions are preserved (verified against BRepOffsetAPI_MakeThickSolid).
@command({
    key: "modify.shell",
    icon: "icon-thickSolid",
})
export class ShellCommand extends MultistepCommand {
    @property("option.command.thickness")
    get thickness() {
        return this.getPrivateValue("thickness", 2);
    }
    set thickness(value: number) {
        this.setProperty("thickness", value);
    }

    // Wall direction: inward (default — outer dimensions preserved) or outward (inner cavity preserved).
    @property("option.command.shellOutside")
    get outside() {
        return this.getPrivateValue("outside", false);
    }
    set outside(value: boolean) {
        this.setProperty("outside", value);
    }

    protected override executeMainTask(): void {
        Transaction.execute(this.document, `excute ${Object.getPrototypeOf(this).data.name}`, () => {
            const node = this.stepDatas[0].shapes[0].owner.node as ShapeNode;
            const faces = this.stepDatas[1].shapes.map((x) => x.shape as IFace);
            const offset = this.outside ? this.thickness : -this.thickness;
            const result = shapeFactory.makeThickSolidByJoin(node.shape.value, faces, offset);
            if (!result.isOk) {
                PubSub.default.pub("showToast", "toast.converter.error");
                return;
            }

            const model = new EditableShapeNode({
                document: this.document,
                name: I18n.translate("command.modify.shell"),
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
