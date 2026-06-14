// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import type { PropertyChangedHandler } from "../foundation";
import { property } from "../property";
import { serialize } from "../serialize";
import type { IShape } from "../shape";
import { ParameterShapeNode, type ParameterShapeNodeOptions, ShapeNode } from "./shapeNode";

export interface ReferenceShapeNodeOptions extends ParameterShapeNodeOptions {
    inputIds: string[];
}

/**
 * A feature node that REFERENCES its input nodes by id instead of baking a frozen result shape.
 * It subscribes to each input's `shape` change and regenerates itself, so editing an upstream
 * feature rebuilds the dependents — cascading transitively through the existing observable system.
 * This is the foundation of non-destructive, parametric-history modelling (Tier C / C1).
 */
export abstract class ReferenceShapeNode extends ParameterShapeNode {
    private readonly subscriptions: { node: ShapeNode; handler: PropertyChangedHandler<any, any> }[] = [];
    private rebuilding = false;

    @serialize()
    get inputIds(): string[] {
        return this.getPrivateValue("inputIds", []);
    }

    /**
     * When suppressed, the feature contributes nothing: `generateShape` returns an error, so the
     * node shows no geometry and is skipped by any dependent's `resolveInputShapes` — the
     * editable-timeline "suppress" operation (Tier C / C2), riding the C1 rebuild engine.
     */
    @serialize()
    @property("feature.suppressed")
    get suppressed(): boolean {
        return this.getPrivateValue("suppressed", false);
    }
    set suppressed(value: boolean) {
        // A suppressed feature keeps its own last shape but is EXCLUDED from dependents; re-emit a
        // "shape" change so subscribed dependents rebuild (and skip this node via resolveInputShapes).
        if (this.setProperty("suppressed", value)) {
            this.emitPropertyChanged("shape", this._shape);
        }
    }

    constructor(options: ReferenceShapeNodeOptions) {
        super(options);
        this.setPrivateValue("inputIds", options.inputIds);
        this.subscribeInputs();
    }

    /**
     * The current world-placed shapes of the referenced input nodes. Inputs that are missing,
     * shapeless, or suppressed are skipped.
     */
    protected resolveInputShapes(): IShape[] {
        const shapes: IShape[] = [];
        for (const id of this.inputIds) {
            const node = this.document.modelManager.findNode((n) => n.id === id);
            if (node instanceof ReferenceShapeNode && node.suppressed) continue;
            if (node instanceof ShapeNode && node.shape.isOk) {
                shapes.push(node.shape.value.transformedMul(node.transform));
            }
        }
        return shapes;
    }

    /**
     * (Re)subscribe to the input nodes' `shape` changes. Idempotent. The constructor calls it for
     * freshly created nodes; a service re-calls it after a document load (the serializer bypasses
     * constructors).
     */
    subscribeInputs(): void {
        this.unsubscribeInputs();
        for (const id of this.inputIds) {
            const node = this.document.modelManager.findNode((n) => n.id === id);
            if (node instanceof ShapeNode) {
                const handler: PropertyChangedHandler<any, any> = (property) => {
                    if (property === "shape") this.rebuild();
                };
                node.onPropertyChanged(handler);
                this.subscriptions.push({ node, handler });
            }
        }
    }

    private unsubscribeInputs(): void {
        for (const sub of this.subscriptions) {
            sub.node.removePropertyChanged(sub.handler);
        }
        this.subscriptions.length = 0;
    }

    private rebuild(): void {
        if (this.rebuilding) return;
        this.rebuilding = true;
        try {
            this.setShape(this.generateShape());
        } finally {
            this.rebuilding = false;
        }
    }

    override disposeInternal(): void {
        this.unsubscribeInputs();
        super.disposeInternal();
    }
}
