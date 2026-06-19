// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    command,
    findMaterialPreset,
    GetOrSelectNodeStep,
    type INodeLinkedList,
    type ISolid,
    type IStep,
    JointNode,
    LinkNode,
    MaterialPresets,
    NodeUtils,
    PubSub,
    property,
    ShapeNode,
    ShapeTypes,
    Transaction,
} from "@chili3d/core";
import { MultistepCommand } from "../multistepCommand";

const MATERIAL_OPTIONS: readonly string[] = MaterialPresets.map((p) => p.id);

/**
 * Set Mass from Material: assign a physical material (steel, aluminium, ABS, …) to one or more links and
 * derive each link's mass from its geometry — mass = density · volume. This is the "set the material and
 * the mass follows" workflow that feeds Estimate Torque and the URDF `<inertial>`; the density comes from
 * the {@link MaterialPresets} library. Volume is rigid-transform-invariant, so no world placement is
 * needed. Density is kg/m³ and the kernel volume is mm³, so mass(kg) = density · volume · 1e-9.
 */
@command({
    key: "modify.setLinkMass",
    icon: "icon-measureSelect",
})
export class SetLinkMassCommand extends MultistepCommand {
    @property("material.preset", { type: "select", options: MATERIAL_OPTIONS })
    get material(): string {
        return this.getPrivateValue("material", "steel");
    }
    set material(value: string) {
        this.setProperty("material", value);
    }

    protected override getSteps(): IStep[] {
        return [new GetOrSelectNodeStep("prompt.select.shape", { multiple: true })];
    }

    protected override executeMainTask(): void {
        const links = this.stepDatas[0].nodes?.filter((n) => n instanceof LinkNode) as LinkNode[] | undefined;
        if (!links || links.length === 0) {
            PubSub.default.pub("showToast", "toast.robot.selectLink");
            return;
        }
        const preset = findMaterialPreset(this.material);
        if (!preset) {
            PubSub.default.pub("showToast", "error.default:{0}", `unknown material ${this.material}`);
            return;
        }

        let total = 0;
        Transaction.execute(this.document, `execute ${Object.getPrototypeOf(this).data.name}`, () => {
            for (const link of links) {
                const volume = linkSolidVolume(link); // mm³
                const mass = preset.density * volume * 1e-9; // kg
                link.mass = mass;
                total += mass;
            }
        });
        PubSub.default.pub("showToast", "toast.robot.massSet:{0}{1}", `${links.length}`, total.toFixed(4));
    }
}

// Total volume (mm³) of a link's own solids, descending through folders/groups but stopping at nested
// links/joints (their geometry belongs to them). Volume is invariant under the link's placement, so the
// shapes are measured as stored — no world transform needed.
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
