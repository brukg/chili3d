// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    type I18nKeys,
    type IDocument,
    type IShape,
    Matrix4,
    property,
    ReferenceShapeNode,
    Result,
    serializable,
    serialize,
    type XYZ,
} from "@chili3d/core";

export interface LinkedArrayOptions {
    document: IDocument;
    sourceId: string;
    count: number;
    spacing: XYZ;
}

/**
 * A referential linear pattern: `count` copies of a source node spaced by `spacing`, combined into a
 * compound that rebuilds when the source changes (and recounts when `count`/`spacing` change). The
 * one-source → many-outputs case of the C1 rebuild engine.
 */
@serializable()
export class LinkedArrayNode extends ReferenceShapeNode {
    override display(): I18nKeys {
        return "body.linkedArray";
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
    get spacing(): XYZ {
        return this.getPrivateValue("spacing");
    }
    set spacing(value: XYZ) {
        this.setPropertyEmitShapeChanged("spacing", value);
    }

    constructor(options: LinkedArrayOptions) {
        super({ document: options.document, inputIds: [options.sourceId] });
        this.setPrivateValue("count", options.count);
        this.setPrivateValue("spacing", options.spacing);
    }

    override generateShape(): Result<IShape> {
        const shapes = this.resolveInputShapes();
        if (shapes.length < 1) {
            return Result.err("Linked array needs a source");
        }
        const count = Math.max(1, Math.floor(this.count));
        const source = shapes[0];
        const spacing = this.spacing;
        const copies: IShape[] = [];
        for (let i = 0; i < count; i++) {
            copies.push(
                source.transformedMul(Matrix4.fromTranslation(spacing.x * i, spacing.y * i, spacing.z * i)),
            );
        }
        return shapeFactory.combine(copies);
    }
}
