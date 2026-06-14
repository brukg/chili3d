// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    type I18nKeys,
    type IDocument,
    type IShape,
    type Matrix4,
    ReferenceShapeNode,
    Result,
    serializable,
    serialize,
} from "@chili3d/core";

export interface LinkedTransformOptions {
    document: IDocument;
    sourceId: string;
    appliedTransform: Matrix4;
}

/**
 * A non-destructive transformed copy: it references a source node and re-applies a stored transform
 * whenever the source changes. Demonstrates that the C1 rebuild engine generalises past booleans —
 * any feature that resolves input shapes gets automatic upstream-edit propagation for free.
 */
@serializable()
export class LinkedTransformNode extends ReferenceShapeNode {
    override display(): I18nKeys {
        return "body.linkedTransform";
    }

    @serialize()
    get appliedTransform(): Matrix4 {
        return this.getPrivateValue("appliedTransform");
    }
    set appliedTransform(value: Matrix4) {
        this.setPropertyEmitShapeChanged("appliedTransform", value);
    }

    constructor(options: LinkedTransformOptions) {
        super({ document: options.document, inputIds: [options.sourceId] });
        this.setPrivateValue("appliedTransform", options.appliedTransform);
    }

    override generateShape(): Result<IShape> {
        const shapes = this.resolveInputShapes();
        if (shapes.length < 1) {
            return Result.err("Linked transform needs a source");
        }
        return Result.ok(shapes[0].transformedMul(this.appliedTransform));
    }
}
