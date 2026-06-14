// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { property } from "../property";
import { serializable, serialize } from "../serialize";
import { GroupNode } from "./groupNode";

/**
 * A named rigid body in a kinematic tree. Its direct geometry children are the link's
 * visual geometry; its JointNode children connect it to child links. Maps to a URDF <link>.
 */
@serializable()
export class LinkNode extends GroupNode {
    @serialize()
    @property("link.mass")
    get mass(): number {
        return this.getPrivateValue("mass", 1);
    }
    set mass(value: number) {
        this.setProperty("mass", value);
    }
}
