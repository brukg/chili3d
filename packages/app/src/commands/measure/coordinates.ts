// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { command, type IStep, type IVertex, PubSub, SelectShapeStep, ShapeTypes } from "@chili3d/core";
import { MultistepCommand } from "../multistepCommand";

// Measure Coordinates: report the world X/Y/Z of a selected vertex — Fusion's single-point coordinate
// readout in the measure panel.
@command({
    key: "measure.coordinates",
    icon: "icon-measureSelect",
})
export class CoordinatesMeasure extends MultistepCommand {
    protected override getSteps(): IStep[] {
        return [new SelectShapeStep(ShapeTypes.vertex, "prompt.select.vertexes")];
    }

    protected override executeMainTask(): void {
        const data = this.stepDatas[0].shapes[0];
        if (!data) {
            PubSub.default.pub("showToast", "toast.select.noSelected");
            return;
        }
        const p = (data.shape.transformedMul(data.transform) as IVertex).point();
        PubSub.default.pub(
            "showToast",
            "toast.measure.coordinates:{0}{1}{2}",
            p.x.toFixed(2),
            p.y.toFixed(2),
            p.z.toFixed(2),
        );
    }
}
