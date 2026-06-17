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
    PubSub,
    property,
    type SketchConstraint,
    XYZ,
} from "@chili3d/core";
import { SketchNode } from "../../bodys";
import { CreateCommand } from "../createCommand";

// Sketch Overall Slot: the two picked points are the slot's outermost ends (total length), so the arc
// centres are inset from them by the radius — Fusion's overall (two-point) slot, complementing the
// centre-to-centre Slot and the centre-point Slot.
@command({
    key: "create.sketchOverallSlot",
    icon: "icon-rect",
})
export class SketchOverallSlot extends CreateCommand {
    @property("circle.radius")
    get radius() {
        return this.getPrivateValue("radius", 5);
    }
    set radius(value: number) {
        this.setProperty("radius", value);
    }

    protected override getSteps(): IStep[] {
        return [
            new PointStep("prompt.pickFistPoint"),
            new PointStep("prompt.pickNextPoint", this.getEndData),
        ];
    }

    private readonly getEndData = (): PointSnapData => ({
        refPoint: () => this.stepDatas[0].point!,
        dimension: Dimensions.D1D2D3,
        validator: (point: XYZ) => this.stepDatas[0].point!.distanceTo(point) > Precision.Distance,
        preview: (point: XYZ | undefined) => {
            const start = this.stepDatas[0].point!;
            if (!point) return [this.meshPoint(start)];
            return [this.meshPoint(start), this.meshLine(start, point)];
        },
    });

    protected override geometryNode(): GeometryNode {
        const a = this.stepDatas[0].point!;
        const b = this.stepDatas[1].point!;
        const view = this.stepDatas[0].view;
        const dir = b.sub(a).normalize() ?? XYZ.unitX;
        const r = this.radius;
        // The picked points are the outer extremes; inset by r to get the arc centres.
        if (a.distanceTo(b) <= 2 * r) {
            PubSub.default.pub("showToast", "error.default:{0}", "slot too short for this radius");
        }
        const p0 = a.add(dir.multiply(r));
        const p1 = b.sub(dir.multiply(r));
        const plane = new Plane({ origin: p0, normal: view.workplane.normal, xvec: dir });
        const length = p0.distanceTo(p1);
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
