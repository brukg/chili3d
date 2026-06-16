// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    command,
    type GeometryNode,
    type IStep,
    LengthAtPlaneStep,
    PointStep,
    Precision,
    property,
    type SketchConstraint,
    type SnapLengthAtPlaneData,
    XYZ,
} from "@chili3d/core";
import { SketchNode } from "../../bodys";
import { CreateCommand } from "../createCommand";

// Sketch Polygon: an inscribed regular polygon created as an editable SketchNode (N corners on a
// circle of the picked radius, each pinned). Pick a centre, then the radius; the side count is a
// command property. A real sketch-toolbar polygon, distinct from the static create.regularPolygon.
@command({
    key: "create.sketchPolygon",
    icon: "icon-polygon",
})
export class SketchPolygon extends CreateCommand {
    @property("regularPolygon.sides")
    get sides() {
        return this.getPrivateValue("sides", 6);
    }
    set sides(value: number) {
        this.setProperty("sides", Math.max(3, Math.round(value)));
    }

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
        const plane = this.stepDatas[0].view.workplane.translateTo(center);
        const n = Math.max(3, Math.round(this.sides));
        const points = Array.from({ length: n }, (_, k) => {
            const angle = (2 * Math.PI * k) / n;
            return { x: radius * Math.cos(angle), y: radius * Math.sin(angle) };
        });
        const constraints: SketchConstraint[] = points.map((p, i) => ({
            type: "fixed",
            point: i,
            x: p.x,
            y: p.y,
        }));
        return new SketchNode({ document: this.document, plane, points, constraints });
    }
}
