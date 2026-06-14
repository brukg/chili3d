// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { command, type IStep, SelectShapeStep, ShapeNode, ShapeTypes, Transaction } from "@chili3d/core";
import { LinkedPathArrayNode } from "../../bodys/linkedPathArray";
import { MultistepCommand } from "../multistepCommand";

/**
 * Non-destructive pattern along a path: selects ONE source shape plus a path edge but KEEPS both
 * inputs editable and creates a {@link LinkedPathArrayNode} referencing their ids. Editing the source
 * or path rebuilds the pattern automatically through the referential-feature engine.
 */
@command({
    key: "modify.linkedPathArray",
    icon: "icon-array",
})
export class LinkedPathArrayCommand extends MultistepCommand {
    protected override executeMainTask() {
        Transaction.execute(this.document, "linkedPathArray", () => {
            const sourceId = this.stepDatas[0].nodes?.[0]?.id;
            const pathId = this.stepDatas[1].nodes?.[0]?.id;
            if (!sourceId || !pathId) {
                return;
            }
            const node = new LinkedPathArrayNode({
                document: this.document,
                sourceId,
                pathId,
                count: 5,
            });
            this.document.modelManager.rootNode.add(node);
            this.document.visual.update();
        });
    }

    protected override getSteps(): IStep[] {
        return [
            new SelectShapeStep(ShapeTypes.shape, "prompt.select.shape", {
                nodeFilter: { allow: (node) => node instanceof ShapeNode },
            }),
            new SelectShapeStep(ShapeTypes.edge, "prompt.select.edges", {
                nodeFilter: { allow: (node) => node instanceof ShapeNode },
                keepSelection: true,
            }),
        ];
    }
}
