// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

// Static stability analysis (robot-building foundation). A standing/legged robot is statically stable
// when the ground projection of its centre of mass falls inside the support polygon — the convex hull
// of its ground contact points. This module is pure 2D geometry on the ground plane (X/Y, Z up): build
// the support polygon from contact points, test containment, and report the stability margin (how far
// the COM projection is from tipping). No kernel dependency, so it is directly unit-testable. Units are
// whatever the inputs use (millimetres in Chili3D model space); the margin comes back in the same unit.

/** A point on the ground plane (X/Y; Z is up and dropped). */
export interface Vec2 {
    x: number;
    y: number;
}

// Signed area of triangle (o, a, b) × 2 — positive when o→a→b turns counter-clockwise.
function cross(o: Vec2, a: Vec2, b: Vec2): number {
    return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

/**
 * Convex hull of the contact points (Andrew's monotone chain), returned counter-clockwise with no
 * repeated closing vertex. Collinear interior points are dropped. Fewer than three unique points come
 * back as-is (a point or a segment — no enclosed area, hence no stable base).
 */
export function convexHull2D(points: readonly Vec2[]): Vec2[] {
    const pts = [...points].sort((a, b) => (a.x === b.x ? a.y - b.y : a.x - b.x));
    // Drop exact duplicates so the chain build doesn't emit zero-length edges.
    const unique: Vec2[] = [];
    for (const p of pts) {
        const last = unique[unique.length - 1];
        if (!last || last.x !== p.x || last.y !== p.y) unique.push(p);
    }
    if (unique.length <= 2) return unique;

    const lower: Vec2[] = [];
    for (const p of unique) {
        while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
            lower.pop();
        }
        lower.push(p);
    }
    const upper: Vec2[] = [];
    for (let i = unique.length - 1; i >= 0; i--) {
        const p = unique[i];
        while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
            upper.pop();
        }
        upper.push(p);
    }
    // Drop each chain's last point (shared with the other chain's first).
    lower.pop();
    upper.pop();
    return lower.concat(upper);
}

/**
 * Whether a point lies inside a polygon (ray casting; works for convex and concave). Points exactly on
 * an edge are reported inconsistently by the ray test — use {@link stabilityMargin}, which treats the
 * near-boundary case via distance, when the edge matters.
 */
export function pointInPolygon(p: Vec2, polygon: readonly Vec2[]): boolean {
    const n = polygon.length;
    if (n < 3) return false;
    let inside = false;
    for (let i = 0, j = n - 1; i < n; j = i++) {
        const xi = polygon[i].x;
        const yi = polygon[i].y;
        const xj = polygon[j].x;
        const yj = polygon[j].y;
        const intersects = yi > p.y !== yj > p.y && p.x < ((xj - xi) * (p.y - yi)) / (yj - yi) + xi;
        if (intersects) inside = !inside;
    }
    return inside;
}

// Distance from p to segment [a, b].
function pointSegmentDistance(p: Vec2, a: Vec2, b: Vec2): number {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
    let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** Distance from a point to the nearest edge of a polygon/polyline (the wrap-around closing edge
 * included). Returns Infinity for an empty polygon. */
export function distanceToPolygonBoundary(p: Vec2, polygon: readonly Vec2[]): number {
    const n = polygon.length;
    if (n === 0) return Number.POSITIVE_INFINITY;
    if (n === 1) return Math.hypot(p.x - polygon[0].x, p.y - polygon[0].y);
    let min = Number.POSITIVE_INFINITY;
    for (let i = 0, j = n - 1; i < n; j = i++) {
        min = Math.min(min, pointSegmentDistance(p, polygon[j], polygon[i]));
    }
    return min;
}

/**
 * Static stability margin: the signed distance from the COM ground projection to the support polygon's
 * boundary — positive when inside (distance to the nearest tipping edge), negative when outside (the
 * robot is already tipping). The support polygon should be the convex hull of the contact points (see
 * {@link convexHull2D}); with fewer than three contact points there is no supporting area, so the margin
 * is non-positive. A larger positive margin means a more stable stance.
 */
export function stabilityMargin(comProjection: Vec2, supportPolygon: readonly Vec2[]): number {
    const d = distanceToPolygonBoundary(comProjection, supportPolygon);
    if (supportPolygon.length < 3) return -d;
    return pointInPolygon(comProjection, supportPolygon) ? d : -d;
}
