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
    type XYZ,
} from "@chili3d/core";

export interface TorusNodeOptions {
    document: IDocument;
    normal: XYZ;
    center: XYZ;
    radius: number;
    tubeRadius: number;
}

// A torus (ring): `radius` is the distance from the centre to the centre of the tube, `tubeRadius`
// is the tube's own radius. Both are parametric, so editing either in the property panel reshapes it.
@serializable()
export class TorusNode extends ParameterShapeNode {
    override display(): I18nKeys {
        return "body.torus";
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
    @property("torus.radius")
    get radius() {
        return this.getPrivateValue("radius");
    }
    set radius(value: number) {
        this.setPropertyEmitShapeChanged("radius", value);
    }

    @serialize()
    @property("torus.tubeRadius")
    get tubeRadius() {
        return this.getPrivateValue("tubeRadius");
    }
    set tubeRadius(value: number) {
        this.setPropertyEmitShapeChanged("tubeRadius", value);
    }

    @serialize()
    get normal(): XYZ {
        return this.getPrivateValue("normal");
    }

    constructor(options: TorusNodeOptions) {
        super(options);
        this.setPrivateValue("normal", options.normal);
        this.setPrivateValue("center", options.center);
        this.setPrivateValue("radius", options.radius);
        this.setPrivateValue("tubeRadius", options.tubeRadius);
    }

    generateShape(): Result<IShape> {
        return shapeFactory.torus(this.normal, this.center, this.radius, this.tubeRadius);
    }
}
