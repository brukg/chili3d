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

export interface TubeNodeOptions {
    document: IDocument;
    normal: XYZ;
    center: XYZ;
    radius: number;
    innerRadius: number;
    dz: number;
}

// A tube / hollow cylinder: the annular solid between two coaxial cylinders, built by cutting the
// inner bore out of the outer cylinder. Volume = π·(R² − r²)·h.
@serializable()
export class TubeNode extends ParameterShapeNode {
    override display(): I18nKeys {
        return "body.tube";
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
    @property("circle.radius")
    get radius() {
        return this.getPrivateValue("radius");
    }
    set radius(radius: number) {
        this.setPropertyEmitShapeChanged("radius", radius);
    }

    @serialize()
    @property("tube.innerRadius")
    get innerRadius() {
        return this.getPrivateValue("innerRadius");
    }
    set innerRadius(value: number) {
        this.setPropertyEmitShapeChanged("innerRadius", value);
    }

    @serialize()
    @property("box.dz")
    get dz() {
        return this.getPrivateValue("dz");
    }
    set dz(dz: number) {
        this.setPropertyEmitShapeChanged("dz", dz);
    }

    @serialize()
    get normal(): XYZ {
        return this.getPrivateValue("normal");
    }

    constructor(options: TubeNodeOptions) {
        super(options);
        this.setPrivateValue("normal", options.normal);
        this.setPrivateValue("center", options.center);
        this.setPrivateValue("radius", options.radius);
        this.setPrivateValue("innerRadius", options.innerRadius);
        this.setPrivateValue("dz", options.dz);
    }

    generateShape(): Result<IShape> {
        const outer = shapeFactory.cylinder(this.normal, this.center, this.radius, this.dz);
        // A degenerate or non-positive bore just yields the solid cylinder.
        if (this.innerRadius <= 1e-6 || this.innerRadius >= this.radius) {
            return outer;
        }
        const inner = shapeFactory.cylinder(this.normal, this.center, this.innerRadius, this.dz);
        if (!outer.isOk || !inner.isOk) {
            return outer.isOk ? inner : outer;
        }
        return shapeFactory.booleanCut([outer.value], [inner.value]);
    }
}
