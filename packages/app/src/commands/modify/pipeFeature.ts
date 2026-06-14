// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    command,
    type IEdge,
    type IFace,
    type IStep,
    type IWire,
    PubSub,
    SelectShapeStep,
    ShapeNode,
    ShapeTypes,
    Transaction,
} from "@chili3d/core";
import { PipeFeatureNode } from "../../bodys/pipeFeature";
import { MultistepCommand } from "../multistepCommand";

@command({
    key: "modify.pipeFeature",
    icon: "icon-booleanFuse",
})
export class PipeFeature extends MultistepCommand {
    protected override getSteps(): IStep[] {
        return [
            new SelectShapeStep(ShapeTypes.shape, "prompt.select.shape", {
                nodeFilter: { allow: (node) => node instanceof ShapeNode },
            }),
            new SelectShapeStep(ShapeTypes.face, "prompt.select.shape", {}),
            new SelectShapeStep(ShapeTypes.face, "prompt.select.shape", {}),
            new SelectShapeStep(ShapeTypes.edge, "prompt.select.shape", {}),
        ];
    }

    protected override executeMainTask() {
        Transaction.execute(this.document, "pipeFeature", () => {
            const base = this.transformdFirstShape(this.stepDatas[0]);
            const profileFace = this.transformdFirstShape(this.stepDatas[1]);
            const sketchFace = this.transformdFirstShape(this.stepDatas[2]);

            const spineShape = this.transformdFirstShape(this.stepDatas[3]);
            let spineWire = spineShape as IWire;
            if (spineShape.shapeType !== ShapeTypes.wire) {
                spineWire = shapeFactory.wire([spineShape as IEdge]).value;
            }

            const result = shapeFactory.pipeFeature(
                base,
                profileFace as IFace,
                sketchFace as IFace,
                spineWire,
                true,
            );
            if (!result.isOk) {
                PubSub.default.pub("showToast", "error.default:{0}", "pipe feature failed");
                return;
            }

            const node = new PipeFeatureNode({ document: this.document, pipeShape: result.value });
            this.document.modelManager.rootNode.add(node);
            this.stepDatas.forEach((x) => {
                x.nodes?.forEach((n) => n.parent?.remove(n));
            });
            this.document.visual.update();
        });
    }
}
