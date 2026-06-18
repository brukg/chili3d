// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    command,
    type IShape,
    type IStep,
    Mesh,
    MeshGroup,
    MeshNode,
    PubSub,
    SelectShapeStep,
    type ShapeNode,
    type ShapeType,
    ShapeTypes,
    Transaction,
} from "@chili3d/core";
import { MultistepCommand } from "../multistepCommand";

// Convert to Mesh (Fusion's BRep → Mesh): tessellate a B-rep body into a triangle mesh and add it as a
// standalone mesh node, leaving the original solid in place. Uses the kernel mesh the viewport already
// computes for display, so no extra tessellation pass.
@command({
    key: "convert.toMesh",
    icon: "icon-toSolid",
})
export class ConvertToMesh extends MultistepCommand {
    protected override getSteps(): IStep[] {
        return [
            new SelectShapeStep(
                (ShapeTypes.solid | ShapeTypes.shell | ShapeTypes.face) as ShapeType,
                "prompt.select.shape",
            ),
        ];
    }

    protected override executeMainTask(): void {
        const data = this.stepDatas[0].shapes[0];
        const sourceNode = data?.owner.node as ShapeNode | undefined;
        if (!data || !sourceNode) {
            PubSub.default.pub("showToast", "toast.select.noSelected");
            return;
        }

        const shape: IShape = data.shape.transformedMul(data.transform);
        const faces = shape.mesh.faces;
        if (!faces || faces.index.length === 0) {
            PubSub.default.pub("showToast", "error.default:{0}", "shape has no tessellated faces");
            return;
        }

        const mesh = new Mesh({
            meshType: "surface",
            position: faces.position,
            normal: faces.normal,
            index: faces.index,
            uv: faces.uv,
            groups: [new MeshGroup({ start: 0, count: faces.index.length, materialIndex: 0 })],
        });

        Transaction.execute(this.document, "convert to mesh", () => {
            const node = new MeshNode({
                document: this.document,
                mesh,
                name: sourceNode.name + "_mesh",
            });
            (sourceNode.parent ?? this.document.modelManager.rootNode).add(node);
            this.document.visual.update();
        });
    }
}
