// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    command,
    GetOrSelectNodeStep,
    type IStep,
    Plane,
    PubSub,
    Transaction,
    VisualNode,
    XYZ,
} from "@chili3d/core";
import { BoxNode } from "../../bodys";
import { MultistepCommand } from "../multistepCommand";

// Create Bounding Box: build an axis-aligned box matching the combined world bounding box of the
// selected object(s) — the "stock"/extents box used to gauge overall size or as machining stock.
@command({
    key: "create.boundingBox",
    icon: "icon-box",
})
export class CreateBoundingBox extends MultistepCommand {
    protected override executeMainTask(): void {
        const nodes = (this.stepDatas[0].nodes ?? []).filter((n): n is VisualNode => n instanceof VisualNode);
        if (nodes.length === 0) {
            PubSub.default.pub("showToast", "toast.select.noSelected");
            return;
        }

        let minX = Number.POSITIVE_INFINITY;
        let minY = Number.POSITIVE_INFINITY;
        let minZ = Number.POSITIVE_INFINITY;
        let maxX = Number.NEGATIVE_INFINITY;
        let maxY = Number.NEGATIVE_INFINITY;
        let maxZ = Number.NEGATIVE_INFINITY;
        for (const node of nodes) {
            const box = node.boundingBox();
            if (!box) continue;
            minX = Math.min(minX, box.min.x);
            minY = Math.min(minY, box.min.y);
            minZ = Math.min(minZ, box.min.z);
            maxX = Math.max(maxX, box.max.x);
            maxY = Math.max(maxY, box.max.y);
            maxZ = Math.max(maxZ, box.max.z);
        }
        if (!Number.isFinite(minX)) {
            PubSub.default.pub("showToast", "toast.select.noSelected");
            return;
        }

        const plane = new Plane({
            origin: new XYZ({ x: minX, y: minY, z: minZ }),
            normal: XYZ.unitZ,
            xvec: XYZ.unitX,
        });
        Transaction.execute(this.document, "bounding box", () => {
            const box = new BoxNode({
                document: this.document,
                plane,
                dx: maxX - minX,
                dy: maxY - minY,
                dz: maxZ - minZ,
            });
            (nodes[0].parent ?? this.document.modelManager.rootNode).add(box);
            this.document.visual.update();
        });
    }

    protected override getSteps(): IStep[] {
        return [new GetOrSelectNodeStep("prompt.select.models", { multiple: true })];
    }
}
