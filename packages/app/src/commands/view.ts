// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    command,
    type IApplication,
    type ICommand,
    type INode,
    NodeUtils,
    ViewModes,
    VisualNode,
    XYZ,
} from "@chili3d/core";

// Select every object in the document (Ctrl+A).
@command({
    key: "edit.selectAll",
    icon: "icon-select",
})
export class SelectAll implements ICommand {
    async execute(app: IApplication): Promise<void> {
        const document = app.activeView?.document;
        if (!document) return;

        const nodes: INode[] = [];
        const walk = (node: INode) => {
            if (node instanceof VisualNode) nodes.push(node);
            if (NodeUtils.isLinkedListNode(node)) {
                let child = node.firstChild;
                while (child) {
                    walk(child);
                    child = child.nextSibling;
                }
            }
        };
        let child = document.modelManager.rootNode.firstChild;
        while (child) {
            walk(child);
            child = child.nextSibling;
        }
        document.selection.setSelection(nodes, false);
    }
}

// Invert the current selection: select every object that is NOT currently selected.
@command({
    key: "edit.invertSelection",
    icon: "icon-select",
})
export class InvertSelection implements ICommand {
    async execute(app: IApplication): Promise<void> {
        const document = app.activeView?.document;
        if (!document) return;

        const selected = new Set<INode>(document.selection.getSelectedNodes());
        const nodes: INode[] = [];
        const walk = (node: INode) => {
            if (node instanceof VisualNode && !selected.has(node)) nodes.push(node);
            if (NodeUtils.isLinkedListNode(node)) {
                let child = node.firstChild;
                while (child) {
                    walk(child);
                    child = child.nextSibling;
                }
            }
        };
        let child = document.modelManager.rootNode.firstChild;
        while (child) {
            walk(child);
            child = child.nextSibling;
        }
        document.selection.setSelection(nodes, false);
    }
}

// Frame the whole model in the active view (F).
@command({
    key: "view.zoomFit",
    icon: "icon-fitcontent",
})
export class ZoomFit implements ICommand {
    async execute(app: IApplication): Promise<void> {
        const view = app.activeView;
        if (!view) return;
        view.cameraController.fitContent();
        view.update();
    }
}

// Cycle the active view's display mode: solid → wireframe → solid-and-wireframe (W).
@command({
    key: "view.toggleDisplayMode",
    icon: "icon-fitcontent",
})
export class ToggleDisplayMode implements ICommand {
    async execute(app: IApplication): Promise<void> {
        const view = app.activeView;
        if (!view) return;
        const next = (ViewModes.indexOf(view.mode) + 1) % ViewModes.length;
        view.mode = ViewModes[next];
        view.update();
    }
}

// Snap the camera to a standard orientation (Z-up CAD convention): the eye is placed along `dir`
// from the current target, then the model is re-framed. Subclasses pick the direction and up vector.
abstract class StandardViewCommand implements ICommand {
    protected abstract readonly dir: XYZ;
    protected abstract readonly up: XYZ;

    async execute(app: IApplication): Promise<void> {
        const view = app.activeView;
        if (!view) return;
        const controller = view.cameraController;
        const target = controller.cameraTarget;
        const distance = Math.max(controller.cameraPosition.distanceTo(target), 1);
        const direction = this.dir.normalize() ?? this.dir;
        const eye = target.add(direction.multiply(distance));
        controller.lookAt(eye, target, this.up);
        controller.fitContent();
        view.update();
    }
}

// Toggle the camera between perspective and orthographic projection (Fusion's projection switch).
@command({ key: "view.toggleProjection", icon: "icon-perspective" })
export class ToggleProjection implements ICommand {
    async execute(app: IApplication): Promise<void> {
        const view = app.activeView;
        if (!view) return;
        const controller = view.cameraController;
        controller.cameraType = controller.cameraType === "perspective" ? "orthographic" : "perspective";
        view.update();
    }
}

@command({ key: "view.top", icon: "icon-fitcontent" })
export class ViewTop extends StandardViewCommand {
    protected readonly dir = new XYZ({ x: 0, y: 0, z: 1 });
    protected readonly up = new XYZ({ x: 0, y: 1, z: 0 });
}

@command({ key: "view.bottom", icon: "icon-fitcontent" })
export class ViewBottom extends StandardViewCommand {
    protected readonly dir = new XYZ({ x: 0, y: 0, z: -1 });
    protected readonly up = new XYZ({ x: 0, y: 1, z: 0 });
}

@command({ key: "view.front", icon: "icon-fitcontent" })
export class ViewFront extends StandardViewCommand {
    protected readonly dir = new XYZ({ x: 0, y: -1, z: 0 });
    protected readonly up = new XYZ({ x: 0, y: 0, z: 1 });
}

@command({ key: "view.back", icon: "icon-fitcontent" })
export class ViewBack extends StandardViewCommand {
    protected readonly dir = new XYZ({ x: 0, y: 1, z: 0 });
    protected readonly up = new XYZ({ x: 0, y: 0, z: 1 });
}

@command({ key: "view.right", icon: "icon-fitcontent" })
export class ViewRight extends StandardViewCommand {
    protected readonly dir = new XYZ({ x: 1, y: 0, z: 0 });
    protected readonly up = new XYZ({ x: 0, y: 0, z: 1 });
}

@command({ key: "view.left", icon: "icon-fitcontent" })
export class ViewLeft extends StandardViewCommand {
    protected readonly dir = new XYZ({ x: -1, y: 0, z: 0 });
    protected readonly up = new XYZ({ x: 0, y: 0, z: 1 });
}

@command({ key: "view.isometric", icon: "icon-fitcontent" })
export class ViewIsometric extends StandardViewCommand {
    protected readonly dir = new XYZ({ x: 1, y: -1, z: 1 });
    protected readonly up = new XYZ({ x: 0, y: 0, z: 1 });
}
