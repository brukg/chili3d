// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    type I18nKeys,
    type IDocument,
    type IShape,
    type IWire,
    type Line,
    property,
    ReferenceShapeNode,
    Result,
    ShapeTypes,
    serializable,
    serialize,
} from "@chili3d/core";

export interface LinkedRevolveOptions {
    document: IDocument;
    profileId: string;
    axis: Line;
    angle: number;
}

/**
 * A referential revolve: it references a profile node and revolves it about an axis into a solid of
 * revolution that rebuilds when the profile changes. Another proof that the C1 rebuild engine
 * generalises across feature kinds. `angle` is in degrees (matching the destructive revolve).
 */
@serializable()
export class LinkedRevolveNode extends ReferenceShapeNode {
    override display(): I18nKeys {
        return "body.linkedRevolve";
    }

    @serialize()
    get axis(): Line {
        return this.getPrivateValue("axis");
    }

    @serialize()
    @property("common.angle")
    get angle(): number {
        return this.getPrivateValue("angle");
    }
    set angle(value: number) {
        this.setPropertyEmitShapeChanged("angle", value);
    }

    constructor(options: LinkedRevolveOptions) {
        super({ document: options.document, inputIds: [options.profileId] });
        this.setPrivateValue("axis", options.axis);
        this.setPrivateValue("angle", options.angle);
    }

    override generateShape(): Result<IShape> {
        const shapes = this.resolveInputShapes();
        if (shapes.length < 1) {
            return Result.err("Linked revolve needs a profile");
        }
        // Revolve a closed face into a solid; a wire profile must be faced first (an open profile
        // would only sweep a shell).
        let profile = shapes[0];
        if (profile.shapeType === ShapeTypes.wire) {
            const face = shapeFactory.face([profile as IWire]);
            if (!face.isOk) return Result.err(face.error);
            profile = face.value;
        }
        return shapeFactory.revolve(profile, this.axis, this.angle);
    }
}
