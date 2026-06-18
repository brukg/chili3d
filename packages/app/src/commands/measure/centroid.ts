// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { command, type IStep, PubSub, SelectShapeStep, ShapeTypes } from "@chili3d/core";
import { MultistepCommand } from "../multistepCommand";

// Area centroid of a triangulated surface: the area-weighted average of the triangle centroids. Exact
// for planar faces (a polygon triangulation reproduces its centroid) and a close approximation for
// curved ones. Pure, so it is directly unit-testable on a raw triangle soup.
export function areaCentroid(
    position: ArrayLike<number>,
    index: ArrayLike<number>,
): { x: number; y: number; z: number } | undefined {
    let cx = 0;
    let cy = 0;
    let cz = 0;
    let total = 0;
    for (let t = 0; t + 2 < index.length; t += 3) {
        const ia = index[t] * 3;
        const ib = index[t + 1] * 3;
        const ic = index[t + 2] * 3;
        const ux = position[ib] - position[ia];
        const uy = position[ib + 1] - position[ia + 1];
        const uz = position[ib + 2] - position[ia + 2];
        const vx = position[ic] - position[ia];
        const vy = position[ic + 1] - position[ia + 1];
        const vz = position[ic + 2] - position[ia + 2];
        const area = 0.5 * Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx);
        cx += (area * (position[ia] + position[ib] + position[ic])) / 3;
        cy += (area * (position[ia + 1] + position[ib + 1] + position[ic + 1])) / 3;
        cz += (area * (position[ia + 2] + position[ib + 2] + position[ic + 2])) / 3;
        total += area;
    }
    if (total === 0) return undefined;
    return { x: cx / total, y: cy / total, z: cz / total };
}

// Measure Centroid: report the area centroid of a face (Fusion's centroid readout for a face/sketch
// selection). Complements Center of Mass, which is the volume centroid of a solid.
@command({
    key: "measure.centroid",
    icon: "icon-measureSelect",
})
export class CentroidMeasure extends MultistepCommand {
    protected override getSteps(): IStep[] {
        return [new SelectShapeStep(ShapeTypes.face, "prompt.select.faces")];
    }

    protected override executeMainTask(): void {
        const data = this.stepDatas[0].shapes[0];
        if (!data) {
            PubSub.default.pub("showToast", "toast.select.noSelected");
            return;
        }
        const face = data.shape.transformedMul(data.transform);
        const mesh = face.mesh.faces;
        const centroid = mesh && areaCentroid(mesh.position, mesh.index);
        if (!centroid) {
            PubSub.default.pub("showToast", "error.default:{0}", "could not compute centroid");
            return;
        }
        PubSub.default.pub(
            "showToast",
            "toast.measure.centroid:{0}{1}{2}",
            centroid.x.toFixed(2),
            centroid.y.toFixed(2),
            centroid.z.toFixed(2),
        );
    }
}
