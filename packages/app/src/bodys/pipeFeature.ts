// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    type I18nKeys,
    type IDocument,
    type IShape,
    ParameterShapeNode,
    Result,
    serializable,
    serialize,
} from "@chili3d/core";

export interface PipeFeatureOptions {
    document: IDocument;
    pipeShape: IShape;
}

@serializable()
export class PipeFeatureNode extends ParameterShapeNode {
    override display(): I18nKeys {
        return "body.pipeFeature";
    }

    @serialize()
    get pipeShape(): IShape {
        return this.getPrivateValue("pipeShape");
    }

    constructor(options: PipeFeatureOptions) {
        super(options);
        this.setPrivateValue("pipeShape", options.pipeShape);
    }

    override generateShape(): Result<IShape> {
        return Result.ok(this.pipeShape);
    }
}
