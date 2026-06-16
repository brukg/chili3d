// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    command,
    type GeometryNode,
    type IStep,
    LengthAtPlaneStep,
    PointStep,
    Precision,
    type SketchConstraint,
    type SnapLengthAtPlaneData,
    XYZ,
} from "@chili3d/core";
import { SketchNode } from "../../bodys";
import { CreateCommand } from "../createCommand";

// Sketch Circle: a circle created as an editable SketchNode (two diameter points joined by two
// bulged semicircle segments) rather than a static face — so it lives in the sketch/constraint world
// like a real sketch profile. Pick a centre, then the radius on the working plane.
@command({
    key: "create.sketchCircle",
    icon: "icon-circle",
})
export class SketchCircle extends CreateCommand {
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
        return [this.meshPoint(center), this.meshCreatedShape("circle", XYZ.unitZ, center, radius)];
    };

    protected override geometryNode(): GeometryNode {
        const center = this.stepDatas[0].point!;
        const radius = center.distanceTo(this.stepDatas[1].point!);
        // Sketch is defined in plane-local coordinates with the origin at the circle centre: two
        // diameter endpoints, each segment bulged ±1 to form opposing semicircles → a full circle.
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
