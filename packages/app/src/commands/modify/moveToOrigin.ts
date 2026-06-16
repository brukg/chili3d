// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    command,
    GetOrSelectNodeStep,
    type IStep,
    Matrix4,
    PubSub,
    Transaction,
    VisualNode,
} from "@chili3d/core";
import { MultistepCommand } from "../multistepCommand";

// Move to Origin: translate the selected object(s) so the centre of their combined (world-space)
// bounding box sits at the world origin, preserving their relative arrangement. Handy for recentring
// imported parts or orienting a body for export. Applied as a pure translation on each node's
// transform, post-multiplied to act in world space (matching the engine's multiply convention).
@command({
    key: "modify.moveToOrigin",
    icon: "icon-move",
})
export class MoveToOrigin extends MultistepCommand {
    protected override executeMainTask(): void {
        const nodes = (this.stepDatas[0].nodes ?? []).filter((n): n is VisualNode => n instanceof VisualNode);
        if (nodes.length === 0) {
            PubSub.default.pub("showToast", "toast.select.noSelected");
            return;
        }

        // Union the world bounding boxes to find the centre of the whole selection.
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

        const dx = -(minX + maxX) / 2;
        const dy = -(minY + maxY) / 2;
        const dz = -(minZ + maxZ) / 2;
        const translation = Matrix4.fromTranslation(dx, dy, dz);

        Transaction.execute(this.document, "move to origin", () => {
            for (const node of nodes) {
                node.transform = node.transform.multiply(translation);
            }
        });
        this.document.visual.update();
    }

    protected override getSteps(): IStep[] {
        return [new GetOrSelectNodeStep("prompt.select.models", { multiple: true })];
    }
}
