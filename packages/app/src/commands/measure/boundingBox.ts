// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { command, GetOrSelectNodeStep, type IStep, PubSub, VisualNode } from "@chili3d/core";
import { MultistepCommand } from "../multistepCommand";

// Measure Bounding Box: report the overall size (dx × dy × dz) of the selected object(s) from their
// combined world-space bounding box — the "overall dimensions" readout in a measure/inspect panel.
@command({
    key: "measure.boundingBox",
    icon: "icon-measureSelect",
})
export class BoundingBoxMeasure extends MultistepCommand {
    protected override getSteps(): IStep[] {
        return [new GetOrSelectNodeStep("prompt.select.models", { multiple: true })];
    }

    protected override executeMainTask(): void {
        const nodes = (this.stepDatas[0].nodes ?? []).filter((n): n is VisualNode => n instanceof VisualNode);
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

        PubSub.default.pub(
            "showToast",
            "toast.measure.boundingBox:{0}{1}{2}",
            (maxX - minX).toFixed(2),
            (maxY - minY).toFixed(2),
            (maxZ - minZ).toFixed(2),
        );
    }
}
