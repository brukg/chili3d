// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { command, type IFace, type IStep, PubSub, SelectShapeStep, ShapeTypes } from "@chili3d/core";
import { MultistepCommand } from "../multistepCommand";

// Measure Area: report the total surface area of the selected face(s) — Fusion's area measure.
@command({
    key: "measure.area",
    icon: "icon-measureSelect",
})
export class AreaMeasure extends MultistepCommand {
    protected override getSteps(): IStep[] {
        return [new SelectShapeStep(ShapeTypes.face, "prompt.select.faces", { multiple: true })];
    }

    protected override executeMainTask(): void {
        const shapes = this.stepDatas[0].shapes;
        if (shapes.length === 0) {
            PubSub.default.pub("showToast", "toast.select.noSelected");
            return;
        }

        let total = 0;
        for (const data of shapes) {
            const face = data.shape.transformedMul(data.transform) as IFace;
            total += face.area();
        }

        PubSub.default.pub("showToast", "toast.measure.area:{0}", total.toFixed(2));
    }
}
