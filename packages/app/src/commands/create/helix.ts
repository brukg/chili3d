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
import { HelixNode } from "../../bodys";
import { CreateCommand } from "../createCommand";

// Create Helix curve: pick a centre and the helix radius. Starts with a few turns at a sensible pitch
// (editable in the property panel); the resulting edge is a ready path for a custom helical sweep.
@command({
    key: "create.helix",
    icon: "icon-cylinder",
})
export class Helix extends CreateCommand {
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
        return new HelixNode({
            document: this.document,
            normal: this.stepDatas[0].view.workplane.normal,
            center,
            radius,
            pitch: Math.max(radius / 2, 1),
            height: radius * 4,
            leftHanded: false,
        });
    }
}
