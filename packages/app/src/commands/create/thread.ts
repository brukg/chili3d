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
import { ThreadNode } from "../../bodys";
import { CreateCommand } from "../createCommand";

@command({
    key: "create.thread",
    icon: "icon-cylinder",
})
export class Thread extends CreateCommand {
    protected override getSteps(): IStep[] {
        const centerStep = new PointStep("prompt.pickCircleCenter");
        const radiusStep = new LengthAtPlaneStep("prompt.pickRadius", this.getRadiusData);
        return [centerStep, radiusStep];
    }

    private readonly getRadiusData = (): SnapLengthAtPlaneData => {
        const point = this.stepDatas[0].point!;
        return {
            point: () => point,
            preview: this.previewThread,
            plane: () => this.stepDatas[0].view.workplane.translateTo(point),
            validator: (p: XYZ) => p.distanceTo(point) > Precision.Distance,
        };
    };

    private readonly previewThread = (end: XYZ | undefined) => {
        if (!end) {
            return [this.meshPoint(this.stepDatas[0].point!)];
        }

        const radius = this.stepDatas[0].point?.distanceTo(end)!;
        return [
            this.meshPoint(this.stepDatas[0].point!),
            this.meshCreatedShape(
                "circle",
                this.stepDatas[0].view.workplane.normal,
                this.stepDatas[0].point!,
                radius,
            ),
        ];
    };

    protected override geometryNode(): GeometryNode {
        const center = this.stepDatas[0].point!;
        const radius = center.distanceTo(this.stepDatas[1].point!);
        return new ThreadNode({
            document: this.document,
            normal: this.stepDatas[0].view.workplane.normal,
            center,
            radius,
            pitch: radius / 2,
            height: radius * 2,
            profileRadius: Math.max(radius / 10, 0.5),
            leftHanded: false,
        });
    }
}
