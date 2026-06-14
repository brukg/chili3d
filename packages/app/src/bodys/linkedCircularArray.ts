// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    type I18nKeys,
    type IDocument,
    type IShape,
    type Line,
    MathUtils,
    Matrix4,
    property,
    ReferenceShapeNode,
    Result,
    serializable,
    serialize,
} from "@chili3d/core";

export interface LinkedCircularArrayOptions {
    document: IDocument;
    sourceId: string;
    axis: Line;
    count: number;
    angle: number;
}

/**
 * A referential circular pattern: `count` copies of a source rotated about `axis`, evenly spaced
 * over `angle` degrees (360 for a full ring), combined into a compound that rebuilds when the source
 * or pattern parameters change.
 */
@serializable()
export class LinkedCircularArrayNode extends ReferenceShapeNode {
    override display(): I18nKeys {
        return "body.linkedCircularArray";
    }

    @serialize()
    get axis(): Line {
        return this.getPrivateValue("axis");
    }

    @serialize()
    @property("linkedArray.count")
    get count(): number {
        return this.getPrivateValue("count");
    }
    set count(value: number) {
        this.setPropertyEmitShapeChanged("count", value);
    }

    @serialize()
    @property("common.angle")
    get angle(): number {
        return this.getPrivateValue("angle");
    }
    set angle(value: number) {
        this.setPropertyEmitShapeChanged("angle", value);
    }

    constructor(options: LinkedCircularArrayOptions) {
        super({ document: options.document, inputIds: [options.sourceId] });
        this.setPrivateValue("axis", options.axis);
        this.setPrivateValue("count", options.count);
        this.setPrivateValue("angle", options.angle);
    }

    override generateShape(): Result<IShape> {
        const shapes = this.resolveInputShapes();
        if (shapes.length < 1) {
            return Result.err("Linked circular array needs a source");
        }
        const count = Math.max(1, Math.floor(this.count));
        const source = shapes[0];
        const axis = this.axis;
        const step = MathUtils.degToRad(this.angle) / count;
        const copies: IShape[] = [];
        for (let i = 0; i < count; i++) {
            copies.push(source.transformedMul(Matrix4.fromAxisRad(axis.point, axis.direction, step * i)));
        }
        return shapeFactory.combine(copies);
    }
}
