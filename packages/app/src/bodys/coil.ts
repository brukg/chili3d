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

export interface CoilNodeOptions {
    document: IDocument;
    normal: XYZ;
    center: XYZ;
    radius: number;
    pitch: number;
    height: number;
    profileRadius: number;
    leftHanded: boolean;
}

// A coil / helical spring: a circular wire profile (profileRadius) swept along a helix of the given
// coil radius, pitch (axial advance per turn) and total height. Geometrically the same helical sweep
// as Thread, presented as Fusion's Coil — every parameter is editable in the property panel.
@serializable()
export class CoilNode extends ParameterShapeNode {
    override display(): I18nKeys {
        return "body.coil";
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
    @property("thread.profileRadius")
    get profileRadius() {
        return this.getPrivateValue("profileRadius");
    }
    set profileRadius(profileRadius: number) {
        this.setPropertyEmitShapeChanged("profileRadius", profileRadius);
    }

    @serialize()
    @property("thread.leftHanded")
    get leftHanded() {
        return this.getPrivateValue("leftHanded");
    }
    set leftHanded(leftHanded: boolean) {
        this.setPropertyEmitShapeChanged("leftHanded", leftHanded);
    }

    @serialize()
    get normal(): XYZ {
        return this.getPrivateValue("normal");
    }

    constructor(options: CoilNodeOptions) {
        super(options);
        this.setPrivateValue("normal", options.normal);
        this.setPrivateValue("center", options.center);
        this.setPrivateValue("radius", options.radius);
        this.setPrivateValue("pitch", options.pitch);
        this.setPrivateValue("height", options.height);
        this.setPrivateValue("profileRadius", options.profileRadius);
        this.setPrivateValue("leftHanded", options.leftHanded);
    }

    generateShape(): Result<IShape> {
        return shapeFactory.thread(
            this.normal,
            this.center,
            this.radius,
            this.pitch,
            this.height,
            this.profileRadius,
            this.leftHanded,
        );
    }
}
