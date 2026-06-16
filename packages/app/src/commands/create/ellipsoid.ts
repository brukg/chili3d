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
    XYZ,
} from "@chili3d/core";
import { EllipsoidNode } from "../../bodys";
import { CreateCommand } from "../createCommand";

// Create an ellipsoid: pick a centre then a radius. It starts spherical (all three radii equal) and
// is reshaped by editing the X/Y/Z radii in the property panel — the parametric way to an ellipsoid.
@command({
    key: "create.ellipsoid",
    icon: "icon-sphere",
})
export class Ellipsoid extends CreateCommand {
    protected override getSteps(): IStep[] {
        const centerStep = new PointStep("prompt.pickCircleCenter");
        const radiusStep = new LengthAtPlaneStep("prompt.pickRadius", this.getRadiusData);
        return [centerStep, radiusStep];
    }

    private readonly getRadiusData = (): SnapLengthAtPlaneData => {
        const point = this.stepDatas[0].point!;
        return {
            point: () => point,
            preview: this.previewEllipsoid,
            plane: () => this.stepDatas[0].view.workplane.translateTo(point),
            validator: (p: XYZ) => p.distanceTo(point) > Precision.Distance,
        };
    };

    private readonly previewEllipsoid = (end: XYZ | undefined) => {
        if (!end) {
            return [this.meshPoint(this.stepDatas[0].point!)];
        }
        const radius = this.stepDatas[0].point!.distanceTo(end);
        return [
            this.meshPoint(this.stepDatas[0].point!),
            this.meshCreatedShape("circle", XYZ.unitZ, this.stepDatas[0].point!, radius),
            this.meshCreatedShape("circle", XYZ.unitY, this.stepDatas[0].point!, radius),
        ];
    };

    protected override geometryNode(): GeometryNode {
        const radius = this.stepDatas[0].point!.distanceTo(this.stepDatas[1].point!);
        return new EllipsoidNode({
            document: this.document,
            center: this.stepDatas[0].point!,
            xRadius: radius,
            yRadius: radius,
            zRadius: radius,
        });
    }
}
