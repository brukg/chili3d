// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    command,
    findMaterialPreset,
    GeometryNode,
    GetOrSelectNodeStep,
    type INode,
    type INodeLinkedList,
    type ISolid,
    type IStep,
    JointNode,
    LinkNode,
    MaterialPresets,
    NodeUtils,
    PhysicalMaterial,
    PubSub,
    property,
    ShapeNode,
    ShapeTypes,
    Transaction,
} from "@chili3d/core";
import { MultistepCommand } from "../multistepCommand";

const MATERIAL_OPTIONS: readonly string[] = MaterialPresets.map((p) => p.id);

/**
 * Apply Material: assign a physical material (steel, aluminium, ABS, …) to one or more bodies. The
 * preset's PBR appearance (colour + metalness + roughness) is painted onto every geometry under the
 * selection, and for any selected link its mass is also derived from the material's density
 * (mass = density · volume). This is the "set the material type and everything follows" workflow — it
 * drives both how the body looks and, for links, Estimate Torque / the URDF `<inertial>`. One shared
 * material is created per invocation from the {@link MaterialPresets} library.
 */
@command({
    key: "modify.applyMaterial",
    icon: "icon-addBrush",
})
export class ApplyMaterialCommand extends MultistepCommand {
    @property("material.preset", { type: "select", options: MATERIAL_OPTIONS })
    get material(): string {
        return this.getPrivateValue("material", "steel");
    }
    set material(value: string) {
        this.setProperty("material", value);
    }

    protected override getSteps(): IStep[] {
        return [new GetOrSelectNodeStep("prompt.select.models", { multiple: true })];
    }

    protected override executeMainTask(): void {
        const nodes = this.stepDatas[0].nodes ?? [];
        if (nodes.length === 0) {
            PubSub.default.pub("showToast", "toast.select.noSelected");
            return;
        }
        const preset = findMaterialPreset(this.material);
        if (!preset) {
            PubSub.default.pub("showToast", "error.default:{0}", `unknown material ${this.material}`);
            return;
        }

        let painted = 0;
        let massLinks = 0;
        Transaction.execute(this.document, `execute ${Object.getPrototypeOf(this).data.name}`, () => {
            // One shared physical material for this assignment, reused across the whole selection.
            const material = new PhysicalMaterial({
                document: this.document,
                name: preset.name,
                color: preset.color,
            });
            material.metalness = preset.metalness;
            material.roughness = preset.roughness;
            this.document.modelManager.materials.push(material);

            for (const node of nodes) {
                for (const geometry of geometryUnder(node)) {
                    geometry.materialId = material.id;
                    painted++;
                }
                // A link also takes its mass from the material's density.
                if (node instanceof LinkNode) {
                    node.mass = preset.density * linkSolidVolume(node) * 1e-9; // kg
                    massLinks++;
                }
            }
            this.document.visual.update();
        });
        PubSub.default.pub(
            "showToast",
            "toast.robot.materialApplied:{0}{1}{2}",
            `${painted}`,
            preset.name,
            `${massLinks}`,
        );
    }
}

// Every geometry node at or under a selection: the node itself if it is geometry, otherwise its geometry
// descendants (so painting a link or a folder colours all the bodies inside it).
function geometryUnder(node: INode): GeometryNode[] {
    if (node instanceof GeometryNode) return [node];
    if (NodeUtils.isLinkedListNode(node)) {
        return NodeUtils.findNodes(node, (n) => n instanceof GeometryNode) as GeometryNode[];
    }
    return [];
}

// Total volume (mm³) of a link's own solids, descending through folders/groups but stopping at nested
// links/joints (their geometry belongs to them). Volume is invariant under placement, so no transform.
function linkSolidVolume(link: LinkNode): number {
    let volume = 0;
    const walk = (parent: INodeLinkedList) => {
        let n = parent.firstChild;
        while (n) {
            if (!(n instanceof LinkNode || n instanceof JointNode)) {
                if (n instanceof ShapeNode && n.shape.isOk) {
                    for (const sub of n.shape.value.findSubShapes(ShapeTypes.solid)) {
                        volume += (sub as ISolid).massProperties().volume;
                    }
                } else if (NodeUtils.isLinkedListNode(n)) {
                    walk(n);
                }
            }
            n = n.nextSibling;
        }
    };
    walk(link);
    return volume;
}
