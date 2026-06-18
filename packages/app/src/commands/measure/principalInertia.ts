// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    command,
    type IShape,
    type ISolid,
    type IStep,
    PubSub,
    SelectShapeStep,
    ShapeTypes,
} from "@chili3d/core";
import { MultistepCommand } from "../multistepCommand";

// Principal moments of inertia: the eigenvalues of the symmetric inertia tensor
//   [[ixx, ixy, ixz], [ixy, iyy, iyz], [ixz, iyz, izz]]
// returned ascending. Unlike the body-axis diagonal, these are rotation-invariant — they describe the
// body itself, independent of how it is oriented. Closed-form symmetric-3×3 eigenvalues (Smith 1961);
// pure, so it is directly unit-testable.
export function principalMoments(
    ixx: number,
    iyy: number,
    izz: number,
    ixy: number,
    ixz: number,
    iyz: number,
): [number, number, number] {
    const p1 = ixy * ixy + ixz * ixz + iyz * iyz;
    if (p1 === 0) {
        return [ixx, iyy, izz].sort((a, b) => a - b) as [number, number, number];
    }
    const q = (ixx + iyy + izz) / 3;
    const p2 = (ixx - q) ** 2 + (iyy - q) ** 2 + (izz - q) ** 2 + 2 * p1;
    const p = Math.sqrt(p2 / 6);
    const b11 = (ixx - q) / p;
    const b22 = (iyy - q) / p;
    const b33 = (izz - q) / p;
    const b12 = ixy / p;
    const b13 = ixz / p;
    const b23 = iyz / p;
    const detB =
        b11 * (b22 * b33 - b23 * b23) - b12 * (b12 * b33 - b23 * b13) + b13 * (b12 * b23 - b22 * b13);
    const r = Math.max(-1, Math.min(1, detB / 2));
    const phi = Math.acos(r) / 3;
    const eig1 = q + 2 * p * Math.cos(phi);
    const eig3 = q + 2 * p * Math.cos(phi + (2 * Math.PI) / 3);
    const eig2 = 3 * q - eig1 - eig3;
    return [eig1, eig2, eig3].sort((a, b) => a - b) as [number, number, number];
}

@command({
    key: "measure.principalInertia",
    icon: "icon-measureSelect",
})
export class PrincipalInertiaMeasure extends MultistepCommand {
    protected override getSteps(): IStep[] {
        return [new SelectShapeStep(ShapeTypes.solid, "prompt.select.solids")];
    }

    protected override executeMainTask(): void {
        const shape = this.transformdFirstShape(this.stepDatas[0]);
        const solid = this.findSolid(shape);
        if (!solid) {
            PubSub.default.pub("showToast", "error.default:{0}", "selection is not a solid");
            return;
        }

        const props = solid.massProperties();
        const i = props.momentOfInertia;
        const p = props.productOfInertia;
        const [i1, i2, i3] = principalMoments(i.x, i.y, i.z, p.x, p.y, p.z);
        PubSub.default.pub(
            "showToast",
            "toast.measure.principalInertia:{0}{1}{2}",
            i1.toFixed(2),
            i2.toFixed(2),
            i3.toFixed(2),
        );
    }

    private findSolid(shape: IShape): ISolid | undefined {
        if (shape.shapeType === ShapeTypes.solid) {
            return shape as ISolid;
        }
        const solids = shape.findSubShapes(ShapeTypes.solid) as ISolid[];
        return solids[0];
    }
}
