// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    command,
    type GeometryNode,
    type IStep,
    type LengthAtAxisSnapData,
    LengthAtAxisStep,
    LengthAtPlaneStep,
    type Plane,
    PointStep,
    Precision,
    property,
    type SnapLengthAtPlaneData,
    type XYZ,
} from "@chili3d/core";
import { TubeNode } from "../../bodys";
import { CreateCommand } from "../createCommand";

// Tube (hollow cylinder): same picks as Cylinder — centre, outer radius, height — plus a wall
// thickness property; the bore radius is outer − thickness.
@command({
    key: "create.tube",
    icon: "icon-cylinder",
})
export class Tube extends CreateCommand {
    @property("tube.thickness")
    get thickness() {
        return this.getPrivateValue("thickness", 1);
    }
    set thickness(value: number) {
        this.setProperty("thickness", value);
    }

    protected override getSteps(): IStep[] {
        const centerStep = new PointStep("prompt.pickCircleCenter");
        const radiusStep = new LengthAtPlaneStep("prompt.pickRadius", this.getRadiusData);
        const third = new LengthAtAxisStep("prompt.pickNextPoint", this.getHeightStepData);
        return [centerStep, radiusStep, third];
    }

    private readonly getRadiusData = (): SnapLengthAtPlaneData => {
        const { point, view } = this.stepDatas[0];
        return {
            point: () => point!,
            preview: this.circlePreview,
            plane: (tmp: XYZ | undefined) => this.findPlane(view, point!, tmp),
            validator: (p: XYZ) => {
                if (p.distanceTo(point!) < Precision.Distance) return false;
                const plane = this.findPlane(view, point!, p);
                return p.sub(point!).isParallelTo(plane.normal) === false;
            },
        };
    };

    private readonly circlePreview = (point: XYZ | undefined) => {
        if (!point) return [this.meshPoint(this.stepDatas[0].point!)];

        const start = this.stepDatas[0].point!;
        const plane = this.findPlane(this.stepDatas[0].view, start, point);
        return [
            this.meshPoint(this.stepDatas[0].point!),
            this.meshLine(start, point),
            this.meshCreatedShape("circle", plane.normal, start, plane.projectDistance(start, point)),
        ];
    };

    private readonly getHeightStepData = (): LengthAtAxisSnapData => {
        return {
            point: this.stepDatas[0].point!,
            direction: this.stepDatas[1].plane!.normal,
            preview: this.previewCylinder,
            validator: (p: XYZ) => {
                return Math.abs(this.getHeight(this.stepDatas[1].plane!, p)) > 0.001;
            },
        };
    };

    private readonly previewCylinder = (end: XYZ | undefined) => {
        if (!end) {
            return this.circlePreview(this.stepDatas[1].point);
        }

        const plane = this.stepDatas[1].plane!;
        const radius = plane.projectDistance(this.stepDatas[0].point!, this.stepDatas[1].point!);
        const height = this.getHeight(plane, end);

        return [
            this.meshPoint(this.stepDatas[0].point!),
            this.meshCreatedShape(
                "cylinder",
                height < 0 ? plane.normal.reverse() : plane.normal,
                this.stepDatas[0].point!,
                radius,
                Math.abs(height),
            ),
        ];
    };

    protected override geometryNode(): GeometryNode {
        const plane = this.stepDatas[1].plane!;
        const radius = plane.projectDistance(this.stepDatas[0].point!, this.stepDatas[1].point!);
        const dz = this.getHeight(plane, this.stepDatas[2].point!);
        const innerRadius = Math.max(radius - Math.abs(this.thickness), 0);
        return new TubeNode({
            document: this.document,
            normal: dz < 0 ? plane.normal.reverse() : plane.normal,
            center: this.stepDatas[0].point!,
            radius,
            innerRadius,
            dz: Math.abs(dz),
        });
    }

    private getHeight(plane: Plane, point: XYZ): number {
        return point.sub(this.stepDatas[0].point!).dot(plane.normal);
    }
}
