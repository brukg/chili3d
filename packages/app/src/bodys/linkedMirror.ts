// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    type I18nKeys,
    type IDocument,
    type IShape,
    Matrix4,
    type Plane,
    ReferenceShapeNode,
    Result,
    serializable,
    serialize,
    type XYZ,
} from "@chili3d/core";

export interface LinkedMirrorOptions {
    document: IDocument;
    sourceId: string;
    plane: Plane;
}

// Reflection matrix across a plane (origin `p`, unit normal `n`): R = I − 2·n·nᵀ, with the
// translation that keeps the plane fixed, t = (I − R)·p. Returned column-major for Matrix4.
function mirrorMatrix(p: XYZ, n: XYZ): Matrix4 {
    const r00 = 1 - 2 * n.x * n.x;
    const r01 = -2 * n.x * n.y;
    const r02 = -2 * n.x * n.z;
    const r10 = -2 * n.y * n.x;
    const r11 = 1 - 2 * n.y * n.y;
    const r12 = -2 * n.y * n.z;
    const r20 = -2 * n.z * n.x;
    const r21 = -2 * n.z * n.y;
    const r22 = 1 - 2 * n.z * n.z;
    const tx = p.x - (r00 * p.x + r01 * p.y + r02 * p.z);
    const ty = p.y - (r10 * p.x + r11 * p.y + r12 * p.z);
    const tz = p.z - (r20 * p.x + r21 * p.y + r22 * p.z);
    return Matrix4.fromArray([r00, r10, r20, 0, r01, r11, r21, 0, r02, r12, r22, 0, tx, ty, tz, 1]);
}

/**
 * A referential mirror: a reflected copy of a source across `plane`, rebuilt when the source
 * changes. (A mirror is a reflection transform, the determinant-negative sibling of LinkedTransform.)
 */
@serializable()
export class LinkedMirrorNode extends ReferenceShapeNode {
    override display(): I18nKeys {
        return "body.linkedMirror";
    }

    @serialize()
    get plane(): Plane {
        return this.getPrivateValue("plane");
    }

    constructor(options: LinkedMirrorOptions) {
        super({ document: options.document, inputIds: [options.sourceId] });
        this.setPrivateValue("plane", options.plane);
    }

    override generateShape(): Result<IShape> {
        const shapes = this.resolveInputShapes();
        if (shapes.length < 1) {
            return Result.err("Linked mirror needs a source");
        }
        const plane = this.plane;
        return Result.ok(shapes[0].transformedMul(mirrorMatrix(plane.origin, plane.normal)));
    }
}
