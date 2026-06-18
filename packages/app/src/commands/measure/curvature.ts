// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    command,
    type IEdge,
    type IStep,
    PubSub,
    SelectShapeStep,
    ShapeTypes,
    type XYZLike,
} from "@chili3d/core";
import { MultistepCommand } from "../multistepCommand";

// Curvature of a parametric curve from its first/second derivatives: κ = |r′ × r″| / |r′|³ (independent
// of the parametrisation's speed). Pure, so it is directly unit-testable. A circle of radius R has the
// constant curvature 1/R; a straight line has 0.
export function curvature(d1: XYZLike, d2: XYZLike): number {
    const cx = d1.y * d2.z - d1.z * d2.y;
    const cy = d1.z * d2.x - d1.x * d2.z;
    const cz = d1.x * d2.y - d1.y * d2.x;
    const crossMagnitude = Math.hypot(cx, cy, cz);
    const speed = Math.hypot(d1.x, d1.y, d1.z);
    if (speed === 0) return 0;
    return crossMagnitude / (speed * speed * speed);
}

// Measure Curvature (Fusion's curvature analysis, point form): report the curvature and radius of
// curvature of an edge at its mid-parameter.
@command({
    key: "measure.curvature",
    icon: "icon-measureSelect",
})
export class CurvatureMeasure extends MultistepCommand {
    protected override getSteps(): IStep[] {
        return [new SelectShapeStep(ShapeTypes.edge, "prompt.select.edges")];
    }

    protected override executeMainTask(): void {
        const edge = this.transformdFirstShape(this.stepDatas[0]) as IEdge;
        const curve = edge?.curve;
        if (!curve) {
            PubSub.default.pub("showToast", "toast.select.noSelected");
            return;
        }

        const u = (curve.firstParameter() + curve.lastParameter()) / 2;
        const { vec1, vec2 } = curve.d2(u);
        const k = curvature(vec1, vec2);
        const radius = k > 1e-9 ? (1 / k).toFixed(3) : "∞";

        PubSub.default.pub("showToast", "toast.measure.curvature:{0}{1}", k.toFixed(6), radius);
    }
}
