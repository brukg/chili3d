// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    command,
    EditableShapeNode,
    GetOrSelectNodeStep,
    type IStep,
    PubSub,
    ShapeNode,
    ShapeTypes,
    Transaction,
} from "@chili3d/core";
import { MultistepCommand } from "../multistepCommand";

// Extract Faces: collect all faces of the selected body(ies) into a new reference node (a compound
// of surfaces in world space) — useful for reusing a part's faces as reference surfaces or for
// patch/offset work. The source bodies are left untouched.
@command({
    key: "create.extractFaces",
    icon: "icon-toFace",
})
export class ExtractFaces extends MultistepCommand {
    protected override getSteps(): IStep[] {
        return [new GetOrSelectNodeStep("prompt.select.shape", { multiple: true })];
    }

    protected override executeMainTask(): void {
        const nodes = (this.stepDatas[0].nodes ?? []).filter((n): n is ShapeNode => n instanceof ShapeNode);
        if (nodes.length === 0) {
            PubSub.default.pub("showToast", "toast.select.noSelected");
            return;
        }

        let created = 0;
        Transaction.execute(this.document, "extract faces", () => {
            for (const node of nodes) {
                const worldShape = node.shape.value.transformedMul(node.transform);
                const faces = worldShape.findSubShapes(ShapeTypes.face);
                if (faces.length === 0) continue;
                const compound = shapeFactory.combine(faces);
                if (!compound.isOk) continue;
                const faceNode = new EditableShapeNode({
                    document: this.document,
                    name: `${node.name} faces`,
                    shape: compound.value,
                    materialId: node.materialId,
                });
                (node.parent ?? this.document.modelManager.rootNode).add(faceNode);
                created++;
            }
            this.document.visual.update();
        });

        PubSub.default.pub("showToast", created > 0 ? "toast.success" : "toast.converter.error");
    }
}
