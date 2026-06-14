// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

/**
 * A small 2D geometric constraint solver — the foundation of a parametric sketcher (Tier C / C4).
 * Points are the variables; constraints are residual equations. The system is solved by damped
 * Gauss-Newton (Levenberg-Marquardt), which tolerates under-constrained sketches (free degrees of
 * freedom stay near their initial value) and over-constrained-but-consistent ones.
 */

export interface Point2d {
    x: number;
    y: number;
}

/** A constraint contributes one or more residuals (each driven to ~0) over the flat variable vector. */
export interface Constraint {
    /** `vars` is the flat `[x0, y0, x1, y1, …]` vector; returns this constraint's residual values. */
    residuals(vars: number[]): number[];
}

const px = (i: number) => 2 * i;
const py = (i: number) => 2 * i + 1;

/** Pin a point to a fixed location. */
export function fixed(point: number, x: number, y: number): Constraint {
    return { residuals: (v) => [v[px(point)] - x, v[py(point)] - y] };
}

/** Two points must coincide. */
export function coincident(a: number, b: number): Constraint {
    return { residuals: (v) => [v[px(a)] - v[px(b)], v[py(a)] - v[py(b)]] };
}

/** The distance between two points must equal `d`. */
export function distance(a: number, b: number, d: number): Constraint {
    return {
        residuals: (v) => {
            const dx = v[px(a)] - v[px(b)];
            const dy = v[py(a)] - v[py(b)];
            return [Math.hypot(dx, dy) - d];
        },
    };
}

/** Two points share the same Y (the segment between them is horizontal). */
export function horizontal(a: number, b: number): Constraint {
    return { residuals: (v) => [v[py(a)] - v[py(b)]] };
}

/** Two points share the same X (the segment between them is vertical). */
export function vertical(a: number, b: number): Constraint {
    return { residuals: (v) => [v[px(a)] - v[px(b)]] };
}

/** Segment a→b is parallel to segment c→d (their direction cross-product is zero). */
export function parallel(a: number, b: number, c: number, d: number): Constraint {
    return {
        residuals: (v) => {
            const ux = v[px(b)] - v[px(a)];
            const uy = v[py(b)] - v[py(a)];
            const wx = v[px(d)] - v[px(c)];
            const wy = v[py(d)] - v[py(c)];
            return [ux * wy - uy * wx];
        },
    };
}

/** Segment a→b is perpendicular to segment c→d (their direction dot-product is zero). */
export function perpendicular(a: number, b: number, c: number, d: number): Constraint {
    return {
        residuals: (v) => {
            const ux = v[px(b)] - v[px(a)];
            const uy = v[py(b)] - v[py(a)];
            const wx = v[px(d)] - v[px(c)];
            const wy = v[py(d)] - v[py(c)];
            return [ux * wx + uy * wy];
        },
    };
}

/** Segments a→b and c→d have equal length. */
export function equalLength(a: number, b: number, c: number, d: number): Constraint {
    return {
        residuals: (v) => {
            const l1 = Math.hypot(v[px(b)] - v[px(a)], v[py(b)] - v[py(a)]);
            const l2 = Math.hypot(v[px(d)] - v[px(c)], v[py(d)] - v[py(c)]);
            return [l1 - l2];
        },
    };
}

/** Point p lies on the line through a and b (p is collinear with a→b). */
export function pointOnLine(p: number, a: number, b: number): Constraint {
    return {
        residuals: (v) => {
            const ux = v[px(b)] - v[px(a)];
            const uy = v[py(b)] - v[py(a)];
            const wx = v[px(p)] - v[px(a)];
            const wy = v[py(p)] - v[py(a)];
            return [ux * wy - uy * wx];
        },
    };
}

/** Signed horizontal distance from a to b equals `dx`. */
export function distanceX(a: number, b: number, dx: number): Constraint {
    return { residuals: (v) => [v[px(b)] - v[px(a)] - dx] };
}

/** Signed vertical distance from a to b equals `dy`. */
export function distanceY(a: number, b: number, dy: number): Constraint {
    return { residuals: (v) => [v[py(b)] - v[py(a)] - dy] };
}

/** The angle from segment a→b to segment c→d equals `radians`. */
export function angle(a: number, b: number, c: number, d: number, radians: number): Constraint {
    return {
        residuals: (v) => {
            const ux = v[px(b)] - v[px(a)];
            const uy = v[py(b)] - v[py(a)];
            const wx = v[px(d)] - v[px(c)];
            const wy = v[py(d)] - v[py(c)];
            const cross = ux * wy - uy * wx;
            const dot = ux * wx + uy * wy;
            return [Math.atan2(cross, dot) - radians];
        },
    };
}

export interface SolveOptions {
    maxIterations?: number;
    tolerance?: number;
}

export interface SolveResult {
    converged: boolean;
    iterations: number;
    residualNorm: number;
    points: Point2d[];
}

function allResiduals(constraints: Constraint[], vars: number[]): number[] {
    const r: number[] = [];
    for (const c of constraints) r.push(...c.residuals(vars));
    return r;
}

function norm(v: number[]): number {
    let s = 0;
    for (const x of v) s += x * x;
    return Math.sqrt(s);
}

// Numerical Jacobian (m residuals × n vars) via forward differences.
function jacobian(constraints: Constraint[], vars: number[], r0: number[]): number[][] {
    const n = vars.length;
    const m = r0.length;
    const eps = 1e-7;
    const J: number[][] = Array.from({ length: m }, () => new Array(n).fill(0));
    const perturbed = vars.slice();
    for (let j = 0; j < n; j++) {
        const original = perturbed[j];
        const h = eps * (Math.abs(original) + eps);
        perturbed[j] = original + h;
        const rj = allResiduals(constraints, perturbed);
        perturbed[j] = original;
        for (let i = 0; i < m; i++) J[i][j] = (rj[i] - r0[i]) / h;
    }
    return J;
}

// Solve the symmetric system A x = b by Gaussian elimination with partial pivoting.
function solveLinear(A: number[][], b: number[]): number[] | undefined {
    const n = b.length;
    const M = A.map((row, i) => [...row, b[i]]);
    for (let col = 0; col < n; col++) {
        let pivot = col;
        for (let r = col + 1; r < n; r++) {
            if (Math.abs(M[r][col]) > Math.abs(M[pivot][col])) pivot = r;
        }
        if (Math.abs(M[pivot][col]) < 1e-12) return undefined;
        [M[col], M[pivot]] = [M[pivot], M[col]];
        for (let r = 0; r < n; r++) {
            if (r === col) continue;
            const factor = M[r][col] / M[col][col];
            for (let c = col; c <= n; c++) M[r][c] -= factor * M[col][c];
        }
    }
    // After full elimination the system is diagonal: x[i] = rhs[i] / diag[i].
    return M.map((row, i) => row[n] / row[i]);
}

// The rank of a matrix via Gaussian elimination with partial pivoting (count of pivot rows).
function matrixRank(matrix: number[][]): number {
    const rows = matrix.map((r) => [...r]);
    const m = rows.length;
    const n = rows[0]?.length ?? 0;
    const eps = 1e-7;
    let rank = 0;
    for (let col = 0; col < n && rank < m; col++) {
        let pivot = -1;
        let best = eps;
        for (let r = rank; r < m; r++) {
            if (Math.abs(rows[r][col]) > best) {
                best = Math.abs(rows[r][col]);
                pivot = r;
            }
        }
        if (pivot === -1) continue;
        [rows[rank], rows[pivot]] = [rows[pivot], rows[rank]];
        for (let r = 0; r < m; r++) {
            if (r === rank) continue;
            const factor = rows[r][col] / rows[rank][col];
            for (let c = col; c < n; c++) rows[r][c] -= factor * rows[rank][c];
        }
        rank++;
    }
    return rank;
}

export interface DofAnalysis {
    variables: number;
    rank: number;
    /** Remaining free degrees of freedom (variables − independent constraints). */
    degreesOfFreedom: number;
    /** Constraint equations beyond the independent set (redundant / conflicting). */
    redundant: number;
    status: "under-constrained" | "fully-constrained" | "over-constrained";
}

/**
 * Report whether a sketch is under-, fully-, or over-constrained by comparing the constraint
 * Jacobian's rank against the variable count — the standard sketcher feedback that tells the user
 * how many degrees of freedom remain.
 */
export function analyzeConstraints(initial: Point2d[], constraints: Constraint[]): DofAnalysis {
    const vars: number[] = [];
    for (const p of initial) vars.push(p.x, p.y);
    const r0 = allResiduals(constraints, vars);
    const J = jacobian(constraints, vars, r0);
    const rank = J.length === 0 ? 0 : matrixRank(J);
    const variables = vars.length;
    const degreesOfFreedom = variables - rank;
    const redundant = r0.length - rank;
    const status =
        degreesOfFreedom > 0 ? "under-constrained" : redundant > 0 ? "over-constrained" : "fully-constrained";
    return { variables, rank, degreesOfFreedom, redundant, status };
}

/**
 * Solve the constraint system, starting from `initial` point positions. Returns the solved points
 * and whether the residual converged below `tolerance`.
 */
export function solveConstraints(
    initial: Point2d[],
    constraints: Constraint[],
    options?: SolveOptions,
): SolveResult {
    const maxIterations = options?.maxIterations ?? 100;
    const tolerance = options?.tolerance ?? 1e-9;

    let vars: number[] = [];
    for (const p of initial) vars.push(p.x, p.y);
    const n = vars.length;

    let r = allResiduals(constraints, vars);
    let error = norm(r);
    let lambda = 1e-3;
    let iterations = 0;

    for (; iterations < maxIterations && error > tolerance; iterations++) {
        const J = jacobian(constraints, vars, r);
        const m = r.length;
        // Normal equations: (JᵀJ + λ·diag(JᵀJ)) Δ = -Jᵀr
        const JtJ: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
        const Jtr: number[] = new Array(n).fill(0);
        for (let a = 0; a < n; a++) {
            for (let b = 0; b < n; b++) {
                let s = 0;
                for (let i = 0; i < m; i++) s += J[i][a] * J[i][b];
                JtJ[a][b] = s;
            }
            let s = 0;
            for (let i = 0; i < m; i++) s += J[i][a] * r[i];
            Jtr[a] = s;
        }
        const A = JtJ.map((row, i) => row.map((v, j) => (i === j ? v + lambda * (v + 1) : v)));
        const negJtr = Jtr.map((x) => -x);
        const delta = solveLinear(A, negJtr);
        if (!delta) {
            lambda *= 10;
            if (lambda > 1e12) break;
            continue;
        }
        const candidate = vars.map((v, i) => v + delta[i]);
        const rNew = allResiduals(constraints, candidate);
        const errorNew = norm(rNew);
        if (errorNew < error) {
            vars = candidate;
            r = rNew;
            error = errorNew;
            lambda = Math.max(lambda / 3, 1e-9);
        } else {
            lambda *= 3;
            if (lambda > 1e12) break;
        }
    }

    const points: Point2d[] = [];
    for (let i = 0; i < n; i += 2) points.push({ x: vars[i], y: vars[i + 1] });
    return { converged: error <= tolerance, iterations, residualNorm: error, points };
}
