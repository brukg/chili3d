// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { command, type IStep, PubSub, SelectShapeStep, ShapeTypes } from "@chili3d/core";
import { MultistepCommand } from "../multistepCommand";

// Measure Oriented Bounding Box: report the dimensions of the *minimal* (oriented) box enclosing the
// shape — the true part size regardless of how the body is rotated in space, for stock sizing. Unlike
// Measure Bounding Box, which gives the axis-aligned extents (inflated when the part sits at an angle).
@command({
    key: "measure.orientedBoundingBox",
    icon: "icon-measureSelect",
})
export class OrientedBoundingBoxMeasure extends MultistepCommand {
    protected override getSteps(): IStep[] {
        return [new SelectShapeStep(ShapeTypes.shape, "prompt.select.shape")];
    }

    protected override executeMainTask(): void {
        const shape = this.transformdFirstShape(this.stepDatas[0]);
        if (!shape) {
            PubSub.default.pub("showToast", "toast.select.noSelected");
            return;
        }

        const obb = shape.orientedBoundingBox();
        // OCCT reports half-extents; the full side lengths are twice that. Sort descending so the readout
        // is stable no matter how the body is oriented.
        const dims = [obb.size.x, obb.size.y, obb.size.z].map((h) => 2 * h).sort((a, b) => b - a);

        PubSub.default.pub(
            "showToast",
            "toast.measure.orientedBoundingBox:{0}{1}{2}",
            dims[0].toFixed(2),
            dims[1].toFixed(2),
            dims[2].toFixed(2),
        );
    }
}
