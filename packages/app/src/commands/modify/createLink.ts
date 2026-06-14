// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { command, GetOrSelectNodeStep, type IStep, LinkNode, Transaction, VisualNode } from "@chili3d/core";
import { MultistepCommand } from "../multistepCommand";

@command({
    key: "modify.createLink",
    icon: "icon-fillet",
})
export class CreateLinkCommand extends MultistepCommand {
    protected override getSteps(): IStep[] {
        return [new GetOrSelectNodeStep("prompt.select.shape", { multiple: false })];
    }

    protected override executeMainTask(): void {
        const nodes = this.stepDatas[0].nodes?.filter((node) => node instanceof VisualNode);
        if (!nodes || nodes.length === 0) {
            return;
        }
        Transaction.execute(this.document, `execute ${Object.getPrototypeOf(this).data.name}`, () => {
            const node = nodes[0];
            const parent = node.parent ?? this.document.modelManager.rootNode;
            const link = new LinkNode({ document: this.document, name: "Link" });
            parent.insertBefore(node, link);
            parent.move(node, link);
            this.document.visual.update();
        });
    }
}
