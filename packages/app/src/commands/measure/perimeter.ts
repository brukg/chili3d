// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { command, type IEdge, type IStep, PubSub, SelectShapeStep, ShapeTypes } from "@chili3d/core";
import { MultistepCommand } from "../multistepCommand";

// Measure Perimeter: report the total boundary length of a face — the sum of every bounding edge's
// true curve length (outer wire plus any holes). Fusion's measure panel reports this for a face
// selection; complements Measure Area (the enclosed surface) and Measure Edge Length (a single edge).
@command({
    key: "measure.perimeter",
    icon: "icon-measureLength",
})
export class PerimeterMeasure extends MultistepCommand {
    protected override getSteps(): IStep[] {
        return [new SelectShapeStep(ShapeTypes.face, "prompt.select.faces")];
    }

    protected override executeMainTask(): void {
        const data = this.stepDatas[0].shapes[0];
        if (!data) {
            PubSub.default.pub("showToast", "toast.select.noSelected");
            return;
        }

        const face = data.shape.transformedMul(data.transform);
        const edges = face.findSubShapes(ShapeTypes.edge) as IEdge[];
        const perimeter = edges.reduce((sum, edge) => sum + edge.curve.length(), 0);

        PubSub.default.pub("showToast", "toast.measure.perimeter:{0}", perimeter.toFixed(2));
    }
}
