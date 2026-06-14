// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    type I18nKeys,
    type IDocument,
    type IEdge,
    type IShape,
    type IWire,
    property,
    ReferenceShapeNode,
    Result,
    ShapeTypes,
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
        const face = this.profileToFace(shapes[0]);
        if (!face.isOk) {
            return face;
        }
        return shapeFactory.prism(face.value, this.direction.multiply(this.distance));
    }

    // Extruding needs a face. The profile can legitimately be a face (use it directly), a closed wire
    // (build a face from it), or a single edge (wire it, then face it). Anything else — a solid, a
    // compound, an open wire — is not a valid extrusion profile, so fail with a message rather than
    // letting the OCC binding throw "expected TopoDS_Wire, got TopoDS_Shape".
    private profileToFace(profile: IShape): Result<IShape> {
        if (profile.shapeType === ShapeTypes.face) {
            return Result.ok(profile);
        }
        if (profile.shapeType === ShapeTypes.wire) {
            return shapeFactory.face([profile as IWire]);
        }
        if (profile.shapeType === ShapeTypes.edge) {
            const wire = shapeFactory.wire([profile as IEdge]);
            return wire.isOk ? shapeFactory.face([wire.value]) : Result.err(wire.error);
        }
        return Result.err("Linked extrude profile must be a face, closed wire, or edge");
    }
}
