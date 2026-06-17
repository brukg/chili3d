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

export interface HelixNodeOptions {
    document: IDocument;
    normal: XYZ;
    center: XYZ;
    radius: number;
    pitch: number;
    height: number;
    leftHanded: boolean;
}

// A helix curve: a single helical edge of the given radius, pitch (axial advance per turn) and total
// height — a ready path for sweeping a custom profile (Fusion's helix/spiral curve). Every parameter
// is editable in the property panel.
@serializable()
export class HelixNode extends ParameterShapeNode {
    override display(): I18nKeys {
        return "body.helix";
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
    @property("thread.pitch")
    get pitch() {
        return this.getPrivateValue("pitch");
    }
    set pitch(pitch: number) {
        this.setPropertyEmitShapeChanged("pitch", pitch);
    }

    @serialize()
    @property("thread.height")
    get height() {
        return this.getPrivateValue("height");
    }
    set height(height: number) {
        this.setPropertyEmitShapeChanged("height", height);
    }

    @serialize()
    @property("thread.leftHanded")
    get leftHanded() {
        return this.getPrivateValue("leftHanded");
    }
    set leftHanded(value: boolean) {
        this.setPropertyEmitShapeChanged("leftHanded", value);
    }

    @serialize()
    get normal(): XYZ {
        return this.getPrivateValue("normal");
    }

    constructor(options: HelixNodeOptions) {
        super(options);
        this.setPrivateValue("normal", options.normal);
        this.setPrivateValue("center", options.center);
        this.setPrivateValue("radius", options.radius);
        this.setPrivateValue("pitch", options.pitch);
        this.setPrivateValue("height", options.height);
        this.setPrivateValue("leftHanded", options.leftHanded);
    }

    generateShape(): Result<IShape> {
        return shapeFactory.helix(
            this.normal,
            this.center,
            this.radius,
            this.pitch,
            this.height,
            this.leftHanded,
        );
    }
}
