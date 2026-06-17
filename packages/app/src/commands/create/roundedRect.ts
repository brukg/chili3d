// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    command,
    Dimensions,
    EditableShapeNode,
    type IEdge,
    type IShape,
    type IStep,
    Plane,
    type PointSnapData,
    PointStep,
    Precision,
    property,
    type Result,
    type XYZ,
} from "@chili3d/core";
import { MultistepCommand } from "../multistepCommand";

// Build a rounded-rectangle face on `plane`: a w×h rectangle (corner at the plane origin) with each
// corner replaced by a quarter-circle of radius r. Four straight edges + four 90° arcs → wire → face.
// Exposed for testing; area = w·h − (4 − π)·r².
export function roundedRectFace(plane: Plane, w: number, h: number, r: number): Result<IShape> {
    const clamped = Math.min(r, w / 2, h / 2);
    const z = plane.normal;
    const at = (x: number, y: number) => plane.origin.add(plane.xvec.multiply(x)).add(plane.yvec.multiply(y));

    const edges: IEdge[] = [];
    const push = (e: Result<IEdge>) => {
        if (e.isOk) edges.push(e.value);
    };
    // Straight sides (bottom, right, top, left) between the corner tangent points.
    push(shapeFactory.line(at(clamped, 0), at(w - clamped, 0)));
    push(shapeFactory.line(at(w, clamped), at(w, h - clamped)));
    push(shapeFactory.line(at(w - clamped, h), at(clamped, h)));
    push(shapeFactory.line(at(0, h - clamped), at(0, clamped)));
    // Corner arcs (each a 90° CCW quarter circle about the inset corner centre).
    push(shapeFactory.arc(z, at(w - clamped, clamped), at(w - clamped, 0), 90));
    push(shapeFactory.arc(z, at(w - clamped, h - clamped), at(w, h - clamped), 90));
    push(shapeFactory.arc(z, at(clamped, h - clamped), at(clamped, h), 90));
    push(shapeFactory.arc(z, at(clamped, clamped), at(0, clamped), 90));

    const wire = shapeFactory.wire(edges);
    if (!wire.isOk) return wire as unknown as Result<IShape>;
    return wire.value.toFace();
}

// Sketch Rounded Rectangle: drag a diagonal to size the rectangle; the corner radius is an editable
// property. A common Fusion sketch primitive (rectangle with filleted corners).
@command({
    key: "create.roundedRect",
    icon: "icon-rect",
})
export class RoundedRect extends MultistepCommand {
    @property("circle.radius")
    get radius() {
        return this.getPrivateValue("radius", 2);
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

    private readonly getSecondPointData = (): PointSnapData => ({
        refPoint: () => this.stepDatas[0].point!,
        dimension: Dimensions.D1D2D3,
        validator: (point: XYZ) => this.stepDatas[0].point!.distanceTo(point) > Precision.Distance,
        preview: (point: XYZ | undefined) => {
            const start = this.stepDatas[0].point!;
            if (!point) return [this.meshPoint(start)];
            return [this.meshPoint(start), this.meshLine(start, point)];
        },
    });

    protected override executeMainTask(): void {
        const p0 = this.stepDatas[0].point!;
        const p1 = this.stepDatas[1].point!;
        const normal = this.stepDatas[0].view.workplane.normal;
        // Plane x along the dragged diagonal's in-plane projection; size = local extents of p1.
        const plane = new Plane({ origin: p0, normal, xvec: this.stepDatas[0].view.workplane.xvec });
        const local = p1.sub(p0);
        const w = local.dot(plane.xvec);
        const h = local.dot(plane.yvec);
        const corner = new Plane({
            origin: p0.add(plane.xvec.multiply(Math.min(w, 0))).add(plane.yvec.multiply(Math.min(h, 0))),
            normal,
            xvec: plane.xvec,
        });

        const face = roundedRectFace(corner, Math.abs(w), Math.abs(h), this.radius);
        if (!face.isOk) return;
        const node = new EditableShapeNode({
            document: this.document,
            name: "Rounded Rect",
            shape: face.value,
        });
        this.document.modelManager.addNode(node);
        this.document.visual.update();
    }
}
