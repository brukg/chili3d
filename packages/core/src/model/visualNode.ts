// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import type { I18nKeys } from "../i18n";
import { type BoundingBox, Matrix4 } from "../math";
import { property } from "../property";
import { serialize } from "../serialize";
import { Node } from "./node";

export abstract class VisualNode extends Node {
    abstract display(): I18nKeys;

    @serialize()
    get transform(): Matrix4 {
        return this.getPrivateValue("transform", Matrix4.identity());
    }
    set transform(value: Matrix4) {
        this.setProperty("transform", value, undefined, {
            equals: (left, right) => left.equals(right),
        });
    }

    // Locked nodes render in a muted "locked" material as a signal not to edit them. Serialized so the
    // state survives save/load; the viewport mirrors it (see threeVisualObject / threeVisualContext).
    @serialize()
    @property("model.locked")
    get locked(): boolean {
        return this.getPrivateValue("locked", false);
    }
    set locked(value: boolean) {
        this.setProperty("locked", value);
    }

    worldTransform(): Matrix4 {
        const visual = this.document.visual.context.getVisual(this);
        if (visual) {
            return visual.worldTransform();
        }
        return this.transform;
    }

    protected onVisibleChanged(): void {
        this.document.visual.context.setVisible(this, this.visible && this.parentVisible);
    }

    protected onParentVisibleChanged(): void {
        this.document.visual.context.setVisible(this, this.visible && this.parentVisible);
    }

    abstract boundingBox(): BoundingBox | undefined;
}
