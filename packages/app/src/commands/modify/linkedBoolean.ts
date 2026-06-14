// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    command,
    type IStep,
    PubSub,
    SelectShapeStep,
    ShapeNode,
    ShapeTypes,
    Transaction,
    VisualStates,
} from "@chili3d/core";
import { LinkedBooleanNode, type LinkedBooleanType } from "../../bodys/linkedBoolean";
import { MultistepCommand } from "../multistepCommand";

/**
 * Non-destructive boolean: selects 2+ shapes (same selection as `BooleanOperate`) but KEEPS the
 * inputs editable and creates a `LinkedBooleanNode` referencing their ids. Editing an input rebuilds
 * the result automatically through the referential-feature engine.
 */
export abstract class LinkedBooleanOperate extends MultistepCommand {
    protected override executeMainTask() {
        Transaction.execute(this.document, "linkedBoolean", () => {
            const inputIds = [...(this.stepDatas[0].nodes ?? []), ...(this.stepDatas[1].nodes ?? [])].map(
                (n) => n.id,
            );
            if (inputIds.length < 2) {
                PubSub.default.pub(
                    "showToast",
                    "error.default:{0}",
                    "linked boolean needs at least two inputs",
                );
                return;
            }
            const node = new LinkedBooleanNode({
                document: this.document,
                inputIds,
                booleanType: this.getType(),
            });
            this.document.modelManager.rootNode.add(node);
            this.document.visual.update();
        });
    }

    protected abstract getType(): LinkedBooleanType;

    protected override getSteps(): IStep[] {
        return [
            new SelectShapeStep(ShapeTypes.shape, "prompt.select.shape", {
                nodeFilter: { allow: (node) => node instanceof ShapeNode },
            }),
            new SelectShapeStep(ShapeTypes.shape, "prompt.select.shape", {
                nodeFilter: {
                    allow: (node) => {
                        if (!(node instanceof ShapeNode)) {
                            return false;
                        }

                        return !this.stepDatas[0].nodes
                            ?.map((x) => (x as ShapeNode).shape.value)
                            .includes(node.shape.value);
                    },
                },
                multiple: true,
                keepSelection: true,
                selectedState: VisualStates.faceTransparent,
            }),
        ];
    }
}

@command({
    key: "modify.linkedCommon",
    icon: "icon-booleanCommon",
})
export class LinkedCommon extends LinkedBooleanOperate {
    protected override getType(): LinkedBooleanType {
        return "common";
    }
}

@command({
    key: "modify.linkedCut",
    icon: "icon-booleanCut",
})
export class LinkedCut extends LinkedBooleanOperate {
    protected override getType(): LinkedBooleanType {
        return "cut";
    }
}

@command({
    key: "modify.linkedFuse",
    icon: "icon-booleanFuse",
})
export class LinkedFuse extends LinkedBooleanOperate {
    protected override getType(): LinkedBooleanType {
        return "fuse";
    }
}
