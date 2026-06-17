// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    command,
    type IFace,
    type IStep,
    Matrix4,
    PubSub,
    SelectShapeStep,
    type ShapeNode,
    ShapeTypes,
    Transaction,
    XYZ,
} from "@chili3d/core";
import { MultistepCommand } from "../multistepCommand";

// Any unit vector perpendicular to n (for the 180° flip when the faces are already anti-parallel).
function perpendicular(n: XYZ): XYZ {
    const ref = Math.abs(n.x) < 0.9 ? XYZ.unitX : XYZ.unitY;
    return ref.cross(n).normalize() ?? XYZ.unitX;
}

// World transform that mates a source face (point p1, outward normal n1) flat against a target face
// (point p2, outward normal n2): rotate so n1 opposes n2, then slide p1 onto p2. Pure + testable.
export function alignTransform(p1: XYZ, n1: XYZ, p2: XYZ, n2: XYZ): Matrix4 {
    const a = n1.normalize() ?? XYZ.unitZ;
    const t = (n2.normalize() ?? XYZ.unitZ).multiply(-1); // faces oppose ⇒ target direction is −n2
    const dot = Math.max(-1, Math.min(1, a.dot(t)));

    let rotation: Matrix4;
    if (dot > 1 - 1e-9) {
        rotation = Matrix4.identity(); // already aligned
    } else if (dot < -1 + 1e-9) {
        rotation = Matrix4.fromAxisRad(p1, perpendicular(a), Math.PI); // anti-parallel ⇒ 180° flip
    } else {
        rotation = Matrix4.fromAxisRad(p1, a.cross(t).normalize()!, Math.acos(dot));
    }
    const move = p2.sub(p1);
    // R first, then translate p1→p2 (A.multiply(B) applies A before B).
    return rotation.multiply(Matrix4.fromTranslation(move.x, move.y, move.z));
}

// Align: move the body owning the first selected face so that face sits flat against the second face
// (Fusion's Align / face-to-face mate).
@command({
    key: "modify.align",
    icon: "icon-move",
})
export class AlignCommand extends MultistepCommand {
    protected override executeMainTask(): void {
        const first = this.stepDatas[0].shapes[0];
        const second = this.stepDatas[1].shapes[0];
        const node = first?.owner.node as ShapeNode | undefined;
        if (!first || !second || !node) {
            PubSub.default.pub("showToast", "toast.select.noSelected");
            return;
        }
        const [p1, n1] = (first.shape.transformedMul(first.transform) as IFace).normal(0, 0);
        const [p2, n2] = (second.shape.transformedMul(second.transform) as IFace).normal(0, 0);

        Transaction.execute(this.document, "align", () => {
            node.transform = node.transform.multiply(alignTransform(p1, n1, p2, n2));
            this.document.visual.update();
        });
    }

    protected override getSteps(): IStep[] {
        return [
            new SelectShapeStep(ShapeTypes.face, "prompt.select.faces"),
            new SelectShapeStep(ShapeTypes.face, "prompt.select.faces", { keepSelection: true }),
        ];
    }
}
