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

export interface SpiralNodeOptions {
    document: IDocument;
    normal: XYZ;
    center: XYZ;
    startRadius: number;
    endRadius: number;
    turns: number;
}

// Sample points along a flat (Archimedean) spiral lying in the plane through `center` perpendicular to
// `normal`: the radius grows linearly from startRadius to endRadius over `turns` revolutions. Exposed
// as a pure function so the geometry can be unit-tested without a kernel.
export function spiralPoints(
    center: XYZ,
    normal: XYZ,
    startRadius: number,
    endRadius: number,
    turns: number,
    segments: number,
): XYZ[] {
    const n = normal.normalize() ?? XYZ.unitZ;
    const x = (Math.abs(n.z) < 0.9 ? XYZ.unitZ : XYZ.unitX).cross(n).normalize() ?? XYZ.unitX;
    const y = n.cross(x).normalize() ?? XYZ.unitY;
    const total = turns * 2 * Math.PI;
    const points: XYZ[] = [];
    for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        const angle = total * t;
        const r = startRadius + (endRadius - startRadius) * t;
        points.push(center.add(x.multiply(r * Math.cos(angle))).add(y.multiply(r * Math.sin(angle))));
    }
    return points;
}

// A flat spiral curve (Fusion's spiral): a B-spline interpolated through points whose radius grows
// linearly over a number of turns. Every parameter is editable in the property panel.
@serializable()
export class SpiralNode extends ParameterShapeNode {
    override display(): I18nKeys {
        return "body.spiral";
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
    @property("spiral.startRadius")
    get startRadius() {
        return this.getPrivateValue("startRadius");
    }
    set startRadius(value: number) {
        this.setPropertyEmitShapeChanged("startRadius", value);
    }

    @serialize()
    @property("spiral.endRadius")
    get endRadius() {
        return this.getPrivateValue("endRadius");
    }
    set endRadius(value: number) {
        this.setPropertyEmitShapeChanged("endRadius", value);
    }

    @serialize()
    @property("spiral.turns")
    get turns() {
        return this.getPrivateValue("turns");
    }
    set turns(value: number) {
        this.setPropertyEmitShapeChanged("turns", value);
    }

    @serialize()
    get normal(): XYZ {
        return this.getPrivateValue("normal");
    }

    constructor(options: SpiralNodeOptions) {
        super(options);
        this.setPrivateValue("normal", options.normal);
        this.setPrivateValue("center", options.center);
        this.setPrivateValue("startRadius", options.startRadius);
        this.setPrivateValue("endRadius", options.endRadius);
        this.setPrivateValue("turns", options.turns);
    }

    generateShape(): Result<IShape> {
        // ~32 samples per turn give a smooth interpolated spiral.
        const segments = Math.max(16, Math.ceil(this.turns * 32));
        const points = spiralPoints(
            this.center,
            this.normal,
            this.startRadius,
            this.endRadius,
            this.turns,
            segments,
        );
        return shapeFactory.interpolate(points, false);
    }
}
