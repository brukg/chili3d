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
    type XYZ,
} from "@chili3d/core";
import { CircleNode } from "../../bodys";
import { CreateFaceableCommand } from "../createCommand";

// 2-Point Circle: the two picked points are the ends of a diameter, so the centre is their midpoint and
// the radius is half their distance — Fusion's 2-point circle.
@command({
    key: "create.circle2p",
    icon: "icon-circle",
})
export class Circle2Point extends CreateFaceableCommand {
    getSteps(): IStep[] {
        return [
            new PointStep("prompt.pickFistPoint"),
            new PointStep("prompt.pickNextPoint", this.getSecondData),
        ];
    }

    private readonly getSecondData = (): PointSnapData => ({
        refPoint: () => this.stepDatas[0].point!,
        dimension: Dimensions.D1D2D3,
        validator: (p: XYZ) => p.distanceTo(this.stepDatas[0].point!) > Precision.Distance,
        preview: (end: XYZ | undefined) => {
            const start = this.stepDatas[0].point!;
            if (!end) return [this.meshPoint(start)];
            const normal = this.stepDatas[0].view.workplane.normal;
            return [
                this.meshPoint(start),
                this.meshPoint(end),
                this.meshCreatedShape(
                    "circle",
                    normal,
                    start.add(end).multiply(0.5),
                    start.distanceTo(end) / 2,
                ),
            ];
        },
    });

    protected override geometryNode(): GeometryNode {
        const p1 = this.stepDatas[0].point!;
        const p2 = this.stepDatas[1].point!;
        const body = new CircleNode({
            document: this.document,
            normal: this.stepDatas[0].view.workplane.normal,
            center: p1.add(p2).multiply(0.5),
            radius: p1.distanceTo(p2) / 2,
        });
        body.isFace = this.isFace;
        return body;
    }
}
