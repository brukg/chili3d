// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    AsyncController,
    CancelableCommand,
    command,
    EditableShapeNode,
    type IDocument,
    type IEdge,
    MeshNode,
    PubSub,
    SelectNodeStep,
    Transaction,
    XYZ,
    type XYZLike,
} from "@chili3d/core";

// Intersect a triangle mesh with a plane: every triangle that straddles the plane contributes one
// segment between the two edge crossings. Pure geometry (no kernel) so it is unit-testable on a raw
// triangle soup — the union of the segments is the section contour.
export function meshPlaneSegments(
    position: ArrayLike<number>,
    index: ArrayLike<number>,
    origin: XYZLike,
    normal: XYZLike,
): [XYZ, XYZ][] {
    const signedDist = (i: number) => {
        const v = i * 3;
        return (
            (position[v] - origin.x) * normal.x +
            (position[v + 1] - origin.y) * normal.y +
            (position[v + 2] - origin.z) * normal.z
        );
    };
    const point = (i: number) => {
        const v = i * 3;
        return new XYZ({ x: position[v], y: position[v + 1], z: position[v + 2] });
    };

    const segments: [XYZ, XYZ][] = [];
    for (let t = 0; t + 2 < index.length; t += 3) {
        const tri = [index[t], index[t + 1], index[t + 2]];
        const dist = [signedDist(tri[0]), signedDist(tri[1]), signedDist(tri[2])];
        const crossings: XYZ[] = [];
        for (let e = 0; e < 3; e++) {
            const da = dist[e];
            const db = dist[(e + 1) % 3];
            if ((da < 0 && db > 0) || (da > 0 && db < 0)) {
                const f = da / (da - db);
                const a = point(tri[e]);
                crossings.push(
                    a.add(
                        point(tri[(e + 1) % 3])
                            .sub(a)
                            .multiply(f),
                    ),
                );
            }
        }
        if (crossings.length === 2) segments.push([crossings[0], crossings[1]]);
    }
    return segments;
}

// Mesh Section (Fusion's mesh plane cut): slice a mesh node with a plane through its centre (parallel to
// the active workplane) and emit the section contour as edges. Complements Cross Section, which cuts a
// solid B-rep.
@command({
    key: "create.meshSection",
    icon: "icon-section",
})
export class MeshSection extends CancelableCommand {
    async executeAsync(): Promise<void> {
        const node = await this.pickMeshNode(this.document);
        if (!node) {
            PubSub.default.pub("showToast", "toast.select.noSelected");
            return;
        }

        const { position, index } = node.mesh;
        if (!position || !index || index.length === 0) {
            PubSub.default.pub("showToast", "toast.converter.error");
            return;
        }

        const world = node.transform.ofPoints(position);
        let minX = Infinity;
        let minY = Infinity;
        let minZ = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        let maxZ = -Infinity;
        for (let i = 0; i < world.length; i += 3) {
            minX = Math.min(minX, world[i]);
            maxX = Math.max(maxX, world[i]);
            minY = Math.min(minY, world[i + 1]);
            maxY = Math.max(maxY, world[i + 1]);
            minZ = Math.min(minZ, world[i + 2]);
            maxZ = Math.max(maxZ, world[i + 2]);
        }
        const center = new XYZ({ x: (minX + maxX) / 2, y: (minY + maxY) / 2, z: (minZ + maxZ) / 2 });
        const normal = this.application.activeView?.workplane.normal ?? XYZ.unitZ;

        const segments = meshPlaneSegments(world, index, center, normal);
        if (segments.length === 0) {
            PubSub.default.pub("showToast", "toast.converter.error");
            return;
        }

        const edges: IEdge[] = [];
        for (const [start, end] of segments) {
            const line = shapeFactory.line(start, end);
            if (line.isOk) edges.push(line.value);
        }
        const compound = shapeFactory.combine(edges);
        if (!compound.isOk) {
            PubSub.default.pub("showToast", "error.default:{0}", compound.error);
            return;
        }

        Transaction.execute(this.document, "mesh section", () => {
            const result = new EditableShapeNode({
                document: this.document,
                name: node.name + "_section",
                shape: compound.value,
            });
            (node.parent ?? this.document.modelManager.rootNode).add(result);
            this.document.visual.update();
        });
    }

    private async pickMeshNode(document: IDocument): Promise<MeshNode | undefined> {
        const selected = document.selection
            .getSelectedNodes()
            .filter((n): n is MeshNode => n instanceof MeshNode);
        document.selection.clearSelection();
        if (selected.length > 0) return selected[0];

        const step = new SelectNodeStep("prompt.select.models", {
            filter: { allow: (n) => n instanceof MeshNode },
            multiple: false,
        });
        this.controller = new AsyncController();
        const data = await step.execute(document, this.controller);
        document.selection.clearSelection();
        return data?.nodes?.find((n): n is MeshNode => n instanceof MeshNode);
    }
}
