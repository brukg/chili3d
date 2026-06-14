// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { getCurrentApplication, type IDisposable, type INode, JointNode, PubSub } from "@chili3d/core";
import { JointGizmo } from "./jointGizmo";
import type { ThreeView } from "./threeView";

export type JointGizmoFactory = (view: ThreeView, joint: JointNode) => IDisposable;

// The richer surface a real JointGizmo exposes; injected test stubs may omit it (treated as absent).
interface SyncableGizmo extends IDisposable {
    readonly isDragging?: boolean;
    syncToValue?(): void;
}

// Joint properties that change what the gizmo looks like and so require a full rebuild (jointType
// switches rotate↔translate and adds/removes the pivot handle; axis/pivot move and reorient it).
const STRUCTURAL_PROPS = new Set<keyof JointNode>(["jointType", "axis", "pivot"]);

/**
 * Shows a {@link JointGizmo} whenever exactly one JointNode is selected, and disposes it
 * otherwise. Subscribes to the global `selectionChanged` event (mirroring ShowPropertyEventHandler).
 * The gizmo factory and active-view getter are injectable so the lifecycle can be unit-tested
 * without a real WebGL view.
 *
 * While a joint is selected it also tracks that joint's property changes, so edits made through the
 * property panel (not the gizmo) keep the gizmo in sync: a structural change rebuilds it, an external
 * value change re-poses it. Changes the gizmo emits during its own drag are ignored via isDragging.
 */
export class JointGizmoController implements IDisposable {
    private gizmo?: IDisposable;
    private joint?: JointNode;

    constructor(
        private readonly createGizmo: JointGizmoFactory = (view, joint) => new JointGizmo(view, joint),
        private readonly getActiveView: () => ThreeView | undefined = () =>
            getCurrentApplication()?.activeView as ThreeView | undefined,
    ) {
        PubSub.default.sub("selectionChanged", this.onSelectionChanged);
    }

    private readonly onSelectionChanged = (_document: unknown, selected: INode[]) => {
        this.clear();

        const view = this.getActiveView();
        if (view && selected.length === 1 && selected[0] instanceof JointNode) {
            this.joint = selected[0];
            this.joint.onPropertyChanged(this.onJointPropertyChanged);
            this.gizmo = this.createGizmo(view, this.joint);
        }
    };

    private readonly onJointPropertyChanged = (property: keyof JointNode) => {
        const gizmo = this.gizmo as SyncableGizmo | undefined;
        if (!gizmo || gizmo.isDragging) return; // the gizmo's own drag — already reflected
        if (STRUCTURAL_PROPS.has(property)) {
            this.recreate();
        } else if (property === "value") {
            gizmo.syncToValue?.();
        }
    };

    private recreate() {
        const view = this.getActiveView();
        if (!view || !this.joint) return;
        this.gizmo?.dispose();
        this.gizmo = this.createGizmo(view, this.joint);
    }

    private clear() {
        this.gizmo?.dispose();
        this.gizmo = undefined;
        if (this.joint) {
            this.joint.removePropertyChanged(this.onJointPropertyChanged);
            this.joint = undefined;
        }
    }

    dispose(): void {
        PubSub.default.remove("selectionChanged", this.onSelectionChanged);
        this.clear();
    }
}
