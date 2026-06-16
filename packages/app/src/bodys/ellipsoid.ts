// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    type I18nKeys,
    type IDocument,
    type IShape,
    ParameterShapeNode,
    property,
    type Result,
    serializable,
    serialize,
    XYZ,
} from "@chili3d/core";

export interface EllipsoidNodeOptions {
    document: IDocument;
    center: XYZ;
    xRadius: number;
    yRadius: number;
    zRadius: number;
}

// An axis-aligned ellipsoid: a unit sphere scaled independently along X, Y and Z about its centre.
// The three radii are parametric, so editing any of them in the property panel reshapes the solid.
@serializable()
export class EllipsoidNode extends ParameterShapeNode {
    override display(): I18nKeys {
        return "body.ellipsoid";
    }

    @serialize()
    @property("circle.center")
    get center() {
        return this.getPrivateValue("center");
    }
    set center(center: XYZ) {
        this.setPropertyEmitShapeChanged("center", center);
    }

    @serialize()
    @property("ellipsoid.radiusX")
    get xRadius() {
        return this.getPrivateValue("xRadius");
    }
    set xRadius(value: number) {
        this.setPropertyEmitShapeChanged("xRadius", value);
    }

    @serialize()
    @property("ellipsoid.radiusY")
    get yRadius() {
        return this.getPrivateValue("yRadius");
    }
    set yRadius(value: number) {
        this.setPropertyEmitShapeChanged("yRadius", value);
    }

    @serialize()
    @property("ellipsoid.radiusZ")
    get zRadius() {
        return this.getPrivateValue("zRadius");
    }
    set zRadius(value: number) {
        this.setPropertyEmitShapeChanged("zRadius", value);
    }

    constructor(options: EllipsoidNodeOptions) {
        super(options);
        this.setPrivateValue("center", options.center);
        this.setPrivateValue("xRadius", options.xRadius);
        this.setPrivateValue("yRadius", options.yRadius);
        this.setPrivateValue("zRadius", options.zRadius);
    }

    generateShape(): Result<IShape> {
        return shapeFactory.ellipsoid(
            XYZ.unitZ,
            this.center,
            XYZ.unitX,
            this.xRadius,
            this.yRadius,
            this.zRadius,
        );
    }
}
