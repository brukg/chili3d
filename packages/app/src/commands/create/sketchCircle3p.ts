// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { command, type GeometryNode, type IStep, PointStep, type SketchConstraint } from "@chili3d/core";
import { SketchNode } from "../../bodys";
import { CreateCommand } from "../createCommand";
import { computeCircleFromPoints } from "./arcUtils";

// Sketch 3-Point Circle: a circle through three picked points, created as an editable SketchNode
// (centre/radius derived from the three points, then built as two ±1-bulged semicircles). Fusion's
// 3-point circle, complementing the centre+radius Sketch Circle.
@command({
    key: "create.sketchCircle3p",
    icon: "icon-circle",
})
export class SketchCircle3P extends CreateCommand {
    protected override getSteps(): IStep[] {
        return [
            new PointStep("prompt.pickFistPoint"),
            new PointStep("prompt.pickNextPoint"),
            new PointStep("prompt.pickNextPoint"),
        ];
    }

    protected override geometryNode(): GeometryNode {
        const p0 = this.stepDatas[0].point!;
        const p1 = this.stepDatas[1].point!;
        const p2 = this.stepDatas[2].point!;
        const circle = computeCircleFromPoints(p0, p1, p2);
        // Collinear picks have no circle — fall back to a tiny circle at the first point so the
        // command never throws (the snapping should prevent this in practice).
        const center = circle?.center ?? p0;
        const radius = circle ? center.distanceTo(p0) : 1;

        const plane = this.stepDatas[0].view.workplane.translateTo(center);
        const points = [
            { x: -radius, y: 0 },
            { x: radius, y: 0 },
        ];
        const constraints: SketchConstraint[] = [
            { type: "fixed", point: 0, x: -radius, y: 0 },
            { type: "fixed", point: 1, x: radius, y: 0 },
        ];
        return new SketchNode({ document: this.document, plane, points, constraints, bulges: [1, 1] });
    }
}
