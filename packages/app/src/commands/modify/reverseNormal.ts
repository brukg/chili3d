// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    command,
    EditableShapeNode,
    type IStep,
    SelectShapeStep,
    type ShapeType,
    ShapeTypes,
    Transaction,
} from "@chili3d/core";
import { MultistepCommand } from "../multistepCommand";

// Reverse Normal: flip the topological orientation of a face / shell / surface so its normals point
// the other way (Fusion's "Reverse Normal"). Useful for sewing surfaces into a consistent shell or
// fixing inward-facing faces before thickening or 3D-print export.
@command({
    key: "modify.reverseNormal",
    icon: "icon-sew",
})
export class ReverseNormalCommand extends MultistepCommand {
    protected override executeMainTask() {
        Transaction.execute(this.document, "reverseNormal", () => {
            for (const data of this.stepDatas[0].shapes) {
                const shape = data.shape.transformedMul(data.transform);
                const node = new EditableShapeNode({
                    document: this.document,
                    name: "Reversed",
                    shape: shape.reversed(),
                });
                this.document.modelManager.addNode(node);
            }
            this.document.visual.update();
        });
    }

    protected override getSteps(): IStep[] {
        return [
            new SelectShapeStep((ShapeTypes.face | ShapeTypes.shell) as ShapeType, "prompt.select.shape", {
                multiple: true,
            }),
        ];
    }
}
