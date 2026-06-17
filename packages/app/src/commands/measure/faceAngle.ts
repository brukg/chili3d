// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { command, type IFace, type IStep, PubSub, SelectShapeStep, ShapeTypes } from "@chili3d/core";
import { MultistepCommand } from "../multistepCommand";

// Measure Face Angle: the angle between two planar faces, taken between their outward normals
// (Fusion's face-to-face angle). Adjacent box faces read 90°, opposite faces 180°, coplanar 0°.
@command({
    key: "measure.faceAngle",
    icon: "icon-measureAngle",
})
export class FaceAngleMeasure extends MultistepCommand {
    protected override getSteps(): IStep[] {
        return [
            new SelectShapeStep(ShapeTypes.face, "prompt.select.faces"),
            new SelectShapeStep(ShapeTypes.face, "prompt.select.faces", { keepSelection: true }),
        ];
    }

    protected override executeMainTask(): void {
        const first = this.stepDatas[0].shapes[0];
        const second = this.stepDatas[1].shapes[0];
        if (!first || !second) {
            PubSub.default.pub("showToast", "toast.select.noSelected");
            return;
        }

        const n1 = (first.shape.transformedMul(first.transform) as IFace).normal(0, 0)[1];
        const n2 = (second.shape.transformedMul(second.transform) as IFace).normal(0, 0)[1];
        const rad = n1.angleTo(n2);
        if (rad === undefined) {
            PubSub.default.pub("showToast", "error.default:{0}", "cannot evaluate face normals");
            return;
        }

        PubSub.default.pub("showToast", "toast.measure.faceAngle:{0}", ((rad * 180) / Math.PI).toFixed(2));
    }
}
