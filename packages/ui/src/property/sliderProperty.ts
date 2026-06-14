// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { Binding, type IDocument, Localize, type Property } from "@chili3d/core";
import { div, input, NumberConverter, span } from "@chili3d/element";
import commonStyle from "./common.module.css";
import style from "./input.module.css";
import { PropertyBase } from "./propertyBase";

/**
 * A bounded slider for a numeric property (e.g. a joint's value), paired with an editable readout for
 * precise entry. Bounds come from the property's min/max — a number is a literal bound, a string names
 * a sibling property to read (so a joint value tracks its lowerLimit/upperLimit). Edits are applied
 * live (no per-tick history), consistent with dragging the joint gizmo.
 */
export class SliderProperty extends PropertyBase {
    constructor(
        readonly document: IDocument,
        objects: any[],
        readonly property: Property,
    ) {
        super(objects);
        const obj = objects[0];
        const lo = this.resolveBound(obj, property.min, -180);
        const hi = this.resolveBound(obj, property.max, 180);
        const min = Math.min(lo, hi);
        const max = Math.max(lo, hi);
        const range = max - min;
        const step = property.step ?? (range > 0 ? range / 200 : 1);

        const slider = input({
            type: "range",
            min: String(min),
            max: String(max),
            step: String(step),
            value: new Binding(obj, property.name, new NumberConverter()),
            oninput: this.handleInput,
        });
        const readout = input({
            className: style.box,
            value: new Binding(obj, property.name, new NumberConverter()),
            onkeydown: (e: KeyboardEvent) => {
                e.stopPropagation();
                if (e.key === "Enter") this.commit((e.target as HTMLInputElement).value);
            },
            onblur: (e: FocusEvent) => this.commit((e.target as HTMLInputElement).value),
        });

        this.append(
            div(
                { className: commonStyle.panel },
                span({ className: commonStyle.propertyName, textContent: new Localize(property.display) }),
                slider,
                readout,
            ),
        );
    }

    private resolveBound(obj: any, bound: number | string | undefined, fallback: number): number {
        if (typeof bound === "number") return bound;
        if (typeof bound === "string") {
            const value = obj[bound];
            return typeof value === "number" ? value : fallback;
        }
        return fallback;
    }

    private readonly handleInput = (e: Event) => {
        this.commit((e.target as HTMLInputElement).value);
    };

    private commit(text: string) {
        const value = Number(text);
        if (Number.isNaN(value)) return;
        this.objects.forEach((o) => {
            o[this.property.name] = value;
        });
        this.document.visual.update();
    }
}

customElements.define("chili-slider-property", SliderProperty);
