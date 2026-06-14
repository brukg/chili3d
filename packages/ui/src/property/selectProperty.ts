// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { type IDocument, Localize, type Property, Transaction } from "@chili3d/core";
import { div, option, select, span } from "@chili3d/element";
import commonStyle from "./common.module.css";
import style from "./input.module.css";
import { PropertyBase } from "./propertyBase";

/** A dropdown for an enum-valued property (`@property(..., { type: "select", options })`). */
export class SelectProperty extends PropertyBase {
    constructor(
        readonly document: IDocument,
        objects: any[],
        readonly property: Property,
    ) {
        super(objects);
        const options = property.options ?? [];
        const current = String(objects[0][property.name]);
        const dropdown = select(
            { className: style.box },
            ...options.map((value) => option({ value, textContent: value, selected: value === current })),
        ) as HTMLSelectElement;
        dropdown.value = current;
        dropdown.onchange = () => {
            const value = dropdown.value;
            Transaction.execute(this.document, "modify property", () => {
                this.objects.forEach((x) => {
                    x[property.name] = value;
                });
                this.document.visual.update();
            });
        };
        this.appendChild(
            div(
                { className: commonStyle.panel },
                span({ className: commonStyle.propertyName, textContent: new Localize(property.display) }),
                dropdown,
            ),
        );
    }
}

customElements.define("chili-select-property", SelectProperty);
