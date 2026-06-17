// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { command, type IStep, PubSub, SelectShapeStep, ShapeTypes } from "@chili3d/core";
import { MultistepCommand } from "../multistepCommand";

// Measure Topology: report the face / edge / vertex counts of a selected shape — the topology stats
// in Fusion's Inspect panel.
@command({
    key: "measure.topology",
    icon: "icon-measureSelect",
})
export class TopologyMeasure extends MultistepCommand {
    protected override getSteps(): IStep[] {
        return [new SelectShapeStep(ShapeTypes.shape, "prompt.select.shape")];
    }

    protected override executeMainTask(): void {
        const shape = this.stepDatas[0].shapes[0]?.shape;
        if (!shape) {
            PubSub.default.pub("showToast", "toast.select.noSelected");
            return;
        }
        PubSub.default.pub(
            "showToast",
            "toast.measure.topology:{0}{1}{2}",
            String(shape.findSubShapes(ShapeTypes.face).length),
            String(shape.findSubShapes(ShapeTypes.edge).length),
            String(shape.findSubShapes(ShapeTypes.vertex).length),
        );
    }
}
