// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { command, type IStep, type IVertex, PubSub, SelectShapeStep, ShapeTypes } from "@chili3d/core";
import { MultistepCommand } from "../multistepCommand";

// Measure Delta: report the signed component deltas (ΔX, ΔY, ΔZ) and the straight-line distance between
// two selected vertices — the multi-axis readout Fusion's measure panel shows for a two-point selection.
// Complements Measure Distance (the unsigned minimum gap between any two shapes).
@command({
    key: "measure.delta",
    icon: "icon-measureLength",
})
export class DeltaMeasure extends MultistepCommand {
    protected override getSteps(): IStep[] {
        return [
            new SelectShapeStep(ShapeTypes.vertex, "prompt.select.vertexes"),
            new SelectShapeStep(ShapeTypes.vertex, "prompt.select.vertexes", { keepSelection: true }),
        ];
    }

    protected override executeMainTask(): void {
        const first = this.stepDatas[0].shapes[0];
        const second = this.stepDatas[1].shapes[0];
        if (!first || !second) {
            PubSub.default.pub("showToast", "toast.select.noSelected");
            return;
        }

        const a = (first.shape.transformedMul(first.transform) as IVertex).point();
        const b = (second.shape.transformedMul(second.transform) as IVertex).point();
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dz = b.z - a.z;

        PubSub.default.pub(
            "showToast",
            "toast.measure.delta:{0}{1}{2}{3}",
            dx.toFixed(2),
            dy.toFixed(2),
            dz.toFixed(2),
            Math.hypot(dx, dy, dz).toFixed(2),
        );
    }
}
