// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { command, download, type IApplication, type ICommand, PubSub, type VisualNode } from "@chili3d/core";

/**
 * One-click URDF export for the robotics workflow — sits next to Create Joint / Create Link so it is
 * discoverable. Exports the whole document (the export finds the base Link node) to a `.urdf` ZIP and
 * downloads it; if no Link tree exists, the exporter shows a helpful toast.
 */
@command({
    key: "modify.exportUrdf",
    icon: "icon-export",
})
export class ExportUrdf implements ICommand {
    async execute(application: IApplication): Promise<void> {
        const document = application.activeView?.document;
        if (!document) {
            PubSub.default.pub("showToast", "toast.select.noSelected");
            return;
        }
        const nodes = document.modelManager.findNodes(() => true) as VisualNode[];
        const data = await application.dataExchange.export(".urdf", nodes);
        if (!data) return; // the exporter already toasts a helpful message (e.g. "needs a Link node")
        PubSub.default.pub("showToast", "toast.downloading");
        download(data, `${document.name}.urdf`);
    }
}
