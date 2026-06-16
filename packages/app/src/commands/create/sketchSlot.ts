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

// Sketch Slot: a rounded slot (two parallel sides closed by semicircular end caps) drawn from its
// centre line plus a radius, created as an editable SketchNode. The two side segments are straight
// and the two end segments are bulged ±1 into semicircles.
@command({
    key: "create.sketchSlot",
    icon: "icon-rect",
})
export class SketchSlot extends CreateCommand {
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
            new PointStep("prompt.pickNextPoint", this.getSecondPointData),
        ];
    }

    private readonly getSecondPointData = (): PointSnapData => {
        return {
            refPoint: () => this.stepDatas[0].point!,
            dimension: Dimensions.D1D2D3,
            validator: (point: XYZ) => this.stepDatas[0].point!.distanceTo(point) > Precision.Distance,
            preview: (point: XYZ | undefined) => {
                const start = this.stepDatas[0].point!;
                if (!point) return [this.meshPoint(start)];
                return [this.meshPoint(start), this.meshLine(start, point)];
            },
        };
    };

    protected override geometryNode(): GeometryNode {
        const p0 = this.stepDatas[0].point!;
        const p1 = this.stepDatas[1].point!;
        const view = this.stepDatas[0].view;
        const xvec = p1.sub(p0).normalize() ?? XYZ.unitX;
        const plane = new Plane({ origin: p0, normal: view.workplane.normal, xvec });
        const length = p0.distanceTo(p1);
        const r = this.radius;
        // Outline in plane-local coords: top side, right cap, bottom side, left cap.
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
        // Segments: 0 top (line), 1 right cap (arc), 2 bottom (line), 3 left cap (arc).
        return new SketchNode({ document: this.document, plane, points, constraints, bulges: [0, 1, 0, 1] });
    }
}
