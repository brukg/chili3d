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

// Measure Arc Angle: report the included (sweep) angle of a selected circular arc edge. A circle is
// parametrized by angle, so the sweep is the curve's parameter span — a quarter arc reads 90°.
@command({
    key: "measure.arcAngle",
    icon: "icon-measureAngle",
})
export class ArcAngleMeasure extends MultistepCommand {
    protected override getSteps(): IStep[] {
        return [new SelectShapeStep(ShapeTypes.edge, "prompt.select.edges")];
    }

    protected override executeMainTask(): void {
        const edge = this.transformdFirstShape(this.stepDatas[0]) as IEdge;
        const curve = edge.curve;
        const basis = CurveUtils.isCircle(curve) ? curve : (curve as ITrimmedCurve).basisCurve;
        if (!basis || !CurveUtils.isCircle(basis) || curve.isClosed()) {
            PubSub.default.pub("showToast", "error.default:{0}", "selection is not a circular arc");
            return;
        }
        const sweep = ((curve.lastParameter() - curve.firstParameter()) * 180) / Math.PI;
        PubSub.default.pub("showToast", "toast.measure.arcAngle:{0}", sweep.toFixed(2));
    }
}
