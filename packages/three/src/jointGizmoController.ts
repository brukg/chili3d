// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { getCurrentApplication, type IDisposable, type INode, JointNode, PubSub } from "@chili3d/core";
import { JointGizmo } from "./jointGizmo";
import type { ThreeView } from "./threeView";

/**
 * Shows a {@link JointGizmo} whenever exactly one JointNode is selected, and disposes it
 * otherwise. Subscribes to the global `selectionChanged` event (mirroring ShowPropertyEventHandler).
 */
export class JointGizmoController implements IDisposable {
    private gizmo?: JointGizmo;

    constructor() {
        PubSub.default.sub("selectionChanged", this.onSelectionChanged);
    }

    private readonly onSelectionChanged = (_document: unknown, selected: INode[]) => {
        this.gizmo?.dispose();
        this.gizmo = undefined;

        const view = getCurrentApplication()?.activeView as ThreeView | undefined;
        if (view && selected.length === 1 && selected[0] instanceof JointNode) {
            this.gizmo = new JointGizmo(view, selected[0]);
        }
    };

    dispose(): void {
        PubSub.default.remove("selectionChanged", this.onSelectionChanged);
        this.gizmo?.dispose();
        this.gizmo = undefined;
    }
}
