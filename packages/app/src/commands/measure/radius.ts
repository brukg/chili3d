// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    CurveUtils,
    command,
    type IEdge,
    type IStep,
    type ITrimmedCurve,
    PubSub,
    SelectShapeStep,
    ShapeTypes,
} from "@chili3d/core";
import { MultistepCommand } from "../multistepCommand";

// Measure Radius: report the radius and diameter of a selected circular edge (circle or arc) —
// Fusion's radius/diameter measure.
@command({
    key: "measure.radius",
    icon: "icon-measureSelect",
})
export class RadiusMeasure extends MultistepCommand {
    protected override getSteps(): IStep[] {
        return [new SelectShapeStep(ShapeTypes.edge, "prompt.select.edges")];
    }

    protected override executeMainTask(): void {
        const edge = this.transformdFirstShape(this.stepDatas[0]) as IEdge;
        const curve = edge.curve;
        const basis = CurveUtils.isCircle(curve) ? curve : (curve as ITrimmedCurve).basisCurve;
        if (!basis || !CurveUtils.isCircle(basis)) {
            PubSub.default.pub("showToast", "error.default:{0}", "selection is not a circular edge");
            return;
        }
        const radius = basis.radius;
        PubSub.default.pub(
            "showToast",
            "toast.measure.radius:{0}{1}",
            radius.toFixed(2),
            (2 * radius).toFixed(2),
        );
    }
}
