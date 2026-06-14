// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { command, I18n, type IApplication, type ICommand, ParameterStore, PubSub } from "@chili3d/core";
import { button, div, input, span } from "@chili3d/element";

@command({
    key: "parameter.manage",
    icon: "icon-array",
})
export class ManageParametersCommand implements ICommand {
    async execute(application: IApplication): Promise<void> {
        const document = application.activeView?.document;
        if (!document) {
            PubSub.default.pub("showToast", "toast.select.noSelected");
            return;
        }

        const store = new ParameterStore(document);
        PubSub.default.pub("showDialog", "parameter.manage", this.ui(store), () => {});
    }

    private ui(store: ParameterStore): HTMLElement {
        const rows = div({ style: { display: "flex", flexDirection: "column", gap: "4px" } });

        const addRow = (name: string, expression: string) => {
            // Track the previously-committed name so a rename removes the old entry.
            let committedName = name;

            const nameInput = input({
                value: name,
                placeholder: I18n.translate("parameter.name"),
                style: { width: "120px" },
            });
            const exprInput = input({
                value: expression,
                placeholder: I18n.translate("parameter.expression"),
                style: { flex: "1" },
            });

            const commit = () => {
                const newName = nameInput.value.trim();
                const newExpr = exprInput.value.trim();
                if (!newName) return;

                if (committedName && committedName !== newName) {
                    store.remove(committedName);
                }

                const result = store.set(newName, newExpr);
                if (!result.isOk) {
                    PubSub.default.pub("showToast", "error.default:{0}", result.error);
                    return;
                }
                committedName = newName;

                const resolved = store.resolve();
                if (!resolved.isOk) {
                    PubSub.default.pub("showToast", "error.default:{0}", resolved.error);
                }
            };

            nameInput.onblur = commit;
            exprInput.onblur = commit;

            const removeButton = button({
                textContent: I18n.translate("parameter.remove"),
                onclick: () => {
                    if (committedName) store.remove(committedName);
                    row.remove();
                },
            });

            const row = div(
                { style: { display: "flex", gap: "4px", alignItems: "center" } },
                nameInput,
                exprInput,
                removeButton,
            );
            rows.append(row);
        };

        for (const param of store.list()) {
            addRow(param.name, param.expression);
        }

        const addButton = button({
            textContent: I18n.translate("parameter.add"),
            onclick: () => addRow("", ""),
        });

        return div(
            { style: { display: "flex", flexDirection: "column", gap: "8px", minWidth: "360px" } },
            div(
                { style: { display: "flex", gap: "4px", fontWeight: "bold" } },
                span({ textContent: I18n.translate("parameter.name"), style: { width: "120px" } }),
                span({ textContent: I18n.translate("parameter.expression"), style: { flex: "1" } }),
            ),
            rows,
            addButton,
        );
    }
}
