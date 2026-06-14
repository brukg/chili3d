// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { getCurrentApplication, type IDisposable, type INode, JointNode, PubSub } from "@chili3d/core";
import { JointGizmo } from "./jointGizmo";
import type { ThreeView } from "./threeView";

export type JointGizmoFactory = (view: ThreeView, joint: JointNode) => IDisposable;

/**
 * Shows a {@link JointGizmo} whenever exactly one JointNode is selected, and disposes it
 * otherwise. Subscribes to the global `selectionChanged` event (mirroring ShowPropertyEventHandler).
 * The gizmo factory and active-view getter are injectable so the lifecycle can be unit-tested
 * without a real WebGL view.
 */
export class JointGizmoController implements IDisposable {
    private gizmo?: IDisposable;

    constructor(
        private readonly createGizmo: JointGizmoFactory = (view, joint) => new JointGizmo(view, joint),
        private readonly getActiveView: () => ThreeView | undefined = () =>
            getCurrentApplication()?.activeView as ThreeView | undefined,
    ) {
        PubSub.default.sub("selectionChanged", this.onSelectionChanged);
    }

    private readonly onSelectionChanged = (_document: unknown, selected: INode[]) => {
        this.gizmo?.dispose();
        this.gizmo = undefined;

        const view = this.getActiveView();
        if (view && selected.length === 1 && selected[0] instanceof JointNode) {
            this.gizmo = this.createGizmo(view, selected[0]);
        }
    };

    dispose(): void {
        PubSub.default.remove("selectionChanged", this.onSelectionChanged);
        this.gizmo?.dispose();
        this.gizmo = undefined;
    }
}
