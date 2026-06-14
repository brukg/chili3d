// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { command, type IStep, PubSub, SelectShapeStep, ShapeTypes } from "@chili3d/core";
import { checkInterference } from "../../measure/interference";
import { MultistepCommand } from "../multistepCommand";

@command({
    key: "measure.interference",
    icon: "icon-measureSelect",
})
export class InterferenceCheck extends MultistepCommand {
    protected override getSteps(): IStep[] {
        return [
            new SelectShapeStep(ShapeTypes.shape, "prompt.select.shape"),
            new SelectShapeStep(ShapeTypes.shape, "prompt.select.shape", {
                keepSelection: true,
            }),
        ];
    }

    protected override executeMainTask(): void {
        const shapeA = this.transformdFirstShape(this.stepDatas[0]);
        const shapeB = this.transformdFirstShape(this.stepDatas[1]);
        const result = checkInterference(shapeA, shapeB, this.application.shapeFactory);
        if (result.interferes) {
            PubSub.default.pub("showToast", "toast.measure.interference:{0}", result.volume.toFixed(2));
        } else {
            PubSub.default.pub("showToast", "toast.measure.noInterference");
        }
    }
}
