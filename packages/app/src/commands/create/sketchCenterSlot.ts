// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    command,
    Dimensions,
    type GeometryNode,
    type IStep,
    Plane,
    type PointSnapData,
    PointStep,
    Precision,
    property,
    type SketchConstraint,
    XYZ,
} from "@chili3d/core";
import { SketchNode } from "../../bodys";
import { CreateCommand } from "../createCommand";

// Sketch Center-Point Slot: pick the slot's centre, then one end (an arc centre); the opposite end is
// mirrored through the centre. Same rounded-slot geometry as the centre-to-centre Slot, defined from its
// middle — Fusion's centre-point slot.
@command({
    key: "create.sketchCenterSlot",
    icon: "icon-rect",
})
export class SketchCenterSlot extends CreateCommand {
    @property("circle.radius")
    get radius() {
        return this.getPrivateValue("radius", 5);
    }
    set radius(value: number) {
        this.setProperty("radius", value);
    }

    protected override getSteps(): IStep[] {
        return [
            new PointStep("prompt.pickCircleCenter"),
            new PointStep("prompt.pickNextPoint", this.getEndData),
        ];
    }

    private readonly getEndData = (): PointSnapData => ({
        refPoint: () => this.stepDatas[0].point!,
        dimension: Dimensions.D1D2D3,
        validator: (point: XYZ) => this.stepDatas[0].point!.distanceTo(point) > Precision.Distance,
        preview: (point: XYZ | undefined) => {
            const center = this.stepDatas[0].point!;
            if (!point) return [this.meshPoint(center)];
            const other = center.multiply(2).sub(point);
            return [this.meshPoint(center), this.meshLine(other, point)];
        },
    });

    protected override geometryNode(): GeometryNode {
        const center = this.stepDatas[0].point!;
        const end = this.stepDatas[1].point!;
        // The two arc centres are `end` and its mirror through the slot centre.
        const p0 = end;
        const p1 = center.multiply(2).sub(end);
        const view = this.stepDatas[0].view;
        const xvec = p1.sub(p0).normalize() ?? XYZ.unitX;
        const plane = new Plane({ origin: p0, normal: view.workplane.normal, xvec });
        const length = p0.distanceTo(p1);
        const r = this.radius;
        const points = [
            { x: 0, y: r },
            { x: length, y: r },
            { x: length, y: -r },
            { x: 0, y: -r },
        ];
        const constraints: SketchConstraint[] = points.map((p, i) => ({
            type: "fixed",
            point: i,
            x: p.x,
            y: p.y,
        }));
        return new SketchNode({ document: this.document, plane, points, constraints, bulges: [0, 1, 0, 1] });
    }
}
