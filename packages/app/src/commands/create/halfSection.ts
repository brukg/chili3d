// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    command,
    EditableShapeNode,
    type IStep,
    Plane,
    PubSub,
    SelectShapeStep,
    ShapeTypes,
    Transaction,
    XYZ,
} from "@chili3d/core";
import { MultistepCommand } from "../multistepCommand";

// Half Section (cutaway): cut the selected solid with a plane through its centre (parallel to the
// active workplane) and keep the half on the back side of the workplane normal, exposing the interior —
// a one-step section/cutaway view. The original body is kept; the cutaway is a new body.
@command({
    key: "create.halfSection",
    icon: "icon-section",
})
export class HalfSection extends MultistepCommand {
    protected override getSteps(): IStep[] {
        return [new SelectShapeStep(ShapeTypes.solid, "prompt.select.solids")];
    }

    protected override executeMainTask(): void {
        const data = this.stepDatas[0].shapes[0];
        if (!data) {
            PubSub.default.pub("showToast", "toast.select.noSelected");
            return;
        }
        const shape = data.shape.transformedMul(data.transform);
        const bb = shape.boundingBox();
        const center = new XYZ({
            x: (bb.min.x + bb.max.x) / 2,
            y: (bb.min.y + bb.max.y) / 2,
            z: (bb.min.z + bb.max.z) / 2,
        });
        const wp = this.application.activeView!.workplane;
        const big = 2 * Math.hypot(bb.max.x - bb.min.x, bb.max.y - bb.min.y, bb.max.z - bb.min.z) + 1;

        // A box covering the +normal half-space at the cut plane: corner stepped back by `big` in-plane.
        const corner = center.sub(wp.xvec.multiply(big)).sub(wp.yvec.multiply(big));
        const cutter = shapeFactory.box(
            new Plane({ origin: corner, normal: wp.normal, xvec: wp.xvec }),
            2 * big,
            2 * big,
            big,
        );
        if (!cutter.isOk) {
            PubSub.default.pub("showToast", "error.default:{0}", cutter.error);
            return;
        }
        const result = shapeFactory.booleanCut([shape], [cutter.value]);
        if (!result.isOk) {
            PubSub.default.pub("showToast", "error.default:{0}", result.error);
            return;
        }
        Transaction.execute(this.document, "half section", () => {
            const node = new EditableShapeNode({
                document: this.document,
                name: "Cutaway",
                shape: result.value,
            });
            this.document.modelManager.addNode(node);
            this.document.visual.update();
        });
    }
}
