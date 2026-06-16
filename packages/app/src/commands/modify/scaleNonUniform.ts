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

// Non-uniform Scale: resize the selected object(s) by independent X / Y / Z factors about each one's
// own bounding-box centre — Fusion's non-uniform scale. Applied as a transform (post-multiplied,
// matching the engine's multiply convention), like Move/Rotate/Scale.
@command({
    key: "modify.scaleNonUniform",
    icon: "icon-move",
})
export class ScaleNonUniform extends MultistepCommand {
    @property("option.command.scaleX")
    get scaleX() {
        return this.getPrivateValue("scaleX", 2);
    }
    set scaleX(value: number) {
        this.setProperty("scaleX", value);
    }

    @property("option.command.scaleY")
    get scaleY() {
        return this.getPrivateValue("scaleY", 1);
    }
    set scaleY(value: number) {
        this.setProperty("scaleY", value);
    }

    @property("option.command.scaleZ")
    get scaleZ() {
        return this.getPrivateValue("scaleZ", 1);
    }
    set scaleZ(value: number) {
        this.setProperty("scaleZ", value);
    }

    protected override executeMainTask(): void {
        const nodes = (this.stepDatas[0].nodes ?? []).filter((n): n is VisualNode => n instanceof VisualNode);
        if (nodes.length === 0) {
            PubSub.default.pub("showToast", "toast.select.noSelected");
            return;
        }

        const { scaleX, scaleY, scaleZ } = this;
        Transaction.execute(this.document, "scale non-uniform", () => {
            for (const node of nodes) {
                const box = node.boundingBox();
                let matrix: Matrix4;
                if (box) {
                    const cx = (box.min.x + box.max.x) / 2;
                    const cy = (box.min.y + box.max.y) / 2;
                    const cz = (box.min.z + box.max.z) / 2;
                    matrix = Matrix4.fromTranslation(-cx, -cy, -cz)
                        .multiply(Matrix4.fromScale(scaleX, scaleY, scaleZ))
                        .multiply(Matrix4.fromTranslation(cx, cy, cz));
                } else {
                    matrix = Matrix4.fromScale(scaleX, scaleY, scaleZ);
                }
                node.transform = node.transform.multiply(matrix);
            }
        });
        this.document.visual.update();
    }

    protected override getSteps(): IStep[] {
        return [new GetOrSelectNodeStep("prompt.select.models", { multiple: true })];
    }
}
