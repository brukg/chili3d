// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    command,
    type GeometryNode,
    type IStep,
    LengthAtPlaneStep,
    PointStep,
    Precision,
    type SnapLengthAtPlaneData,
    type XYZ,
} from "@chili3d/core";
import { SpiralNode } from "../../bodys";
import { CreateCommand } from "../createCommand";

// Create Spiral (flat Archimedean spiral): pick a centre and the outer radius. The spiral grows from
// the centre over a few turns; start/end radius and turns are editable in the property panel.
@command({
    key: "create.spiral",
    icon: "icon-circle",
})
export class Spiral extends CreateCommand {
    protected override getSteps(): IStep[] {
        const centerStep = new PointStep("prompt.pickCircleCenter");
        const radiusStep = new LengthAtPlaneStep("prompt.pickRadius", this.getRadiusData);
        return [centerStep, radiusStep];
    }

    private readonly getRadiusData = (): SnapLengthAtPlaneData => {
        const point = this.stepDatas[0].point!;
        return {
            point: () => point,
            preview: this.preview,
            plane: () => this.stepDatas[0].view.workplane.translateTo(point),
            validator: (p: XYZ) => p.distanceTo(point) > Precision.Distance,
        };
    };

    private readonly preview = (end: XYZ | undefined) => {
        const center = this.stepDatas[0].point!;
        if (!end) return [this.meshPoint(center)];
        const radius = center.distanceTo(end);
        return [
            this.meshPoint(center),
            this.meshCreatedShape("circle", this.stepDatas[0].view.workplane.normal, center, radius),
        ];
    };

    protected override geometryNode(): GeometryNode {
        const center = this.stepDatas[0].point!;
        const radius = center.distanceTo(this.stepDatas[1].point!);
        return new SpiralNode({
            document: this.document,
            normal: this.stepDatas[0].view.workplane.normal,
            center,
            startRadius: 0,
            endRadius: radius,
            turns: 3,
        });
    }
}
