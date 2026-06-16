// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    command,
    Dimensions,
    type GeometryNode,
    type IStep,
    type PointSnapData,
    PointStep,
    Precision,
    type SketchConstraint,
    type XYZ,
} from "@chili3d/core";
import { SketchNode } from "../../bodys";
import { CreateCommand } from "../createCommand";

// Sketch Center Rectangle: a rectangle defined by its centre and one corner, created as a
// fully-constrained SketchNode (four pinned corners, horizontal/vertical edges) — Fusion's
// centre-point rectangle, complementing the two-corner Sketch Rectangle.
@command({
    key: "create.sketchCenterRect",
    icon: "icon-rect",
})
export class SketchCenterRect extends CreateCommand {
    protected override getSteps(): IStep[] {
        return [
            new PointStep("prompt.pickCircleCenter"),
            new PointStep("prompt.pickNextPoint", this.getCornerData),
        ];
    }

    private readonly getCornerData = (): PointSnapData => {
        const center = this.stepDatas[0].point!;
        return {
            refPoint: () => center,
            dimension: Dimensions.D1D2D3,
            validator: (point: XYZ) => center.distanceTo(point) > Precision.Distance,
            preview: (point: XYZ | undefined) => {
                if (!point) return [this.meshPoint(center)];
                return [this.meshPoint(center), this.meshLine(center, point)];
            },
        };
    };

    protected override geometryNode(): GeometryNode {
        const center = this.stepDatas[0].point!;
        const corner = this.stepDatas[1].point!;
        const plane = this.stepDatas[0].view.workplane.translateTo(center);
        const d = corner.sub(center);
        const hw = Math.abs(d.dot(plane.xvec));
        const hh = Math.abs(d.dot(plane.yvec));
        // Corners are in plane-local coords with the origin at the centre.
        const points = [
            { x: -hw, y: -hh },
            { x: hw, y: -hh },
            { x: hw, y: hh },
            { x: -hw, y: hh },
        ];
        const constraints: SketchConstraint[] = points.map((p, i) => ({
            type: "fixed",
            point: i,
            x: p.x,
            y: p.y,
        }));
        return new SketchNode({ document: this.document, plane, points, constraints });
    }
}
