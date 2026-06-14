// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    type I18nKeys,
    type IDocument,
    type IShape,
    type IWire,
    property,
    ReferenceShapeNode,
    Result,
    serializable,
    serialize,
    type XYZ,
} from "@chili3d/core";

export interface LinkedExtrudeOptions {
    document: IDocument;
    profileId: string;
    direction: XYZ;
    distance: number;
}

/**
 * A referential extrude: it references a profile node (e.g. a constrained {@link SketchNode}) and
 * extrudes its wire into a solid. Editing the profile — a sketch constraint, say — rebuilds the
 * solid automatically. This is the full parametric chain C4 → C1: constraints → sketch → solid.
 */
@serializable()
export class LinkedExtrudeNode extends ReferenceShapeNode {
    override display(): I18nKeys {
        return "body.linkedExtrude";
    }

    @serialize()
    get direction(): XYZ {
        return this.getPrivateValue("direction");
    }

    @serialize()
    @property("linkedExtrude.distance")
    get distance(): number {
        return this.getPrivateValue("distance");
    }
    set distance(value: number) {
        this.setPropertyEmitShapeChanged("distance", value);
    }

    constructor(options: LinkedExtrudeOptions) {
        super({ document: options.document, inputIds: [options.profileId] });
        this.setPrivateValue("direction", options.direction);
        this.setPrivateValue("distance", options.distance);
    }

    override generateShape(): Result<IShape> {
        const shapes = this.resolveInputShapes();
        if (shapes.length < 1) {
            return Result.err("Linked extrude needs a profile");
        }
        const face = shapeFactory.face([shapes[0] as IWire]);
        if (!face.isOk) {
            return Result.err(face.error);
        }
        return shapeFactory.prism(face.value, this.direction.multiply(this.distance));
    }
}
