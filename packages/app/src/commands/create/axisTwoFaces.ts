// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    command,
    EditableShapeNode,
    type IFace,
    type IStep,
    PubSub,
    SelectShapeStep,
    ShapeTypes,
    Transaction,
} from "@chili3d/core";
import { MultistepCommand } from "../multistepCommand";
import { intersectTwoPlanes } from "./arcUtils";

// Construction Axis at the intersection of two planar faces — the reference line where the two planes
// meet (Fusion's "axis through two planes"). Distinct from the line tool: the axis is derived from the
// geometry, so it tracks the faces. The line is drawn long enough to span both faces' extents.
@command({
    key: "create.axisTwoFaces",
    icon: "icon-line",
})
export class AxisTwoFaces extends MultistepCommand {
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

        const f1 = first.shape.transformedMul(first.transform) as IFace;
        const f2 = second.shape.transformedMul(second.transform) as IFace;
        const [p1, n1] = f1.normal(0, 0);
        const [p2, n2] = f2.normal(0, 0);

        const axis = intersectTwoPlanes(p1, n1, p2, n2);
        if (!axis) {
            PubSub.default.pub("showToast", "error.default:{0}", "faces are parallel — no intersection");
            return;
        }

        // Span the axis across both faces: use their combined size so the line reaches past each face.
        const half = axis.direction.multiply(Math.max(this.diagonal(f1) + this.diagonal(f2), 1));
        const line = shapeFactory.line(axis.point.sub(half), axis.point.add(half));
        if (!line.isOk) {
            PubSub.default.pub("showToast", "error.default:{0}", line.error);
            return;
        }

        Transaction.execute(this.document, "axis at faces intersection", () => {
            const node = new EditableShapeNode({ document: this.document, name: "Axis", shape: line.value });
            this.document.modelManager.addNode(node);
            this.document.visual.update();
        });
    }

    private diagonal(face: IFace): number {
        const { min, max } = face.boundingBox();
        return Math.hypot(max.x - min.x, max.y - min.y, max.z - min.z);
    }
}
