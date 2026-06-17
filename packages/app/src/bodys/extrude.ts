// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    GeometryUtils,
    type I18nKeys,
    type IDocument,
    type IFace,
    type IShape,
    Matrix4,
    ParameterShapeNode,
    property,
    type Result,
    ShapeTypes,
    serializable,
    serialize,
} from "@chili3d/core";

export interface PrismOptions {
    document: IDocument;
    section: IShape;
    length: number;
    symmetric?: boolean;
}

@serializable()
export class ExtrudeNode extends ParameterShapeNode {
    override display(): I18nKeys {
        return "body.extrude";
    }

    @serialize()
    get section(): IShape {
        return this.getPrivateValue("section");
    }
    set section(value: IShape) {
        this.setPropertyEmitShapeChanged("section", value);
    }

    @serialize()
    @property("common.length")
    get length(): number {
        return this.getPrivateValue("length");
    }
    set length(value: number) {
        this.setPropertyEmitShapeChanged("length", value);
    }

    // Symmetric: extrude half the length each way from the section plane (Fusion's symmetric extrude),
    // so the result is centred on the profile. Default off keeps the original one-sided behaviour.
    @serialize()
    @property("option.command.symmetric")
    get symmetric(): boolean {
        return this.getPrivateValue("symmetric", false);
    }
    set symmetric(value: boolean) {
        this.setPropertyEmitShapeChanged("symmetric", value);
    }

    constructor(options: PrismOptions) {
        super({ document: options.document });
        this.setPrivateValue("section", options.section);
        this.setPrivateValue("length", options.length);
        this.setPrivateValue("symmetric", options.symmetric ?? false);
    }

    override generateShape(): Result<IShape> {
        const normal = GeometryUtils.normal(this.section as any);
        if (this.section.shapeType === ShapeTypes.face) {
            const sur = (this.section as IFace).surface();
            if (!sur.isPlanar()) {
                return shapeFactory.makeThickSolidBySimple(this.section, this.length);
            }
        }

        if (this.symmetric) {
            // Shift the profile back half the length, then extrude the full length → centred result.
            const back = normal.multiply(-this.length / 2);
            const shifted = this.section.transformedMul(Matrix4.fromTranslation(back.x, back.y, back.z));
            const result = shapeFactory.prism(shifted, normal.multiply(this.length));
            shifted.dispose();
            return result;
        }
        return shapeFactory.prism(this.section, normal.multiply(this.length));
    }
}
