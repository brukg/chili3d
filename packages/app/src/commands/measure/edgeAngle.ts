// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { command, type IEdge, type IStep, PubSub, SelectShapeStep, ShapeTypes } from "@chili3d/core";
import { MultistepCommand } from "../multistepCommand";

// Measure Edge Angle: the acute angle between two edges, taken from their tangent directions at the
// start (constant for straight edges). Orientation-independent (uses |cosθ|): perpendicular edges read
// 90°, parallel/collinear edges read 0°. Complements the 3-point Measure Angle and the Face Angle.
@command({
    key: "measure.edgeAngle",
    icon: "icon-measureAngle",
})
export class EdgeAngleMeasure extends MultistepCommand {
    protected override getSteps(): IStep[] {
        return [
            new SelectShapeStep(ShapeTypes.edge, "prompt.select.edges"),
            new SelectShapeStep(ShapeTypes.edge, "prompt.select.edges", { keepSelection: true }),
        ];
    }

    protected override executeMainTask(): void {
        const first = this.stepDatas[0].shapes[0];
        const second = this.stepDatas[1].shapes[0];
        if (!first || !second) {
            PubSub.default.pub("showToast", "toast.select.noSelected");
            return;
        }
        const d1 = this.direction(first.shape.transformedMul(first.transform) as IEdge);
        const d2 = this.direction(second.shape.transformedMul(second.transform) as IEdge);
        if (!d1 || !d2) {
            PubSub.default.pub("showToast", "error.default:{0}", "cannot evaluate edge directions");
            return;
        }
        const cos = Math.min(1, Math.abs(d1.dot(d2))); // |cos| ⇒ acute angle, orientation-independent
        const degrees = (Math.acos(cos) * 180) / Math.PI;
        PubSub.default.pub("showToast", "toast.measure.edgeAngle:{0}", degrees.toFixed(2));
    }

    private direction(edge: IEdge) {
        const curve = edge.curve;
        return curve.d1(curve.firstParameter()).vec.normalize();
    }
}
