// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { command, type IStep, PubSub, SelectShapeStep, type ShapeType, ShapeTypes } from "@chili3d/core";
import { MultistepCommand } from "../multistepCommand";

// Measure Distance: report the minimum (extrema) distance between two selected shapes. Works for any
// pair of topology — vertex/edge/face/solid — so it covers point-to-point, point-to-face,
// edge-to-edge and face-to-face gaps. Complements the free point-to-point Measure Length.
const ANY_SHAPE = (ShapeTypes.vertex |
    ShapeTypes.edge |
    ShapeTypes.wire |
    ShapeTypes.face |
    ShapeTypes.shell |
    ShapeTypes.solid) as ShapeType;

@command({
    key: "measure.distance",
    icon: "icon-measureLength",
})
export class DistanceMeasure extends MultistepCommand {
    protected override getSteps(): IStep[] {
        return [
            new SelectShapeStep(ANY_SHAPE, "prompt.select.shape"),
            new SelectShapeStep(ANY_SHAPE, "prompt.select.shape", { keepSelection: true }),
        ];
    }

    protected override executeMainTask(): void {
        const first = this.stepDatas[0].shapes[0];
        const second = this.stepDatas[1].shapes[0];
        if (!first || !second) {
            PubSub.default.pub("showToast", "toast.select.noSelected");
            return;
        }

        const shape1 = first.shape.transformedMul(first.transform);
        const shape2 = second.shape.transformedMul(second.transform);
        const distance = shape1.extremaDistance(shape2);

        PubSub.default.pub("showToast", "toast.measure.distance:{0}", distance.toFixed(2));
    }
}
