// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    command,
    type IStep,
    Plane,
    PubSub,
    SelectShapeStep,
    ShapeTypes,
    Transaction,
    XYZ,
} from "@chili3d/core";
import { BoxNode } from "../../bodys";
import { MultistepCommand } from "../multistepCommand";

// Create Oriented Bounding Box: the tightest box enclosing the selected solid, free to rotate to the
// part's natural axes (kernel Bnd_OBB) — unlike the axis-aligned bounding box, this is the minimal
// stock box for a rotated part. The kernel returns the box centre (an Ax3) and half-extents.
@command({
    key: "create.orientedBoundingBox",
    icon: "icon-box",
})
export class CreateOrientedBoundingBox extends MultistepCommand {
    protected override executeMainTask(): void {
        const data = this.stepDatas[0].shapes[0];
        if (!data) {
            PubSub.default.pub("showToast", "toast.select.noSelected");
            return;
        }
        const shape = data.shape.transformedMul(data.transform);
        const obb = shape.orientedBoundingBox();

        const center = new XYZ(obb.center.location);
        const xDir = new XYZ(obb.center.xDirection);
        const zDir = new XYZ(obb.center.direction);
        const yDir = zDir.cross(xDir);
        const size = obb.size; // half-extents

        // The Ax3 sits at the box centre; BoxNode grows from a corner, so step back by every half-extent.
        const corner = center
            .sub(xDir.multiply(size.x))
            .sub(yDir.multiply(size.y))
            .sub(zDir.multiply(size.z));
        const plane = new Plane({ origin: corner, normal: zDir, xvec: xDir });

        Transaction.execute(this.document, "oriented bounding box", () => {
            const box = new BoxNode({
                document: this.document,
                plane,
                dx: size.x * 2,
                dy: size.y * 2,
                dz: size.z * 2,
            });
            (data.owner.node?.parent ?? this.document.modelManager.rootNode).add(box);
            this.document.visual.update();
        });
    }

    protected override getSteps(): IStep[] {
        return [new SelectShapeStep(ShapeTypes.solid, "prompt.select.solids")];
    }
}
