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
import { TorusNode } from "../../bodys";
import { CreateCommand } from "../createCommand";

// Create a torus: pick a centre then the ring radius on the working plane. The tube radius starts at
// a quarter of the ring radius and is then editable in the property panel.
@command({
    key: "create.torus",
    icon: "icon-circle",
})
export class Torus extends CreateCommand {
    protected override getSteps(): IStep[] {
        const centerStep = new PointStep("prompt.pickCircleCenter");
        const radiusStep = new LengthAtPlaneStep("prompt.pickRadius", this.getRadiusData);
        return [centerStep, radiusStep];
    }

    private readonly getRadiusData = (): SnapLengthAtPlaneData => {
        const { point, view } = this.stepDatas[0];
        return {
            point: () => point!,
            preview: this.previewTorus,
            plane: (tmp: XYZ | undefined) => this.findPlane(view, point!, tmp),
            validator: (p: XYZ) => p.distanceTo(point!) > Precision.Distance,
        };
    };

    private readonly previewTorus = (end: XYZ | undefined) => {
        const start = this.stepDatas[0].point!;
        if (!end) return [this.meshPoint(start)];
        const plane = this.findPlane(this.stepDatas[0].view, start, end);
        const radius = plane.projectDistance(start, end);
        return [
            this.meshPoint(start),
            this.meshCreatedShape(
                "torus",
                plane.normal,
                start,
                radius,
                Math.max(radius / 4, Precision.Distance),
            ),
        ];
    };

    protected override geometryNode(): GeometryNode {
        const start = this.stepDatas[0].point!;
        const plane = this.findPlane(this.stepDatas[0].view, start, this.stepDatas[1].point!);
        const radius = plane.projectDistance(start, this.stepDatas[1].point!);
        return new TorusNode({
            document: this.document,
            normal: plane.normal,
            center: start,
            radius,
            tubeRadius: radius / 4,
        });
    }
}
