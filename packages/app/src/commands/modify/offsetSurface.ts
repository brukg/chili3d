// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    command,
    EditableShapeNode,
    type IStep,
    PubSub,
    property,
    SelectShapeStep,
    type ShapeType,
    ShapeTypes,
    Transaction,
} from "@chili3d/core";
import { MultistepCommand } from "../multistepCommand";

// Offset Surface: build a new surface parallel to the selected face(s)/shell at a signed normal
// distance (Fusion's "Offset" surface) — distinct from Thicken, which closes the gap into a solid.
@command({
    key: "modify.offsetSurface",
    icon: "icon-fillet",
})
export class OffsetSurfaceCommand extends MultistepCommand {
    @property("option.command.distance")
    get distance() {
        return this.getPrivateValue("distance", 5);
    }
    set distance(value: number) {
        this.setProperty("distance", value);
    }

    protected override executeMainTask() {
        Transaction.execute(this.document, "offsetSurface", () => {
            for (const data of this.stepDatas[0].shapes) {
                const shape = data.shape.transformedMul(data.transform);
                const offset = shapeFactory.offsetSurface(shape, this.distance);
                if (!offset.isOk) {
                    PubSub.default.pub("showToast", "error.default:{0}", offset.error);
                    continue;
                }
                const node = new EditableShapeNode({
                    document: this.document,
                    name: "Offset Surface",
                    shape: offset.value,
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
