// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    command,
    EditableShapeNode,
    type IEdge,
    type IStep,
    type IWire,
    Plane,
    PubSub,
    SelectShapeStep,
    type ShapeType,
    ShapeTypes,
    Transaction,
    XYZ,
} from "@chili3d/core";
import { MultistepCommand } from "../multistepCommand";

// Project to Plane: orthographically project the selected edges/wires onto the active workplane along
// its normal — Fusion's "Project" geometry into the active sketch. The projected curves become a new
// compound, so a body's silhouette/edges can be traced into a 2D profile.
@command({
    key: "create.projectToPlane",
    icon: "icon-curveProject",
})
export class ProjectToPlane extends MultistepCommand {
    protected override getSteps(): IStep[] {
        return [
            new SelectShapeStep((ShapeTypes.edge | ShapeTypes.wire) as ShapeType, "prompt.select.edges", {
                multiple: true,
            }),
        ];
    }

    protected override executeMainTask(): void {
        const shapes = this.stepDatas[0].shapes;
        if (shapes.length === 0) {
            PubSub.default.pub("showToast", "toast.select.noSelected");
            return;
        }
        const wp = this.application.activeView!.workplane;
        const curves = shapes.map((d) => d.shape.transformedMul(d.transform) as IEdge | IWire);

        // A target face on the workplane, centred on the curves and large enough to receive them.
        let cx = 0;
        let cy = 0;
        let cz = 0;
        let span = 1;
        for (const c of curves) {
            const bb = c.boundingBox();
            cx += (bb.min.x + bb.max.x) / 2;
            cy += (bb.min.y + bb.max.y) / 2;
            cz += (bb.min.z + bb.max.z) / 2;
            span = Math.max(span, Math.hypot(bb.max.x - bb.min.x, bb.max.y - bb.min.y, bb.max.z - bb.min.z));
        }
        const center = new XYZ({ x: cx / curves.length, y: cy / curves.length, z: cz / curves.length });
        const big = 2 * span + 1;
        const corner = center.sub(wp.xvec.multiply(big)).sub(wp.yvec.multiply(big));
        const face = shapeFactory.rect(
            new Plane({ origin: corner, normal: wp.normal, xvec: wp.xvec }),
            2 * big,
            2 * big,
        );
        if (!face.isOk) {
            PubSub.default.pub("showToast", "error.default:{0}", face.error);
            return;
        }

        const edges: IEdge[] = [];
        for (const curve of curves) {
            const projected = shapeFactory.curveProjection(curve, face.value, wp.normal);
            if (projected.isOk) edges.push(...(projected.value.findSubShapes(ShapeTypes.edge) as IEdge[]));
        }
        if (edges.length === 0) {
            PubSub.default.pub("showToast", "toast.converter.error");
            return;
        }
        const compound = shapeFactory.combine(edges);
        if (!compound.isOk) {
            PubSub.default.pub("showToast", "error.default:{0}", compound.error);
            return;
        }
        Transaction.execute(this.document, "project to plane", () => {
            const node = new EditableShapeNode({
                document: this.document,
                name: "Projection",
                shape: compound.value,
            });
            this.document.modelManager.addNode(node);
            this.document.visual.update();
        });
    }
}
