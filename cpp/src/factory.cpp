// Part of the Chili3d Project, under the LGPL-3.0 License.
// See LICENSE-chili-wasm.text file in the project root for full license information.

#include <emscripten/bind.h>
#include <emscripten/val.h>

#include "shared.hpp"
#include "utils.hpp"
#include <BRepAlgoAPI_BooleanOperation.hxx>
#include <BRepAlgoAPI_Common.hxx>
#include <BRepAlgoAPI_Cut.hxx>
#include <BRepAlgoAPI_Fuse.hxx>
#include <BRepBuilderAPI_GTransform.hxx>
#include <BRepBuilderAPI_MakeEdge.hxx>
#include <BRepBuilderAPI_MakeFace.hxx>
#include <BRepBuilderAPI_MakePolygon.hxx>
#include <BRepBuilderAPI_MakeSolid.hxx>
#include <BRepBuilderAPI_MakeVertex.hxx>
#include <BRepBuilderAPI_MakeWire.hxx>
#include <BRepBuilderAPI_Sewing.hxx>
#include <BRepBuilderAPI_Transform.hxx>
#include <BRepFeat_MakeCylindricalHole.hxx>
#include <BRepFeat_MakeLinearForm.hxx>
#include <BRepFeat_MakePipe.hxx>
#include <BRepFeat_MakePrism.hxx>
#include <BRepFeat_Status.hxx>
#include <BRepFilletAPI_MakeChamfer.hxx>
#include <BRepFilletAPI_MakeFillet.hxx>
#include <BRepLib.hxx>
#include <BRepOffsetAPI_DraftAngle.hxx>
#include <BRepOffsetAPI_MakeFilling.hxx>
#include <BRepOffsetAPI_MakeOffsetShape.hxx>
#include <BRepOffsetAPI_MakePipe.hxx>
#include <BRepOffsetAPI_MakePipeShell.hxx>
#include <BRepOffsetAPI_MakeThickSolid.hxx>
#include <BRepOffsetAPI_ThruSections.hxx>
#include <BRepPrimAPI_MakeBox.hxx>
#include <BRepPrimAPI_MakeCone.hxx>
#include <BRepPrimAPI_MakeCylinder.hxx>
#include <BRepPrimAPI_MakePrism.hxx>
#include <BRepPrimAPI_MakeRevol.hxx>
#include <BRepPrimAPI_MakeSphere.hxx>
#include <BRepPrimAPI_MakeTorus.hxx>
#include <BRepProj_Projection.hxx>
#include <BRep_Tool.hxx>
#include <Geom2d_Line.hxx>
#include <GeomAPI_Interpolate.hxx>
#include <GeomAbs_Shape.hxx>
#include <Geom_BSplineCurve.hxx>
#include <Geom_BezierCurve.hxx>
#include <Geom_CylindricalSurface.hxx>
#include <Geom_Plane.hxx>
#include <NCollection_HArray1.hxx>
#include <Precision.hxx>
#include <ShapeAnalysis_Edge.hxx>
#include <ShapeAnalysis_WireOrder.hxx>
#include <ShapeFix_FixSmallFace.hxx>
#include <ShapeFix_Shape.hxx>
#include <ShapeUpgrade_UnifySameDomain.hxx>
#include <TopExp_Explorer.hxx>
#include <TopoDS.hxx>
#include <TopoDS_Shape.hxx>
#include <cmath>
#include <gp_Ax2.hxx>
#include <gp_Ax3.hxx>
#include <gp_Circ.hxx>

using namespace emscripten;

struct ShapeResult {
    TopoDS_Shape shape;
    bool isOk;
    std::string error;
};

class ShapeFactory {
public:
    static ShapeResult box(const Pln& ax3, double x, double y, double z)
    {
        gp_Pln pln = Pln::toPln(ax3);
        BRepBuilderAPI_MakeFace makeFace(pln, 0, x, 0, y);
        if (!makeFace.IsDone()) {
            return ShapeResult { TopoDS_Shape(), false, "Failed to create box" };
        }

        gp_Vec vec(pln.Axis().Direction());
        vec.Multiply(z);
        BRepPrimAPI_MakePrism box(makeFace.Face(), vec);
        if (!box.IsDone()) {
            return ShapeResult { TopoDS_Shape(), false, "Failed to create box" };
        }
        return ShapeResult { box.Shape(), true, "" };
    }

    static ShapeResult cone(const Vector3& normal, const Vector3& center, double radius, double radiusUp, double height)
    {
        gp_Ax2 ax2(Vector3::toPnt(center), Vector3::toDir(normal));
        TopoDS_Shape cone = BRepPrimAPI_MakeCone(ax2, radius, radiusUp, height).Shape();
        return ShapeResult { cone, true, "" };
    }

    static ShapeResult sphere(const Vector3& center, double radius)
    {
        TopoDS_Shape sphere = BRepPrimAPI_MakeSphere(Vector3::toPnt(center), radius).Shape();
        return ShapeResult { sphere, true, "" };
    }

    static ShapeResult ellipse(const Vector3& normal, const Vector3& center, const Vector3& xvec, double majorRadius,
        double minorRadius)
    {
        gp_Ax2 ax2(Vector3::toPnt(center), Vector3::toDir(normal), Vector3::toDir(xvec));
        gp_Elips ellipse(ax2, majorRadius, minorRadius);
        BRepBuilderAPI_MakeEdge edge(ellipse);
        if (!edge.IsDone()) {
            return ShapeResult { TopoDS_Shape(), false, "Failed to create ellipse" };
        }
        return ShapeResult { edge.Edge(), true, "" };
    }

    // A partial ellipse: the arc of the ellipse swept between the two eccentric angles (radians).
    static ShapeResult ellipseArc(const Vector3& normal, const Vector3& center, const Vector3& xvec,
        double majorRadius, double minorRadius, double startAngle, double endAngle)
    {
        gp_Ax2 ax2(Vector3::toPnt(center), Vector3::toDir(normal), Vector3::toDir(xvec));
        gp_Elips ellipse(ax2, majorRadius, minorRadius);
        BRepBuilderAPI_MakeEdge edge(ellipse, startAngle, endAngle);
        if (!edge.IsDone()) {
            return ShapeResult { TopoDS_Shape(), false, "Failed to create elliptical arc" };
        }
        return ShapeResult { edge.Edge(), true, "" };
    }

    /**
     * TODO
     */
    static ShapeResult ellipsoid(const Vector3& normal, const Vector3& center, const Vector3& xvec, double xRadius,
        double yRadius, double zRadius)
    {
        TopoDS_Shape sphere = BRepPrimAPI_MakeSphere(1).Solid();

        gp_GTrsf transform;
        transform.SetValue(1, 1, xRadius);
        transform.SetValue(2, 2, yRadius);
        transform.SetValue(3, 3, zRadius);
        transform.SetTranslationPart(gp_XYZ(center.x, center.y, center.z));

        BRepBuilderAPI_GTransform builder(sphere, transform);
        if (builder.IsDone()) {
            TopoDS_Shape ellipsoid = builder.Shape();
            return ShapeResult { ellipsoid, true, "" };
        }
        return ShapeResult { TopoDS_Shape(), false, "" };
    }

    static ShapeResult pyramid(const Pln& ax3, double x, double y, double z)
    {
        if (abs(x) <= Precision::Confusion() || abs(y) <= Precision::Confusion() || abs(z) <= Precision::Confusion()) {
            return ShapeResult { TopoDS_Shape(), false, "Invalid dimensions" };
        }

        gp_Pln pln = Pln::toPln(ax3);
        auto xvec = gp_Vec(pln.XAxis().Direction()).Multiplied(x);
        auto yvec = gp_Vec(pln.YAxis().Direction()).Multiplied(y);
        auto zvec = gp_Vec(pln.Axis().Direction()).Multiplied(z);
        auto p1 = pln.Location();
        auto p2 = p1.Translated(xvec);
        auto p3 = p1.Translated(xvec).Translated(yvec);
        auto p4 = p1.Translated(yvec);
        auto top = pln.Location().Translated((xvec + yvec) * 0.5 + zvec);

        std::vector<TopoDS_Face> faces = {
            TopoDS::Face(pointsToFace({ p1, p2, p3, p4, p1 }).shape), TopoDS::Face(pointsToFace({ p1, p2, top, p1 }).shape),
            TopoDS::Face(pointsToFace({ p2, p3, top, p2 }).shape), TopoDS::Face(pointsToFace({ p3, p4, top, p3 }).shape),
            TopoDS::Face(pointsToFace({ p4, p1, top, p4 }).shape)
        };

        return facesToSolid(faces);
    }

    static ShapeResult pointsToFace(std::vector<gp_Pnt>&& points)
    {
        auto wire = pointsToWire(points);
        if (!wire.isOk) {
            return wire;
        }

        BRepBuilderAPI_MakeFace face(TopoDS::Wire(wire.shape));
        if (!face.IsDone()) {
            return ShapeResult { TopoDS_Shape(), false, "Failed to create face" };
        }
        return ShapeResult { face.Face(), true, "" };
    }

    static ShapeResult pointsToWire(std::vector<gp_Pnt>& points)
    {
        BRepBuilderAPI_MakePolygon poly;
        for (auto& p : points) {
            poly.Add(p);
        }
        if (!poly.IsDone()) {
            return ShapeResult { TopoDS_Shape(), false, "Failed to create polygon" };
        }
        return ShapeResult { poly.Wire(), true, "" };
    }

    static ShapeResult facesToSolid(const std::vector<TopoDS_Face>& faces)
    {
        TopoDS_Shell shell;
        BRep_Builder shellBuilder;
        shellBuilder.MakeShell(shell);
        for (const auto& face : faces) {
            shellBuilder.Add(shell, face);
        }

        BRepBuilderAPI_MakeSolid solidBuilder(shell);
        if (!solidBuilder.IsDone()) {
            return ShapeResult { TopoDS_Shape(), false, "Failed to create solid" };
        }

        return ShapeResult { solidBuilder.Solid(), true, "" };
    }

    static ShapeResult cylinder(const Vector3& normal, const Vector3& center, double radius, double height)
    {
        gp_Ax2 ax2(Vector3::toPnt(center), Vector3::toDir(normal));
        BRepPrimAPI_MakeCylinder cylinder(ax2, radius, height);
        cylinder.Build();
        if (!cylinder.IsDone()) {
            return ShapeResult { TopoDS_Shape(), false, "Failed to create cylinder" };
        }
        return ShapeResult { cylinder.Solid(), true, "" };
    }

    static ShapeResult torus(const Vector3& normal, const Vector3& center, double radius, double tubeRadius)
    {
        gp_Ax2 ax2(Vector3::toPnt(center), Vector3::toDir(normal));
        BRepPrimAPI_MakeTorus torus(ax2, radius, tubeRadius);
        torus.Build();
        if (!torus.IsDone()) {
            return ShapeResult { TopoDS_Shape(), false, "Failed to create torus" };
        }
        return ShapeResult { torus.Solid(), true, "" };
    }

    static ShapeResult sweep(const ShapeArray& sections, const TopoDS_Wire& path, bool isFrenet, bool isForceC1)
    {
        BRepOffsetAPI_MakePipeShell pipe(path);
        if (isFrenet) {
            pipe.SetMode(isFrenet);
        }

        if (isForceC1) {
            pipe.SetTransitionMode(BRepBuilderAPI_RoundCorner);
            pipe.SetForceApproxC1(isForceC1);
        } else {
            pipe.SetTransitionMode(BRepBuilderAPI_RightCorner);
        }

        std::vector<TopoDS_Shape> shapesVec = vecFromJSArray<TopoDS_Shape>(sections);
        for (const auto& shape : shapesVec) {
            pipe.Add(shape);
        }

        pipe.Build();
        pipe.MakeSolid();

        if (!pipe.IsDone()) {
            return ShapeResult { TopoDS_Shape(), false, "Failed to sweep profile" };
        }
        return ShapeResult { pipe.Shape(), true, "" };
    }

    // Helical thread / coil: sweep a circular profile (radius `profileRadius`) along a helix
    // of the given cylinder `radius`, `pitch` (axial advance per turn) and total `height`,
    // placed at `center` with its axis along `normal`.
    // A helix curve (edge): a line in the (angle, height) parameter space of a cylindrical surface.
    // The standalone path used by thread()/coil(), exposed so a custom profile can be swept along it.
    static ShapeResult helix(const Vector3& normal, const Vector3& center, double radius, double pitch,
        double height, bool leftHanded)
    {
        if (radius <= 0 || pitch <= 0 || height <= 0) {
            return ShapeResult { TopoDS_Shape(), false, "Invalid helix parameters" };
        }
        Handle(Geom_CylindricalSurface) cyl
            = new Geom_CylindricalSurface(gp_Ax3(Vector3::toPnt(center), Vector3::toDir(normal)), radius);
        double slope = pitch / (2.0 * M_PI);
        double uSpan = 2.0 * M_PI * (height / pitch);
        gp_Dir2d dir(leftHanded ? -1.0 : 1.0, slope);
        Handle(Geom2d_Line) line2d = new Geom2d_Line(gp_Pnt2d(0.0, 0.0), dir);
        double paramLength = uSpan * std::sqrt(1.0 + slope * slope);
        TopoDS_Edge helixEdge = BRepBuilderAPI_MakeEdge(line2d, cyl, 0.0, paramLength).Edge();
        BRepLib::BuildCurves3d(helixEdge);
        return ShapeResult { helixEdge, true, "" };
    }

    static ShapeResult thread(const Vector3& normal, const Vector3& center, double radius, double pitch,
        double height, double profileRadius, bool leftHanded)
    {
        if (radius <= 0 || pitch <= 0 || height <= 0 || profileRadius <= 0) {
            return ShapeResult { TopoDS_Shape(), false, "Invalid thread parameters" };
        }

        // The helix is a straight line in the (u = angle, v = height) parameter space of a
        // cylindrical surface. gp_Dir2d normalises its direction, so the parameter is advanced
        // by uSpan * |dir| to cover the full angular span.
        Handle(Geom_CylindricalSurface) cyl
            = new Geom_CylindricalSurface(gp_Ax3(Vector3::toPnt(center), Vector3::toDir(normal)), radius);
        double slope = pitch / (2.0 * M_PI);
        double turns = height / pitch;
        double uSpan = 2.0 * M_PI * turns;
        gp_Dir2d dir(leftHanded ? -1.0 : 1.0, slope);
        Handle(Geom2d_Line) line2d = new Geom2d_Line(gp_Pnt2d(0.0, 0.0), dir);
        double paramLength = uSpan * std::sqrt(1.0 + slope * slope);

        TopoDS_Edge helixEdge = BRepBuilderAPI_MakeEdge(line2d, cyl, 0.0, paramLength).Edge();
        BRepLib::BuildCurves3d(helixEdge);
        TopoDS_Wire path = BRepBuilderAPI_MakeWire(helixEdge).Wire();

        // Circular profile at the helix start, perpendicular to the tangent read from the 3D
        // curve (so it is correct for either handedness).
        double f, l;
        Handle(Geom_Curve) c3d = BRep_Tool::Curve(helixEdge, f, l);
        if (c3d.IsNull()) {
            return ShapeResult { TopoDS_Shape(), false, "Failed to build helix curve" };
        }
        gp_Pnt startPnt;
        gp_Vec startTan;
        c3d->D1(f, startPnt, startTan);
        if (startTan.Magnitude() < Precision::Confusion()) {
            return ShapeResult { TopoDS_Shape(), false, "Degenerate helix tangent" };
        }
        gp_Ax2 profileAx(startPnt, gp_Dir(startTan));
        TopoDS_Edge profileEdge = BRepBuilderAPI_MakeEdge(gp_Circ(profileAx, profileRadius)).Edge();
        TopoDS_Wire profileWire = BRepBuilderAPI_MakeWire(profileEdge).Wire();

        BRepOffsetAPI_MakePipeShell pipe(path);
        pipe.SetMode(Standard_True); // Frenet frame along the helix
        pipe.Add(profileWire);
        pipe.Build();
        if (!pipe.IsDone()) {
            return ShapeResult { TopoDS_Shape(), false, "Failed to sweep thread profile" };
        }
        pipe.MakeSolid();
        return ShapeResult { pipe.Shape(), true, "" };
    }

    // Rib (fuse=true) or groove/slot (fuse=false): the planar profile wire is the rib silhouette
    // lying in the plane (planeOrigin, planeNormal); it is thickened PERPENDICULAR to that plane
    // (along planeNormal) by thickness1 on one side and thickness2 on the other, then fused to /
    // cut from the base. Directions along the plane normal is the convention BRepFeat_MakeLinearForm
    // requires (height = thickness1 + thickness2).
    static ShapeResult rib(const TopoDS_Shape& base, const TopoDS_Shape& profile,
        const Vector3& planeOrigin, const Vector3& planeNormal, double thickness1, double thickness2,
        bool fuse)
    {
        if (profile.ShapeType() != TopAbs_WIRE) {
            return ShapeResult { TopoDS_Shape(), false, "Rib profile must be a wire" };
        }
        gp_Dir normal = Vector3::toDir(planeNormal);
        Handle(Geom_Plane) plane = new Geom_Plane(gp_Ax3(Vector3::toPnt(planeOrigin), normal));
        gp_Vec n(normal);
        gp_Vec direction = n * thickness1;
        gp_Vec direction1 = n * (-thickness2);
        BRepFeat_MakeLinearForm form(
            base, TopoDS::Wire(profile), plane, direction, direction1, fuse ? 1 : 0, true);
        form.Perform();
        if (!form.IsDone()) {
            return ShapeResult { TopoDS_Shape(), false, "Failed to create rib" };
        }
        return ShapeResult { form.Shape(), true, "" };
    }

    // Pipe feature: a protrusion (fuse=true) or depression (fuse=false) on `base`, defined by the
    // `profileFace` (a face lying on `sketchFace`, itself a face of `base`) swept along `spine`.
    static ShapeResult pipeFeature(const TopoDS_Shape& base, const TopoDS_Shape& profileFace,
        const TopoDS_Shape& sketchFace, const TopoDS_Shape& spine, bool fuse)
    {
        if (profileFace.ShapeType() != TopAbs_FACE || sketchFace.ShapeType() != TopAbs_FACE
            || spine.ShapeType() != TopAbs_WIRE) {
            return ShapeResult { TopoDS_Shape(), false, "Pipe feature needs profile face, sketch face and spine wire" };
        }
        BRepFeat_MakePipe pipe(base, TopoDS::Face(profileFace), TopoDS::Face(sketchFace),
            TopoDS::Wire(spine), fuse ? 1 : 0, true);
        pipe.Perform();
        if (!pipe.IsDone()) {
            return ShapeResult { TopoDS_Shape(), false, "Failed to create pipe feature" };
        }
        return ShapeResult { pipe.Shape(), true, "" };
    }

    static ShapeResult revolve(const TopoDS_Shape& profile, const Ax1& axis, double rad)
    {
        BRepPrimAPI_MakeRevol revol(profile, Ax1::toAx1(axis), rad);
        if (!revol.IsDone()) {
            return ShapeResult { TopoDS_Shape(), false, "Failed to revolve profile" };
        }
        return ShapeResult { revol.Shape(), true, "" };
    }

    static ShapeResult prism(const TopoDS_Shape& profile, const Vector3& vec)
    {
        gp_Vec vec3 = Vector3::toVec(vec);
        BRepPrimAPI_MakePrism prism(profile, vec3);
        if (!prism.IsDone()) {
            return ShapeResult { TopoDS_Shape(), false, "Failed to create prism" };
        }
        return ShapeResult { prism.Shape(), true, "" };
    }

    static ShapeResult pushPull(const TopoDS_Shape& sbase, const TopoDS_Shape& pbase, const Vector3& vec)
    {
        gp_Vec v = Vector3::toVec(vec);
        gp_Trsf trsf;
        trsf.SetTranslation(v);
        BRepBuilderAPI_Transform transform(trsf);
        transform.Perform(pbase);
        gp_Dir dir(v);
        auto sur = BRep_Tool::Surface(TopoDS::Face(pbase));
        auto plane = Handle(Geom_Plane)::DownCast(sur);
        auto method = plane->Pln().Axis().Direction().Dot(dir) > 0 ? 1 : 0;
        if (pbase.Orientation() == TopAbs_REVERSED) {
            method = 1 - method;
        }
        BRepFeat_MakePrism prism(sbase, pbase, TopoDS::Face(transform.Shape()), dir, method, false);
        prism.Perform(v.Magnitude());
        if (!prism.IsDone()) {
            return ShapeResult { TopoDS_Shape(), false, "Failed to create prism" };
        }
        return ShapeResult { prism.Shape(), true, "" };
    }

    static ShapeResult polygon(const Vector3Array& points)
    {
        std::vector<Vector3> vector3s = vecFromJSArray<Vector3>(points);
        std::vector<gp_Pnt> pnts;
        for (auto& p : vector3s) {
            pnts.push_back(Vector3::toPnt(p));
        }
        return pointsToWire(pnts);
    }

    static ShapeResult arc(const Vector3& normal, const Vector3& center, const Vector3& start, double rad)
    {
        gp_Pnt centerPnt = Vector3::toPnt(center);
        gp_Pnt startPnt = Vector3::toPnt(start);
        gp_Dir xvec = gp_Dir(startPnt.XYZ() - centerPnt.XYZ());
        gp_Ax2 ax2(centerPnt, Vector3::toDir(normal), xvec);
        gp_Circ circ(ax2, centerPnt.Distance(startPnt));
        double startAng(0), endAng(rad);
        if (rad < 0) {
            startAng = Math::PI_2 + rad;
            endAng = Math::PI_2;
        }
        BRepBuilderAPI_MakeEdge edge(circ, startAng, endAng);
        if (!edge.IsDone()) {
            return ShapeResult { TopoDS_Shape(), false, "Failed to create arc" };
        }
        return ShapeResult { edge.Edge(), true, "" };
    }

    static ShapeResult circle(const Vector3& normal, const Vector3& center, double radius)
    {
        gp_Ax2 ax2(Vector3::toPnt(center), Vector3::toDir(normal));
        gp_Circ circ(ax2, radius);
        BRepBuilderAPI_MakeEdge edge(circ);
        if (!edge.IsDone()) {
            return ShapeResult { TopoDS_Shape(), false, "Failed to create circle" };
        }
        return ShapeResult { edge.Edge(), true, "" };
    }

    static ShapeResult rect(const Pln& pln, double width, double height)
    {
        BRepBuilderAPI_MakeFace makeFace(Pln::toPln(pln), 0, width, 0, height);
        if (!makeFace.IsDone()) {
            return ShapeResult { TopoDS_Shape(), false, "Failed to create rectangle" };
        }
        return ShapeResult { makeFace.Face(), true, "" };
    }

    static ShapeResult bezier(const Vector3Array& points, const NumberArray& weights)
    {
        std::vector<Vector3> pts = vecFromJSArray<Vector3>(points);
        NCollection_Array1<gp_Pnt> arrayofPnt(1, pts.size());
        for (int i = 0; i < pts.size(); i++) {
            arrayofPnt.SetValue(i + 1, Vector3::toPnt(pts[i]));
        }

        std::vector<double> wts = vecFromJSArray<double>(weights);
        NCollection_Array1<double> arrayOfWeight(1, wts.size());
        for (int i = 0; i < wts.size(); i++) {
            arrayOfWeight.SetValue(i + 1, wts[i]);
        }

        Handle(Geom_Curve) curve = wts.size() > 0 ? new Geom_BezierCurve(arrayofPnt, arrayOfWeight) : new Geom_BezierCurve(arrayofPnt);
        BRepBuilderAPI_MakeEdge edge(curve);
        if (!edge.IsDone()) {
            return ShapeResult { TopoDS_Shape(), false, "Failed to create bezier" };
        }
        return ShapeResult { edge.Edge(), true, "" };
    }

    // Fit-point spline: a B-spline curve that passes through every given point (GeomAPI_Interpolate),
    // unlike bezier() whose points are control points. With periodic = true the curve closes smoothly.
    static ShapeResult interpolate(const Vector3Array& points, bool periodic)
    {
        std::vector<Vector3> pts = vecFromJSArray<Vector3>(points);
        if (pts.size() < 2) {
            return ShapeResult { TopoDS_Shape(), false, "interpolate needs at least 2 points" };
        }
        Handle(NCollection_HArray1<gp_Pnt>) harray = new NCollection_HArray1<gp_Pnt>(1, pts.size());
        for (int i = 0; i < pts.size(); i++) {
            harray->SetValue(i + 1, Vector3::toPnt(pts[i]));
        }
        GeomAPI_Interpolate interp(harray, periodic, Precision::Confusion());
        interp.Perform();
        if (!interp.IsDone()) {
            return ShapeResult { TopoDS_Shape(), false, "Failed to interpolate spline" };
        }
        Handle(Geom_BSplineCurve) curve = interp.Curve();
        BRepBuilderAPI_MakeEdge edge(curve);
        if (!edge.IsDone()) {
            return ShapeResult { TopoDS_Shape(), false, "Failed to create spline edge" };
        }
        return ShapeResult { edge.Edge(), true, "" };
    }

    static ShapeResult point(const Vector3& point)
    {
        BRepBuilderAPI_MakeVertex makeVertex(Vector3::toPnt(point));
        if (!makeVertex.IsDone()) {
            return ShapeResult { TopoDS_Shape(), false, "Failed to create point" };
        }
        return ShapeResult { makeVertex.Vertex(), true, "" };
    }

    static ShapeResult line(const Vector3& start, const Vector3& end)
    {
        BRepBuilderAPI_MakeEdge makeEdge(Vector3::toPnt(start), Vector3::toPnt(end));
        if (!makeEdge.IsDone()) {
            return ShapeResult { TopoDS_Shape(), false, "Failed to create line" };
        }
        return ShapeResult { makeEdge.Edge(), true, "" };
    }

    static void orderEdge(BRepBuilderAPI_MakeWire& wire, const std::vector<TopoDS_Edge>& edges)
    {
        ShapeAnalysis_WireOrder order;
        ShapeAnalysis_Edge analysis;
        for (auto& edge : edges) {
            order.Add(BRep_Tool::Pnt(analysis.FirstVertex(edge)).XYZ(),
                BRep_Tool::Pnt(analysis.LastVertex(edge)).XYZ());
        }
        order.Perform(true);
        if (order.IsDone()) {
            for (int i = 0; i < order.NbEdges(); i++) {
                int index = order.Ordered(i + 1);
                auto edge = edges[abs(index) - 1];
                if (index < 0) {
                    edge.Reverse();
                }
                wire.Add(edge);
            }
        }
    }

    static ShapeResult wire(const EdgeArray& edges)
    {
        std::vector<TopoDS_Edge> edgesVec = vecFromJSArray<TopoDS_Edge>(edges);
        if (edgesVec.size() == 0) {
            return ShapeResult { TopoDS_Shape(), false, "No edges provided" };
        }
        BRepBuilderAPI_MakeWire wire;
        if (edgesVec.size() == 1) {
            wire.Add(edgesVec[0]);
        } else {
            orderEdge(wire, edgesVec);
        }

        if (!wire.IsDone()) {
            return ShapeResult { TopoDS_Shape(), false, "Failed to create wire" };
        }
        return ShapeResult { wire.Wire(), true, "" };
    }

    static ShapeResult face(const WireArray& wires)
    {
        std::vector<TopoDS_Wire> wiresVec = vecFromJSArray<TopoDS_Wire>(wires);
        BRepBuilderAPI_MakeFace makeFace(wiresVec[0]);
        for (int i = 1; i < wiresVec.size(); i++) {
            makeFace.Add(wiresVec[i]);
        }
        if (!makeFace.IsDone()) {
            return ShapeResult { TopoDS_Shape(), false, "Failed to create face" };
        }
        return ShapeResult { makeFace.Face(), true, "" };
    }

    static ShapeResult shell(const FaceArray& faces)
    {
        std::vector<TopoDS_Face> facesVec = vecFromJSArray<TopoDS_Face>(faces);

        TopoDS_Shell shell;
        BRep_Builder shellBuilder;
        shellBuilder.MakeShell(shell);
        for (const auto& face : facesVec) {
            shellBuilder.Add(shell, face);
        }

        return ShapeResult { shell, true, "" };
    }

    static ShapeResult solid(const ShellArray& shells)
    {
        std::vector<TopoDS_Shell> shellsVec = vecFromJSArray<TopoDS_Shell>(shells);

        BRepBuilderAPI_MakeSolid makeSolid;
        for (auto shell : shellsVec) {
            makeSolid.Add(shell);
        }
        if (!makeSolid.IsDone()) {
            return ShapeResult { TopoDS_Shape(), false, "Failed to create solid" };
        }
        return ShapeResult { makeSolid.Solid(), true, "" };
    }

    // Offset a surface (face/shell) perpendicular to itself by a signed distance, producing a new
    // open surface — unlike makeThickSolid, which closes it into a solid.
    static ShapeResult offsetSurface(const TopoDS_Shape& shape, double distance)
    {
        BRepOffsetAPI_MakeOffsetShape offsetMaker;
        offsetMaker.PerformBySimple(shape, distance);
        if (!offsetMaker.IsDone()) {
            return ShapeResult { TopoDS_Shape(), false, "Failed to offset surface" };
        }
        return ShapeResult { offsetMaker.Shape(), true, "" };
    }

    static ShapeResult makeThickSolidBySimple(const TopoDS_Shape& shape, double thickness)
    {
        BRepOffsetAPI_MakeThickSolid makeThickSolid;
        makeThickSolid.MakeThickSolidBySimple(shape, thickness);
        if (!makeThickSolid.IsDone()) {
            return ShapeResult { TopoDS_Shape(), false, "Failed to create thick solid" };
        }
        return ShapeResult { makeThickSolid.Shape(), true, "" };
    }

    static ShapeResult makeThickSolidByJoin(const TopoDS_Shape& shape, const ShapeArray& shapes, double thickness)
    {
        auto shapesList = shapeArrayToListOfShape(shapes);

        BRepOffsetAPI_MakeThickSolid makeThickSolid;
        makeThickSolid.MakeThickSolidByJoin(shape, shapesList, thickness, 1e-6);
        if (!makeThickSolid.IsDone()) {
            return ShapeResult { TopoDS_Shape(), false, "Failed to create thick solid" };
        }
        return ShapeResult { makeThickSolid.Shape(), true, "" };
    }

    static ShapeResult simplifyShape(
        const TopoDS_Shape& shape,
        const bool theUnifyEdges,
        const bool theUnifyFaces,
        const ShapeArray& keepShapes)
    {
        auto keepShapesList = shapeArrayToMapOfShape(keepShapes);

        ShapeUpgrade_UnifySameDomain anUnifier(shape, theUnifyEdges, theUnifyFaces, true);
        anUnifier.KeepShapes(keepShapesList);
        anUnifier.Build();

        return ShapeResult { anUnifier.Shape(), true, "" };
    }

    static ShapeResult booleanOperate(BRepAlgoAPI_BooleanOperation& boolOperater, const ShapeArray& args,
        const ShapeArray& tools)
    {
        auto argsList = shapeArrayToListOfShape(args);
        auto toolsList = shapeArrayToListOfShape(tools);

        boolOperater.SetToFillHistory(false);
        boolOperater.SetArguments(argsList);
        boolOperater.SetTools(toolsList);
        boolOperater.Build();
        if (!boolOperater.IsDone()) {
            return ShapeResult { TopoDS_Shape(), false, "Failed to build boolean operation" };
        }

        return ShapeResult { boolOperater.Shape(), true, "" };
    }

    static ShapeResult booleanCommon(const ShapeArray& args, const ShapeArray& tools)
    {
        BRepAlgoAPI_Common api;
        return booleanOperate(api, args, tools);
    }

    static ShapeResult booleanCut(const ShapeArray& args, const ShapeArray& tools)
    {
        BRepAlgoAPI_Cut api;
        return booleanOperate(api, args, tools);
    }

    static ShapeResult booleanFuse(const ShapeArray& args, const ShapeArray& tools)
    {
        BRepAlgoAPI_Fuse api;
        return booleanOperate(api, args, tools);
    }

    static ShapeResult combine(const ShapeArray& shapes)
    {
        std::vector<TopoDS_Shape> shapesVec = vecFromJSArray<TopoDS_Shape>(shapes);
        TopoDS_Compound compound;
        BRep_Builder builder;
        builder.MakeCompound(compound);
        for (auto shape : shapesVec) {
            builder.Add(compound, shape);
        }
        return ShapeResult { compound, true, "" };
    }

    static ShapeResult fillet(const TopoDS_Shape& shape, const NumberArray& edges, double radius)
    {
        std::vector<int> edgeVec = vecFromJSArray<int>(edges);

        NCollection_IndexedMap<TopoDS_Shape, TopTools_ShapeMapHasher> edgeMap;
        TopExp::MapShapes(shape, TopAbs_EDGE, edgeMap);

        BRepFilletAPI_MakeFillet makeFillet(shape);
        for (auto edge : edgeVec) {
            makeFillet.Add(radius, TopoDS::Edge(edgeMap.FindKey(edge + 1)));
        }
        makeFillet.Build();
        if (!makeFillet.IsDone()) {
            return ShapeResult { TopoDS_Shape(), false, "Failed to fillet" };
        }

        return ShapeResult { makeFillet.Shape(), true, "" };
    }

    static ShapeResult variableFillet(const TopoDS_Shape& shape, const NumberArray& edges, double radius1, double radius2)
    {
        std::vector<int> edgeVec = vecFromJSArray<int>(edges);

        NCollection_IndexedMap<TopoDS_Shape, TopTools_ShapeMapHasher> edgeMap;
        TopExp::MapShapes(shape, TopAbs_EDGE, edgeMap);

        BRepFilletAPI_MakeFillet makeFillet(shape);
        for (auto edge : edgeVec) {
            makeFillet.Add(radius1, radius2, TopoDS::Edge(edgeMap.FindKey(edge + 1)));
        }
        makeFillet.Build();
        if (!makeFillet.IsDone()) {
            return ShapeResult { TopoDS_Shape(), false, "Failed to variable fillet" };
        }

        TopoDS_Shape result = makeFillet.Shape();
        // BRepFilletAPI_MakeFillet returns a compound; extract the solid so callers get a solid back.
        if (result.ShapeType() == TopAbs_COMPOUND) {
            TopExp_Explorer ex(result, TopAbs_SOLID);
            if (!ex.More()) {
                return ShapeResult { TopoDS_Shape(), false, "Variable fillet produced no solid" };
            }
            result = ex.Current();
        }
        return ShapeResult { result, true, "" };
    }

    static ShapeResult makeHole(const TopoDS_Shape& base, const Vector3& location, const Vector3& direction, double radius, double depth)
    {
        gp_Ax1 axis(Vector3::toPnt(location), Vector3::toDir(direction));
        BRepFeat_MakeCylindricalHole hole;
        hole.Init(base, axis);
        hole.PerformBlind(radius, depth);
        if (hole.Status() != BRepFeat_NoError) {
            return ShapeResult { TopoDS_Shape(), false, "Failed to make hole" };
        }
        hole.Build();
        if (hole.Status() != BRepFeat_NoError) {
            return ShapeResult { TopoDS_Shape(), false, "Failed to build hole" };
        }
        TopoDS_Shape result = hole.Shape();
        // BRepFeat_MakeCylindricalHole returns a compound; extract the solid so callers get a solid back.
        if (result.ShapeType() == TopAbs_COMPOUND) {
            TopExp_Explorer ex(result, TopAbs_SOLID);
            if (!ex.More()) {
                return ShapeResult { TopoDS_Shape(), false, "Hole produced no solid" };
            }
            result = ex.Current();
        }
        return ShapeResult { result, true, "" };
    }

    static ShapeResult draftAngle(const TopoDS_Shape& shape, const NumberArray& faces, const Vector3& direction, double angle, const Vector3& neutralOrigin, const Vector3& neutralNormal)
    {
        std::vector<int> faceVec = vecFromJSArray<int>(faces);

        NCollection_IndexedMap<TopoDS_Shape, TopTools_ShapeMapHasher> faceMap;
        TopExp::MapShapes(shape, TopAbs_FACE, faceMap);

        BRepOffsetAPI_DraftAngle draft(shape);
        gp_Dir dir = Vector3::toDir(direction);
        gp_Pln neutral(Vector3::toPnt(neutralOrigin), Vector3::toDir(neutralNormal));
        for (auto f : faceVec) {
            draft.Add(TopoDS::Face(faceMap.FindKey(f + 1)), dir, angle, neutral);
            if (!draft.AddDone()) {
                return ShapeResult { TopoDS_Shape(), false, "Failed to add draft to face" };
            }
        }
        draft.Build();
        if (!draft.IsDone()) {
            return ShapeResult { TopoDS_Shape(), false, "Failed to draft" };
        }

        return ShapeResult { draft.Shape(), true, "" };
    }

    static ShapeResult fillSurface(const EdgeArray& edges)
    {
        std::vector<TopoDS_Edge> edgeVec = vecFromJSArray<TopoDS_Edge>(edges);
        if (edgeVec.size() == 0) {
            return ShapeResult { TopoDS_Shape(), false, "No edges provided" };
        }

        BRepOffsetAPI_MakeFilling filling;
        for (auto& edge : edgeVec) {
            filling.Add(edge, GeomAbs_C0);
        }
        filling.Build();
        if (!filling.IsDone()) {
            return ShapeResult { TopoDS_Shape(), false, "Failed to fill surface" };
        }

        TopoDS_Shape result = filling.Shape();
        if (result.ShapeType() != TopAbs_FACE) {
            TopExp_Explorer ex(result, TopAbs_FACE);
            if (!ex.More()) {
                return ShapeResult { TopoDS_Shape(), false, "Fill produced no face" };
            }
            result = ex.Current();
        }
        return ShapeResult { result, true, "" };
    }

    static ShapeResult chamfer(const TopoDS_Shape& shape, const NumberArray& edges, double distance)
    {
        std::vector<int> edgeVec = vecFromJSArray<int>(edges);

        NCollection_IndexedMap<TopoDS_Shape, TopTools_ShapeMapHasher> edgeMap;
        TopExp::MapShapes(shape, TopAbs_EDGE, edgeMap);

        BRepFilletAPI_MakeChamfer makeChamfer(shape);
        for (auto edge : edgeVec) {
            makeChamfer.Add(distance, TopoDS::Edge(edgeMap.FindKey(edge + 1)));
        }
        makeChamfer.Build();
        if (!makeChamfer.IsDone()) {
            return ShapeResult { TopoDS_Shape(), false, "Failed to chamfer" };
        }
        return ShapeResult { makeChamfer.Shape(), true, "" };
    }

    // Asymmetric chamfer: set back distance1 on one of the edge's faces and distance2 on the other.
    // The reference face (the face distance1 is measured from) is the first face adjacent to the edge.
    static ShapeResult chamferAsym(const TopoDS_Shape& shape, const NumberArray& edges, double distance1, double distance2)
    {
        std::vector<int> edgeVec = vecFromJSArray<int>(edges);

        NCollection_IndexedMap<TopoDS_Shape, TopTools_ShapeMapHasher> edgeMap;
        TopExp::MapShapes(shape, TopAbs_EDGE, edgeMap);
        NCollection_IndexedDataMap<TopoDS_Shape, NCollection_List<TopoDS_Shape>, TopTools_ShapeMapHasher> edgeFaceMap;
        TopExp::MapShapesAndAncestors(shape, TopAbs_EDGE, TopAbs_FACE, edgeFaceMap);

        BRepFilletAPI_MakeChamfer makeChamfer(shape);
        for (auto edge : edgeVec) {
            const TopoDS_Edge& e = TopoDS::Edge(edgeMap.FindKey(edge + 1));
            const auto& faces = edgeFaceMap.FindFromKey(e);
            if (faces.IsEmpty()) {
                return ShapeResult { TopoDS_Shape(), false, "Edge has no adjacent face" };
            }
            makeChamfer.Add(distance1, distance2, e, TopoDS::Face(faces.First()));
        }
        makeChamfer.Build();
        if (!makeChamfer.IsDone()) {
            return ShapeResult { TopoDS_Shape(), false, "Failed to chamfer" };
        }
        return ShapeResult { makeChamfer.Shape(), true, "" };
    }

    // Distance-and-angle chamfer: set back `distance` on the edge's first adjacent face; the chamfer
    // surface makes `angle` (radians) with that face.
    static ShapeResult chamferDA(const TopoDS_Shape& shape, const NumberArray& edges, double distance, double angle)
    {
        std::vector<int> edgeVec = vecFromJSArray<int>(edges);

        NCollection_IndexedMap<TopoDS_Shape, TopTools_ShapeMapHasher> edgeMap;
        TopExp::MapShapes(shape, TopAbs_EDGE, edgeMap);
        NCollection_IndexedDataMap<TopoDS_Shape, NCollection_List<TopoDS_Shape>, TopTools_ShapeMapHasher> edgeFaceMap;
        TopExp::MapShapesAndAncestors(shape, TopAbs_EDGE, TopAbs_FACE, edgeFaceMap);

        BRepFilletAPI_MakeChamfer makeChamfer(shape);
        for (auto edge : edgeVec) {
            const TopoDS_Edge& e = TopoDS::Edge(edgeMap.FindKey(edge + 1));
            const auto& faces = edgeFaceMap.FindFromKey(e);
            if (faces.IsEmpty()) {
                return ShapeResult { TopoDS_Shape(), false, "Edge has no adjacent face" };
            }
            makeChamfer.AddDA(distance, angle, e, TopoDS::Face(faces.First()));
        }
        makeChamfer.Build();
        if (!makeChamfer.IsDone()) {
            return ShapeResult { TopoDS_Shape(), false, "Failed to chamfer" };
        }
        return ShapeResult { makeChamfer.Shape(), true, "" };
    }

    static ShapeResult loft(const ShapeArray& sections, bool isSolid, bool isRuled, GeomAbs_Shape continuity)
    {
        std::vector<TopoDS_Shape> shapeVector = emscripten::vecFromJSArray<TopoDS_Shape>(sections);
        if (shapeVector.size() < 2) {
            return ShapeResult { TopoDS_Shape(), false, "Failed to loft: at least 2 sections are required" };
        }
        if (shapeVector.size() == 2 && shapeVector[0].ShapeType() == TopAbs_VERTEX && shapeVector[1].ShapeType() == TopAbs_VERTEX) {
            return ShapeResult { TopoDS_Shape(), false, "Failed to loft: must have at least 1 wires" };
        }

        BRepOffsetAPI_ThruSections loftBuilder(isSolid, isRuled);
        if (!isRuled) {
            loftBuilder.SetContinuity(continuity);
        }

        for (auto& profile : shapeVector) {
            if (profile.ShapeType() == TopAbs_WIRE) {
                loftBuilder.AddWire(TopoDS::Wire(profile));
            } else if (profile.ShapeType() == TopAbs_VERTEX) {
                loftBuilder.AddVertex(TopoDS::Vertex(profile));
            }
        }
        loftBuilder.Build();
        if (!loftBuilder.IsDone()) {
            return ShapeResult { TopoDS_Shape(), false, "Failed to loft" };
        }
        return ShapeResult { loftBuilder.Shape(), true, "" };
    }

    static ShapeResult curveProjection(const TopoDS_Shape& curve, const TopoDS_Shape& targetFace, const gp_Dir& dir)
    {
        BRepProj_Projection curveProjection(curve, targetFace, dir);
        if (!curveProjection.IsDone()) {
            return ShapeResult { TopoDS_Shape(), false, "Failed to create curve projection" };
        }
        return ShapeResult { curveProjection.Shape(), true, "" };
    }

    static ShapeResult fixShape(const TopoDS_Shape& shape)
    {
        ShapeFix_Shape fixer(shape);
        fixer.Perform();
        return ShapeResult { fixer.Shape(), true, "" };
    }

    // Rebuild a B-rep from a triangle soup: every consecutive triple of points is one triangle face;
    // sewing merges the shared edges into a shell, promoted to a solid when the shell comes out closed.
    // The faceted result mirrors Fusion's Mesh -> BRep for an editable body from imported/converted mesh.
    static ShapeResult meshToShape(const Vector3Array& corners)
    {
        std::vector<Vector3> pts = vecFromJSArray<Vector3>(corners);
        if (pts.size() < 3 || pts.size() % 3 != 0) {
            return ShapeResult { TopoDS_Shape(), false, "mesh needs whole triangles (3 points each)" };
        }
        BRepBuilderAPI_Sewing sewing(1.0e-6);
        int added = 0;
        for (size_t i = 0; i + 2 < pts.size(); i += 3) {
            BRepBuilderAPI_MakePolygon poly(
                Vector3::toPnt(pts[i]), Vector3::toPnt(pts[i + 1]), Vector3::toPnt(pts[i + 2]), Standard_True);
            if (!poly.IsDone()) {
                continue;
            }
            BRepBuilderAPI_MakeFace face(poly.Wire(), Standard_True);
            if (!face.IsDone()) {
                continue;
            }
            sewing.Add(face.Face());
            added++;
        }
        if (added == 0) {
            return ShapeResult { TopoDS_Shape(), false, "no valid triangles in mesh" };
        }
        sewing.Perform();
        TopoDS_Shape sewed = sewing.SewedShape();
        if (sewed.IsNull()) {
            return ShapeResult { TopoDS_Shape(), false, "failed to sew mesh triangles" };
        }
        TopExp_Explorer ex(sewed, TopAbs_SHELL);
        if (ex.More()) {
            TopoDS_Shell shell = TopoDS::Shell(ex.Current());
            if (shell.Closed()) {
                BRepBuilderAPI_MakeSolid solidBuilder(shell);
                if (solidBuilder.IsDone()) {
                    return ShapeResult { solidBuilder.Solid(), true, "" };
                }
            }
        }
        return ShapeResult { sewed, true, "" };
    }

    static ShapeResult fixSmallFace(const TopoDS_Shape& shape, double tolerance)
    {
        ShapeFix_FixSmallFace fixer;
        fixer.Init(shape);
        fixer.SetPrecision(tolerance);
        fixer.Perform();
        return ShapeResult { fixer.Shape(), true, "" };
    }
};

EMSCRIPTEN_BINDINGS(ShapeFactory)
{
    class_<ShapeResult>("ShapeResult")
        .property("shape", &ShapeResult::shape, return_value_policy::reference())
        .property("isOk", &ShapeResult::isOk)
        .property("error", &ShapeResult::error);

    class_<ShapeFactory>("ShapeFactory")
        .class_function("box", &ShapeFactory::box)
        .class_function("cone", &ShapeFactory::cone)
        .class_function("sphere", &ShapeFactory::sphere)
        .class_function("ellipsoid", &ShapeFactory::ellipsoid)
        .class_function("ellipse", &ShapeFactory::ellipse)
        .class_function("ellipseArc", &ShapeFactory::ellipseArc)
        .class_function("cylinder", &ShapeFactory::cylinder)
        .class_function("torus", &ShapeFactory::torus)
        .class_function("pyramid", &ShapeFactory::pyramid)
        .class_function("sweep", &ShapeFactory::sweep)
        .class_function("helix", &ShapeFactory::helix)
        .class_function("thread", &ShapeFactory::thread)
        .class_function("rib", &ShapeFactory::rib)
        .class_function("pipeFeature", &ShapeFactory::pipeFeature)
        .class_function("revolve", &ShapeFactory::revolve)
        .class_function("prism", &ShapeFactory::prism)
        .class_function("pushPull", &ShapeFactory::pushPull)
        .class_function("polygon", &ShapeFactory::polygon)
        .class_function("circle", &ShapeFactory::circle)
        .class_function("arc", &ShapeFactory::arc)
        .class_function("bezier", &ShapeFactory::bezier)
        .class_function("interpolate", &ShapeFactory::interpolate)
        .class_function("rect", &ShapeFactory::rect)
        .class_function("point", &ShapeFactory::point)
        .class_function("line", &ShapeFactory::line)
        .class_function("wire", &ShapeFactory::wire)
        .class_function("face", &ShapeFactory::face)
        .class_function("shell", &ShapeFactory::shell)
        .class_function("solid", &ShapeFactory::solid)
        .class_function("offsetSurface", &ShapeFactory::offsetSurface)
        .class_function("makeThickSolidBySimple", &ShapeFactory::makeThickSolidBySimple)
        .class_function("makeThickSolidByJoin", &ShapeFactory::makeThickSolidByJoin)
        .class_function("simplifyShape", &ShapeFactory::simplifyShape)
        .class_function("booleanCommon", &ShapeFactory::booleanCommon)
        .class_function("booleanCut", &ShapeFactory::booleanCut)
        .class_function("booleanFuse", &ShapeFactory::booleanFuse)
        .class_function("combine", &ShapeFactory::combine)
        .class_function("fillet", &ShapeFactory::fillet)
        .class_function("variableFillet", &ShapeFactory::variableFillet)
        .class_function("draftAngle", &ShapeFactory::draftAngle)
        .class_function("fillSurface", &ShapeFactory::fillSurface)
        .class_function("makeHole", &ShapeFactory::makeHole)
        .class_function("chamfer", &ShapeFactory::chamfer)
        .class_function("chamferAsym", &ShapeFactory::chamferAsym)
        .class_function("chamferDA", &ShapeFactory::chamferDA)
        .class_function("fixShape", &ShapeFactory::fixShape)
        .class_function("meshToShape", &ShapeFactory::meshToShape)
        .class_function("fixSmallFace", &ShapeFactory::fixSmallFace)
        .class_function("loft", &ShapeFactory::loft)
        .class_function("curveProjection", &ShapeFactory::curveProjection);
}