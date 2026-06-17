// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    command,
    EditableShapeNode,
    type IFace,
    type IShape,
    type IStep,
    type IWire,
    type LengthAtAxisSnapData,
    LengthAtAxisStep,
    Matrix4,
    Precision,
    PubSub,
    property,
    type Result,
    SelectShapeStep,
    ShapeTypes,
    Transaction,
    type XYZ,
} from "@chili3d/core";
import { MultistepCommand } from "../multistepCommand";

// Extrude a planar face to `height` along its normal while tapering the cross-section by `angleDeg`
// (positive narrows toward the top, negative widens) — Fusion's extrude taper angle. Built by offsetting
// the face's outer wire by height·tan(angle), lifting it, and lofting the two wires into a solid. Pure +
// testable; falls back to a straight prism when the angle is ~0.
export function taperExtrude(face: IFace, normal: XYZ, height: number, angleDeg: number): Result<IShape> {
    const offsetDist = -height * Math.tan((angleDeg * Math.PI) / 180);
    if (Math.abs(offsetDist) < Precision.Distance) {
        return shapeFactory.prism(face, normal.multiply(height));
    }
    const offset = face.outerWire().offset(offsetDist, "intersection");
    if (!offset.isOk) return offset;
    const move = normal.multiply(height);
    const top = offset.value.transformedMul(Matrix4.fromTranslation(move.x, move.y, move.z));
    return shapeFactory.loft([face.outerWire(), top as IWire], true, true, "c0");
}

@command({
    key: "create.taperExtrude",
    icon: "icon-prism",
})
export class TaperExtrude extends MultistepCommand {
    @property("common.angle")
    get angle() {
        return this.getPrivateValue("angle", 10);
    }
    set angle(value: number) {
        this.setProperty("angle", value);
    }

    protected override getSteps(): IStep[] {
        return [
            new SelectShapeStep(ShapeTypes.face, "prompt.select.faces"),
            new LengthAtAxisStep("prompt.pickNextPoint", this.getHeightData),
        ];
    }

    private readonly faceData = () => {
        const data = this.stepDatas[0].shapes[0];
        const face = data.shape.transformedMul(data.transform) as IFace;
        return { face, normal: face.normal(0, 0)[1].normalize()! };
    };

    private readonly getHeightData = (): LengthAtAxisSnapData => {
        const { face, normal } = this.faceData();
        return {
            point: face.normal(0, 0)[0],
            direction: normal,
            validator: (p: XYZ) => Math.abs(p.sub(face.normal(0, 0)[0]).dot(normal)) > Precision.Float,
        };
    };

    protected override executeMainTask(): void {
        const { face, normal } = this.faceData();
        const origin = face.normal(0, 0)[0];
        const height = this.stepDatas[1].point!.sub(origin).dot(normal);
        const dir = height < 0 ? normal.multiply(-1) : normal;
        const result = taperExtrude(face, dir, Math.abs(height), this.angle);
        if (!result.isOk) {
            PubSub.default.pub("showToast", "error.default:{0}", result.error);
            return;
        }
        Transaction.execute(this.document, "taper extrude", () => {
            const node = new EditableShapeNode({
                document: this.document,
                name: "Taper Extrude",
                shape: result.value,
            });
            this.document.modelManager.addNode(node);
            this.document.visual.update();
        });
    }
}
