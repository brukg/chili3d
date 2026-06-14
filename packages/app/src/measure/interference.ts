// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { type IShape, type IShapeFactory, type ISolid, ShapeTypes } from "@chili3d/core";

export interface InterferenceResult {
    interferes: boolean;
    /** The volume of the overlapping region (0 when the bodies do not interfere). */
    volume: number;
}

/**
 * Inspect whether two bodies overlap (Fusion's "Interference"), via the boolean common of the two
 * shapes — a non-empty result means they interfere, and its volume is the overlap.
 */
export function checkInterference(a: IShape, b: IShape, factory: IShapeFactory): InterferenceResult {
    const common = factory.booleanCommon([a], [b]);
    if (!common.isOk) {
        return { interferes: false, volume: 0 };
    }
    const solids = common.value.findSubShapes(ShapeTypes.solid) as ISolid[];
    const volume = solids.reduce((sum, s) => sum + Math.abs(s.volume()), 0);
    return { interferes: volume > 1e-6, volume };
}
