// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    command,
    type GeometryNode,
    type IStep,
    Plane,
    PointStep,
    type SketchConstraint,
} from "@chili3d/core";
import { SketchNode } from "../../bodys";
import { CreateCommand } from "../createCommand";

// Sketch 3-Point Rectangle: an angled rectangle from two points (the base edge, setting length and
// orientation) plus a third point setting the width. Created as a fully-constrained SketchNode whose
// local frame is aligned to the base edge — Fusion's 3-point (angled) rectangle.
@command({
    key: "create.sketchRect3p",
    icon: "icon-rect",
})
export class SketchRect3P extends CreateCommand {
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
        const view = this.stepDatas[0].view;
        // Local frame: origin p0, x along the base edge p0→p1; the plane derives the in-plane y axis.
        const xvec = p1.sub(p0).normalize() ?? view.workplane.xvec;
        const plane = new Plane({ origin: p0, normal: view.workplane.normal, xvec });
        const length = p0.distanceTo(p1);
        const height = p2.sub(p0).dot(plane.yvec); // signed perpendicular width
        const points = [
            { x: 0, y: 0 },
            { x: length, y: 0 },
            { x: length, y: height },
            { x: 0, y: height },
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
