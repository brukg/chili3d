// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { command, type IStep, PubSub, SelectShapeStep, ShapeTypes, Transaction, XYZ } from "@chili3d/core";
import { PointNode } from "../../bodys";
import { MultistepCommand } from "../multistepCommand";

// Point at Face Center: drop a parametric construction point at the centre of each selected face — its
// oriented-bounding-box centre, which is the centroid for a planar face and the mid-axis point for a
// cylindrical/spherical face. Fusion's "point at centre of face".
@command({
    key: "create.faceCenterPoint",
    icon: "icon-point",
})
export class FaceCenterPoint extends MultistepCommand {
    protected override getSteps(): IStep[] {
        return [new SelectShapeStep(ShapeTypes.face, "prompt.select.faces", { multiple: true })];
    }

    protected override executeMainTask(): void {
        const shapes = this.stepDatas[0].shapes;
        if (shapes.length === 0) {
            PubSub.default.pub("showToast", "toast.select.noSelected");
            return;
        }
        Transaction.execute(this.document, "point at face center", () => {
            for (const data of shapes) {
                const face = data.shape.transformedMul(data.transform);
                const position = new XYZ(face.orientedBoundingBox().center.location);
                const node = new PointNode({ document: this.document, position });
                (data.owner.node?.parent ?? this.document.modelManager.rootNode).add(node);
            }
            this.document.visual.update();
        });
        PubSub.default.pub("showToast", "toast.success");
    }
}
