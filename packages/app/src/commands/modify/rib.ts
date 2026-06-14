// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    command,
    type IEdge,
    type IStep,
    type IWire,
    PubSub,
    SelectShapeStep,
    ShapeNode,
    ShapeTypes,
    Transaction,
} from "@chili3d/core";
import { RibNode } from "../../bodys/rib";
import { MultistepCommand } from "../multistepCommand";

@command({
    key: "modify.rib",
    icon: "icon-booleanFuse",
})
export class Rib extends MultistepCommand {
    protected override getSteps(): IStep[] {
        return [
            new SelectShapeStep(ShapeTypes.shape, "prompt.select.shape", {
                nodeFilter: { allow: (node) => node instanceof ShapeNode },
            }),
            new SelectShapeStep(ShapeTypes.shape, "prompt.select.shape", {
                nodeFilter: { allow: (node) => node instanceof ShapeNode },
            }),
        ];
    }

    protected override executeMainTask() {
        Transaction.execute(this.document, "rib", () => {
            const base = this.transformdFirstShape(this.stepDatas[0]);

            const profileShape = this.transformdFirstShape(this.stepDatas[1]);
            let profileWire = profileShape as IWire;
            if (profileShape.shapeType !== ShapeTypes.wire) {
                profileWire = shapeFactory.wire([profileShape as IEdge]).value;
            }

            const planeNormal = this.stepDatas[1].view.workplane.normal;
            const box = profileWire.boundingBox();
            const planeOrigin = {
                x: (box.min.x + box.max.x) / 2,
                y: (box.min.y + box.max.y) / 2,
                z: (box.min.z + box.max.z) / 2,
            };

            const result = shapeFactory.rib(base, profileWire, planeOrigin, planeNormal, 2, 2, true);
            if (!result.isOk) {
                PubSub.default.pub("showToast", "error.default:{0}", "rib failed");
                return;
            }

            const node = new RibNode({ document: this.document, ribShape: result.value });
            this.document.modelManager.rootNode.add(node);
            this.stepDatas.forEach((x) => {
                x.nodes?.forEach((n) => n.parent?.remove(n));
            });
            this.document.visual.update();
        });
    }
}
