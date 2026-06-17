// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import type { Result } from "../foundation";
import type { Line, Plane, XYZ, XYZLike } from "../math";
import type { Continuity, ICurve } from "./curve";
import type { ICompound, IEdge, IFace, IShape, IShell, ISolid, IVertex, IWire } from "./shape";
import type { IShapeConverter } from "./shapeConverter";

export interface IShapeFactory {
    readonly kernelName: string;
    readonly converter: IShapeConverter;
    edge(curve: ICurve): IEdge;
    face(wire: IWire[]): Result<IFace>;
    shell(faces: IFace[]): Result<IShell>;
    solid(shells: IShell[]): Result<ISolid>;
    bezier(points: XYZLike[], weights?: number[]): Result<IEdge>;
    /** A fit-point spline: a B-spline edge passing through every point (unlike bezier control points). */
    interpolate(points: XYZLike[], periodic: boolean): Result<IEdge>;
    point(point: XYZLike): Result<IVertex>;
    line(start: XYZLike, end: XYZLike): Result<IEdge>;
    arc(normal: XYZLike, center: XYZLike, start: XYZLike, angle: number): Result<IEdge>;
    circle(normal: XYZLike, center: XYZLike, radius: number): Result<IEdge>;
    rect(plane: Plane, dx: number, dy: number): Result<IFace>;
    polygon(points: XYZLike[]): Result<IWire>;
    box(plane: Plane, dx: number, dy: number, dz: number): Result<ISolid>;
    ellipse(
        normal: XYZLike,
        center: XYZLike,
        xvec: XYZLike,
        majorRadius: number,
        minorRadius: number,
    ): Result<IEdge>;
    cylinder(normal: XYZLike, center: XYZLike, radius: number, dz: number): Result<ISolid>;
    torus(normal: XYZLike, center: XYZLike, radius: number, tubeRadius: number): Result<ISolid>;
    cone(normal: XYZLike, center: XYZLike, radius: number, radiusUp: number, dz: number): Result<ISolid>;
    sphere(center: XYZLike, radius: number): Result<ISolid>;
    ellipsoid(
        normal: XYZLike,
        center: XYZLike,
        xvec: XYZLike,
        xRadius: number,
        yRadius: number,
        zRadius: number,
    ): Result<ISolid>;
    pyramid(plane: Plane, dx: number, dy: number, dz: number): Result<ISolid>;
    wire(edges: IEdge[]): Result<IWire>;
    prism(shape: IShape, vec: XYZ): Result<IShape>;
    pushPull(shape: IShape, face: IShape, vec: XYZ): Result<IShape>;
    fuse(bottom: IShape, top: IShape): Result<IShape>;
    sweep(profile: IShape[], path: IWire, isRoundCorner: boolean): Result<IShape>;
    thread(
        normal: XYZLike,
        center: XYZLike,
        radius: number,
        pitch: number,
        height: number,
        profileRadius: number,
        leftHanded: boolean,
    ): Result<ISolid>;
    rib(
        base: IShape,
        profile: IWire,
        planeOrigin: XYZLike,
        planeNormal: XYZLike,
        thickness1: number,
        thickness2: number,
        fuse: boolean,
    ): Result<IShape>;
    pipeFeature(
        base: IShape,
        profileFace: IFace,
        sketchFace: IFace,
        spine: IWire,
        fuse: boolean,
    ): Result<IShape>;
    revolve(profile: IShape, axis: Line, angle: number): Result<IShape>;
    booleanCommon(shape1: IShape[], shape2: IShape[]): Result<IShape>;
    booleanCut(shape1: IShape[], shape2: IShape[]): Result<IShape>;
    booleanFuse(shape1: IShape[], shape2: IShape[], simplifyShape: boolean): Result<IShape>;
    sewing(shape1: IShape, shape2: IShape): Result<IShape>;
    combine(shapes: IShape[]): Result<ICompound>;
    makeThickSolidBySimple(shape: IShape, thickness: number): Result<IShape>;
    makeThickSolidByJoin(shape: IShape, closingFaces: IShape[], thickness: number): Result<IShape>;
    fillet(shape: IShape, edges: number[], radius: number): Result<IShape>;
    variableFillet(shape: IShape, edges: number[], radius1: number, radius2: number): Result<IShape>;
    draftAngle(
        shape: IShape,
        faces: number[],
        direction: XYZLike,
        angle: number,
        neutralOrigin: XYZLike,
        neutralNormal: XYZLike,
    ): Result<IShape>;
    fillSurface(edges: IEdge[]): Result<IShape>;
    makeHole(
        shape: IShape,
        location: XYZLike,
        direction: XYZLike,
        radius: number,
        depth: number,
    ): Result<IShape>;
    chamfer(shape: IShape, edges: number[], distance: number): Result<IShape>;
    loft(
        sections: (IVertex | IEdge | IWire)[],
        isSolid: boolean,
        isRuled: boolean,
        continuity: Continuity,
    ): Result<IShape>;
    removeFeature(shape: IShape, faces: IFace[]): Result<IShape>;
    removeFillet(
        shape: IShape,
        faces: IFace[],
    ): Result<{
        shape: IShape;
        newEdges: IEdge[];
    }>;
    removeSubShape(shape: IShape, subShapes: IShape[]): IShape;
    replaceSubShape(shape: IShape, subShape: IShape, newSubShape: IShape): IShape;
    curveProjection(curve: IEdge | IWire, targetFace: IFace, vec: XYZ): Result<IShape>;
    simplifyShape(
        shape: IShape,
        removeEdges: boolean,
        removeFaces: boolean,
        keepShapes: IShape[],
    ): Result<IShape>;
}
