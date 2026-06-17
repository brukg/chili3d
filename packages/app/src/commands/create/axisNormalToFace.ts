// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    command,
    EditableShapeNode,
    type IFace,
    type IStep,
    PointStep,
    PubSub,
    SelectShapeStep,
    ShapeTypes,
    Transaction,
} from "@chili3d/core";
import { MultistepCommand } from "../multistepCommand";

// Construction Axis normal to a face at a point — Fusion's "axis perpendicular to face at point".
// Pick a face and a point on it; the axis runs through that point along the true surface normal there
// (works on curved faces too, via the recovered surface parameters).
@command({
    key: "create.axisNormalToFace",
    icon: "icon-line",
})
export class AxisNormalToFace extends MultistepCommand {
    protected override getSteps(): IStep[] {
        return [
            new SelectShapeStep(ShapeTypes.face, "prompt.select.faces"),
            new PointStep("prompt.pickPoint"),
        ];
    }

    protected override executeMainTask(): void {
        const data = this.stepDatas[0].shapes[0];
        const face = data.shape.transformedMul(data.transform) as IFace;
        const picked = this.stepDatas[1].point!;
        const uv = face.surface().parameter(picked, 1e-3);
        if (!uv) {
            PubSub.default.pub("showToast", "toast.converter.error");
            return;
        }
        const [origin, normal] = face.normal(uv.u, uv.v);
        const { min, max } = face.boundingBox();
        const len = Math.max(Math.hypot(max.x - min.x, max.y - min.y, max.z - min.z), 1);
        const half = normal.normalize()!.multiply(len);

        const line = shapeFactory.line(origin.sub(half), origin.add(half));
        if (!line.isOk) {
            PubSub.default.pub("showToast", "error.default:{0}", line.error);
            return;
        }
        Transaction.execute(this.document, "axis normal to face", () => {
            const node = new EditableShapeNode({ document: this.document, name: "Axis", shape: line.value });
            this.document.modelManager.addNode(node);
            this.document.visual.update();
        });
    }
}
