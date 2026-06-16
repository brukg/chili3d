// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    command,
    GeometryNode,
    GetOrSelectNodeStep,
    type IStep,
    Material,
    PubSub,
    property,
    Transaction,
} from "@chili3d/core";
import { MultistepCommand } from "../multistepCommand";

// Set Color: apply an appearance colour to the selected body(ies). A new material of the chosen
// colour is created and assigned to each selection — Fusion's appearance/colour override. The colour
// property renders as a colour picker in the property panel.
@command({
    key: "modify.setColor",
    icon: "icon-addBrush",
})
export class SetColor extends MultistepCommand {
    @property("common.color", { type: "color" })
    get color(): number {
        return this.getPrivateValue("color", 0x1890ff);
    }
    set color(value: number) {
        this.setProperty("color", value);
    }

    protected override getSteps(): IStep[] {
        return [new GetOrSelectNodeStep("prompt.select.models", { multiple: true })];
    }

    protected override executeMainTask(): void {
        const nodes = (this.stepDatas[0].nodes ?? []).filter(
            (n): n is GeometryNode => n instanceof GeometryNode,
        );
        if (nodes.length === 0) {
            PubSub.default.pub("showToast", "toast.select.noSelected");
            return;
        }

        Transaction.execute(this.document, "set color", () => {
            // One shared material for this colour assignment, reused across the whole selection.
            const material = new Material({
                document: this.document,
                name: `Color ${this.color.toString(16)}`,
                color: this.color,
            });
            this.document.modelManager.materials.push(material);
            for (const node of nodes) {
                node.materialId = material.id;
            }
            this.document.visual.update();
        });
    }
}
