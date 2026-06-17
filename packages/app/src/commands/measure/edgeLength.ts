// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    command,
    type IEdge,
    type IStep,
    PubSub,
    SelectShapeStep,
    type ShapeType,
    ShapeTypes,
} from "@chili3d/core";
import { MultistepCommand } from "../multistepCommand";

// Measure Edge Length: report the total true length of the selected edge(s) / wire(s) — the curve
// length, so arcs and splines are measured along the curve, not chord-to-chord. Complements the
// point-to-point Measure Length.
@command({
    key: "measure.edgeLength",
    icon: "icon-measureLength",
})
export class EdgeLengthMeasure extends MultistepCommand {
    protected override getSteps(): IStep[] {
        return [
            new SelectShapeStep((ShapeTypes.edge | ShapeTypes.wire) as ShapeType, "prompt.select.shape", {
                multiple: true,
            }),
        ];
    }

    protected override executeMainTask(): void {
        const shapes = this.stepDatas[0].shapes;
        if (shapes.length === 0) {
            PubSub.default.pub("showToast", "toast.select.noSelected");
            return;
        }

        let total = 0;
        for (const data of shapes) {
            const shape = data.shape.transformedMul(data.transform);
            // Works for a lone edge or a wire: sum every contained edge's curve length.
            const edges = shape.findSubShapes(ShapeTypes.edge) as IEdge[];
            for (const edge of edges) {
                total += edge.curve.length();
            }
        }

        PubSub.default.pub("showToast", "toast.measure.edgeLength:{0}", total.toFixed(2));
    }
}
