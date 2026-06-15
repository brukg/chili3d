// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    command,
    GetOrSelectNodeStep,
    type IStep,
    Matrix4,
    PubSub,
    property,
    Transaction,
    VisualNode,
} from "@chili3d/core";
import { MultistepCommand } from "../multistepCommand";

// Scale: uniformly resize the selected object(s) about each one's own bounding-box centre, so the
// part grows/shrinks in place. Applied as a transform (like Move/Rotate) — the scale-about-centre
// matrix is post-multiplied onto each node's transform, matching the engine's multiply convention.
@command({
    key: "modify.scale",
    icon: "icon-move",
})
export class Scale extends MultistepCommand {
    @property("option.command.scale")
    get scale() {
        return this.getPrivateValue("scale", 2);
    }
    set scale(value: number) {
        this.setProperty("scale", value);
    }

    protected override executeMainTask(): void {
        const nodes = this.stepDatas[0].nodes;
        if (!nodes || nodes.length === 0) {
            PubSub.default.pub("showToast", "toast.select.noSelected");
            return;
        }

        const s = this.scale;
        Transaction.execute(this.document, "scale", () => {
            for (const node of nodes) {
                if (!(node instanceof VisualNode)) continue;
                const box = node.boundingBox();
                let scaleMatrix: Matrix4;
                if (box) {
                    const cx = (box.min.x + box.max.x) / 2;
                    const cy = (box.min.y + box.max.y) / 2;
                    const cz = (box.min.z + box.max.z) / 2;
                    scaleMatrix = Matrix4.fromTranslation(-cx, -cy, -cz)
                        .multiply(Matrix4.fromScale(s, s, s))
                        .multiply(Matrix4.fromTranslation(cx, cy, cz));
                } else {
                    scaleMatrix = Matrix4.fromScale(s, s, s);
                }
                node.transform = node.transform.multiply(scaleMatrix);
            }
        });
        this.document.visual.update();
    }

    protected override getSteps(): IStep[] {
        return [new GetOrSelectNodeStep("prompt.select.models", { multiple: true })];
    }
}
