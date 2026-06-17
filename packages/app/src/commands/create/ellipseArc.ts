// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { command, EditableShapeNode, type GeometryNode, I18n, property } from "@chili3d/core";
import { Ellipse } from "./ellipse";

// Create Elliptical Arc: pick the centre, major axis and minor axis exactly like Ellipse, then keep
// only the portion between the start and end angles (degrees, editable) — Fusion's elliptical arc.
@command({
    key: "create.ellipseArc",
    icon: "icon-ellipse",
})
export class EllipseArc extends Ellipse {
    @property("arc.start")
    get startAngle() {
        return this.getPrivateValue("startAngle", 0);
    }
    set startAngle(value: number) {
        this.setProperty("startAngle", value);
    }

    @property("arc.angle")
    get sweepAngle() {
        return this.getPrivateValue("sweepAngle", 180);
    }
    set sweepAngle(value: number) {
        this.setProperty("sweepAngle", value);
    }

    protected override geometryNode(): GeometryNode {
        const [p0, p1, p2] = [this.stepDatas[0].point!, this.stepDatas[1].point!, this.stepDatas[2].point!];
        const plane = this.stepDatas[1].plane!;
        const d1 = plane.projectDistance(p0, p1);
        const d2 = plane.projectDistance(p0, p2);
        const start = (this.startAngle * Math.PI) / 180;
        const end = start + (this.sweepAngle * Math.PI) / 180;
        const arc = shapeFactory.ellipseArc(plane.normal, p0, p1.sub(p0), d1, d2 > d1 ? d1 : d2, start, end);
        return new EditableShapeNode({
            document: this.document,
            name: I18n.translate("command.create.ellipseArc"),
            shape: arc,
        });
    }
}
