// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    command,
    EditableShapeNode,
    type IStep,
    PointStep,
    PubSub,
    Transaction,
    type XYZ,
} from "@chili3d/core";
import { MultistepCommand } from "../multistepCommand";

// Construction Axis through two points — Fusion's "axis through two points". Pick two points (snapping
// to vertices); the axis is the line through them, extended a point-gap beyond each end so it reads as
// a reference axis rather than a bounded segment.
@command({
    key: "create.axisTwoPoints",
    icon: "icon-line",
})
export class AxisTwoPoints extends MultistepCommand {
    protected override getSteps(): IStep[] {
        return [new PointStep("prompt.pickFistPoint"), new PointStep("prompt.pickNextPoint")];
    }

    protected override executeMainTask(): void {
        const axis = extendAxis(this.stepDatas[0].point!, this.stepDatas[1].point!);
        if (!axis) {
            PubSub.default.pub("showToast", "toast.converter.error");
            return;
        }
        const line = shapeFactory.line(axis.start, axis.end);
        if (!line.isOk) {
            PubSub.default.pub("showToast", "error.default:{0}", line.error);
            return;
        }
        Transaction.execute(this.document, "axis through two points", () => {
            const node = new EditableShapeNode({ document: this.document, name: "Axis", shape: line.value });
            this.document.modelManager.addNode(node);
            this.document.visual.update();
        });
    }
}

// Exposed for unit testing the axis-extension math without a running document.
export function extendAxis(a: XYZ, b: XYZ): { start: XYZ; end: XYZ } | undefined {
    const dir = b.sub(a).normalize();
    if (!dir) return undefined;
    const gap = a.distanceTo(b);
    return { start: a.sub(dir.multiply(gap)), end: b.add(dir.multiply(gap)) };
}
