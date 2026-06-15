// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import type { Vec3 } from "./convexHull";

// Inertia of a solid from its closed triangle mesh, via the per-tetrahedron exact integrals (Tonon,
// "Explicit Exact Formulas for the 3-D Tetrahedron Inertia Tensor", 2004). Each triangle forms a
// signed tetrahedron with the COM; summing the integrals over all of them yields the solid's moments.
// For a polyhedron (flat faces) this is EXACT — the surface integral of the polynomial integrands over
// flat triangles has no discretization error. It is used to obtain the off-diagonal products of
// inertia (ixy, ixz, iyz) that the OCCT binding does not expose (it returns only the diagonal).

export interface InertiaTensor {
    volume: number; // mm³
    // Inertia tensor about the supplied centre, unit density (mm⁵). URDF/tensor sign convention:
    // the products are negative integrals, i.e. ixy = -∫xy dV.
    ixx: number;
    iyy: number;
    izz: number;
    ixy: number;
    ixz: number;
    iyz: number;
}

/**
 * Inertia tensor of a triangle mesh about `center`, assuming unit density. `vertices` is a flat list
 * where every three consecutive points form one (outward-wound) triangle — i.e. the layout produced
 * by {@link verticesFromBinarySTL}.
 */
export function meshInertiaTensor(vertices: Vec3[], center: Vec3): InertiaTensor {
    let volume = 0;
    // Raw second moments / products integrated over the solid (∫x², ∫y², ∫z², ∫xy, ∫xz, ∫yz).
    let xx = 0;
    let yy = 0;
    let zz = 0;
    let xy = 0;
    let xz = 0;
    let yz = 0;

    for (let i = 0; i + 2 < vertices.length; i += 3) {
        // Shift to the centre so the result is about it directly.
        const ax = vertices[i][0] - center[0];
        const ay = vertices[i][1] - center[1];
        const az = vertices[i][2] - center[2];
        const bx = vertices[i + 1][0] - center[0];
        const by = vertices[i + 1][1] - center[1];
        const bz = vertices[i + 1][2] - center[2];
        const cx = vertices[i + 2][0] - center[0];
        const cy = vertices[i + 2][1] - center[1];
        const cz = vertices[i + 2][2] - center[2];

        // Six times the signed volume of the tetra (origin, a, b, c).
        const v6 = ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx);
        volume += v6 / 6;

        // ∫u² dV over the tetra = (v6/60)·(ua²+ub²+uc²+ua·ub+ub·uc+uc·ua).
        xx += (v6 / 60) * (ax * ax + bx * bx + cx * cx + ax * bx + bx * cx + cx * ax);
        yy += (v6 / 60) * (ay * ay + by * by + cy * cy + ay * by + by * cy + cy * ay);
        zz += (v6 / 60) * (az * az + bz * bz + cz * cz + az * bz + bz * cz + cz * az);

        // ∫uv dV over the tetra = (v6/120)·(2(ua·va+ub·vb+uc·vc)+ua·vb+ub·va+ub·vc+uc·vb+ua·vc+uc·va).
        xy +=
            (v6 / 120) *
            (2 * (ax * ay + bx * by + cx * cy) + ax * by + bx * ay + bx * cy + cx * by + ax * cy + cx * ay);
        xz +=
            (v6 / 120) *
            (2 * (ax * az + bx * bz + cx * cz) + ax * bz + bx * az + bx * cz + cx * bz + ax * cz + cx * az);
        yz +=
            (v6 / 120) *
            (2 * (ay * az + by * bz + cy * cz) + ay * bz + by * az + by * cz + cy * bz + ay * cz + cy * az);
    }

    // The moment sums carry the sign of the (winding-dependent) signed volume; normalize to an
    // outward-wound solid so the result is correct regardless of triangle orientation.
    const s = volume < 0 ? -1 : 1;
    xx *= s;
    yy *= s;
    zz *= s;
    xy *= s;
    xz *= s;
    yz *= s;

    return {
        volume: Math.abs(volume),
        ixx: yy + zz,
        iyy: xx + zz,
        izz: xx + yy,
        ixy: -xy,
        ixz: -xz,
        iyz: -yz,
    };
}
