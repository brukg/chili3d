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

// Mirror about Workplane: reflect the selected object(s) across the active workplane itself (e.g. the
// XY plane) — unlike Mirror, which reflects about a vertical plane through a picked line. Keeps the
// original and adds the mirrored copy by default.
@command({
    key: "modify.mirrorWorkplane",
    icon: "icon-mirror",
})
export class MirrorWorkplane extends MultistepCommand {
    @property("common.clone")
    get isClone() {
        return this.getPrivateValue("isClone", true);
    }
    set isClone(value: boolean) {
        this.setProperty("isClone", value);
    }

    protected override getSteps(): IStep[] {
        return [new GetOrSelectNodeStep("prompt.select.models", { multiple: true })];
    }

    protected override executeMainTask(): void {
        const nodes = (this.stepDatas[0].nodes ?? []).filter((n): n is VisualNode => n instanceof VisualNode);
        if (nodes.length === 0) {
            PubSub.default.pub("showToast", "toast.select.noSelected");
            return;
        }
        const transform = Matrix4.createMirrorWithPlane(this.application.activeView!.workplane);
        Transaction.execute(this.document, "mirror about workplane", () => {
            for (const node of nodes) {
                if (this.isClone) {
                    const clone = node.clone();
                    clone.transform = node.transform.multiply(transform);
                    node.parent?.insertAfter(node, clone);
                } else {
                    node.transform = node.transform.multiply(transform);
                }
            }
            this.document.visual.update();
        });
    }
}
