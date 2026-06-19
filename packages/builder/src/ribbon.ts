// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import type { RibbonTabProfile } from "@chili3d/core";

export const DefaultRibbon: RibbonTabProfile[] = [
    {
        tabName: "ribbon.tab.sketch",
        groups: [
            {
                groupName: "ribbon.group.draw",
                items: [
                    "create.line",
                    "create.polyline",
                    "create.sketch",
                    "create.sketchRect",
                    "create.sketchCenterRect",
                    "create.sketchRect3p",
                    "create.sketchCircle",
                    "create.sketchCircle3p",
                    "create.sketchSlot",
                    "create.sketchCenterSlot",
                    "create.sketchOverallSlot",
                    "create.sketchArcSlot",
                    "create.roundedRect",
                    "create.sketchFillet",
                    "create.sketchChamfer",
                    "create.sketchPolygon",
                    {
                        type: "split",
                        items: [
                            "create.rect",
                            "create.circle",
                            "create.circle2p",
                            "create.ellipse",
                            "create.ellipseArc",
                            "create.regularPolygon",
                        ],
                    },
                    {
                        type: "split",
                        items: ["create.arc", "create.arc2point", "create.arc3point"],
                    },
                ],
                collapsedItems: [
                    "create.point",
                    "create.midpointPoint",
                    "create.centerPoint",
                    "create.faceCenterPoint",
                    "create.pointsAlongCurve",
                    "create.intersectionPoint",
                    "create.axis",
                    "create.axisTwoFaces",
                    "create.axisNormalToFace",
                    "create.axisTwoPoints",
                    "create.polygon",
                    "create.bezier",
                    "create.spline",
                ],
            },
            {
                groupName: "ribbon.group.constraints",
                items: [
                    ["sketch.dimension", "sketch.dimensionX", "sketch.dimensionY", "sketch.dimensionAngle"],
                    {
                        type: "split",
                        items: [
                            "sketch.constrainHorizontal",
                            "sketch.constrainVertical",
                            "sketch.constrainCoincident",
                            "sketch.constrainFix",
                        ],
                    },
                    {
                        type: "split",
                        items: [
                            "sketch.constrainParallel",
                            "sketch.constrainPerpendicular",
                            "sketch.constrainEqual",
                            "sketch.constrainCollinear",
                            "sketch.constrainConcentric",
                            "sketch.constrainTangent",
                            "sketch.constrainPointOnLine",
                            "sketch.constrainMidpoint",
                            "sketch.constrainSymmetric",
                        ],
                    },
                ],
            },
            {
                groupName: "ribbon.group.workingPlane",
                items: [
                    "workingPlane.toggleDynamic",
                    ["workingPlane.set", "workingPlane.alignToPlane", "workingPlane.fromSection"],
                    ["workingPlane.from3Points", "workingPlane.offset"],
                    [
                        "workingPlane.atAngle",
                        "workingPlane.midPlane",
                        "workingPlane.tangent",
                        "workingPlane.normalToCurve",
                        "workingPlane.throughPoint",
                    ],
                ],
            },
        ],
    },
    {
        tabName: "ribbon.tab.create",
        groups: [
            {
                groupName: "ribbon.group.solid",
                items: [
                    {
                        type: "split",
                        items: [
                            "create.box",
                            "create.sphere",
                            "create.ellipsoid",
                            "create.cylinder",
                            "create.tube",
                            "create.cone",
                            "create.pyramid",
                            "create.torus",
                        ],
                    },
                    [
                        "create.extrude",
                        "create.taperExtrude",
                        "create.linkedExtrude",
                        "create.boundingBox",
                        "create.orientedBoundingBox",
                    ],
                    ["create.loft", "create.ruledSurface", "create.sweep", "create.revol", "create.thread"],
                    ["create.coil", "create.helix", "create.spiral"],
                ],
                collapsedItems: ["create.pipe"],
            },
            {
                groupName: "ribbon.group.boolean",
                items: [["boolean.common", "boolean.cut", "boolean.join"]],
            },
            {
                groupName: "ribbon.group.converter",
                items: [
                    "convert.toWire",
                    ["convert.toFace", "convert.toShell", "convert.toSolid"],
                    ["convert.toMesh", "convert.meshToBrep"],
                    ["create.extractEdges", "create.extractFaces"],
                ],
            },
        ],
    },
    {
        tabName: "ribbon.tab.modify",
        groups: [
            {
                groupName: "ribbon.group.modify",
                items: [
                    [
                        "modify.move",
                        "modify.rotate",
                        "modify.mirror",
                        "modify.mirrorWorkplane",
                        "modify.moveToOrigin",
                        "modify.align",
                    ],
                    ["modify.scale", "modify.scaleNonUniform"],
                    ["modify.array", "modify.trim", "modify.sew", "modify.reverseNormal"],
                    ["modify.split", "modify.break", "modify.simplifyShape", "modify.healBody"],
                    [
                        "modify.fillet",
                        "modify.filletAll",
                        "modify.variableFillet",
                        "modify.chamfer",
                        "modify.chamferAll",
                        "modify.chamferAsym",
                        "modify.chamferDA",
                    ],
                    [
                        "modify.draft",
                        "modify.hole",
                        "modify.emboss",
                        "modify.fillSurface",
                        "modify.offsetSurface",
                    ],
                    ["modify.shell", "modify.thicken", "modify.pushPull"],
                    ["modify.rib", "modify.pipeFeature", "modify.explode"],
                    ["modify.deleteNode", "modify.removeShapes", "modify.removeFeature"],
                    ["modify.removeFillet"],
                    ["modify.toggleLock", "modify.setColor"],
                    ["modify.groupFolder", "modify.ungroup"],
                ],
                collapsedItems: ["modify.brushAdd", "modify.brushRemove", "modify.brushClear"],
            },
        ],
    },
    {
        tabName: "ribbon.tab.parametric",
        groups: [
            {
                groupName: "ribbon.group.parametric",
                items: ["parameter.manage"],
            },
            {
                groupName: "ribbon.group.linked",
                items: [
                    ["modify.linkedCommon", "modify.linkedCut", "modify.linkedFuse"],
                    ["modify.linkedMove", "modify.linkedMirror", "modify.linkedRevolve"],
                    ["modify.linkedArray", "modify.linkedCircularArray", "modify.linkedPathArray"],
                ],
            },
        ],
    },
    {
        tabName: "ribbon.tab.robot",
        groups: [
            {
                groupName: "ribbon.group.robot",
                items: [
                    ["modify.createJoint", "modify.createLink", "modify.setLinkMass"],
                    ["modify.estimateTorque", "modify.robotCenterOfMass", "modify.stabilityCheck"],
                    ["modify.exportUrdf"],
                ],
            },
        ],
    },
    {
        tabName: "ribbon.tab.tools",
        groups: [
            {
                groupName: "ribbon.group.measure",
                items: [
                    [
                        "measure.length",
                        "measure.distance",
                        "measure.delta",
                        "measure.edgeLength",
                        "measure.angle",
                        "measure.faceAngle",
                        "measure.edgeAngle",
                        "measure.arcAngle",
                        "measure.curvature",
                        "measure.coordinates",
                        "measure.radius",
                        "measure.select",
                    ],
                    [
                        "measure.area",
                        "measure.perimeter",
                        "measure.topology",
                        "measure.properties",
                        "measure.mass",
                        "measure.centerOfMass",
                        "measure.centroid",
                        "measure.inertia",
                        "measure.principalInertia",
                        "measure.boundingBox",
                        "measure.orientedBoundingBox",
                        "measure.interference",
                        "measure.checkGeometry",
                    ],
                ],
            },
            {
                groupName: "ribbon.group.tools",
                items: [
                    "convert.curveProjection",
                    "create.projectToPlane",
                    "create.projectedView",
                    "create.crossSection",
                    "create.halfSection",
                    "create.meshSection",
                    "create.group",
                    ["create.section", "create.offset", "create.copyShape"],
                ],
            },
            {
                groupName: "ribbon.group.act",
                items: [
                    "act.alignCamera",
                    "view.isometric",
                    {
                        type: "split",
                        items: [
                            "view.front",
                            "view.back",
                            "view.top",
                            "view.bottom",
                            "view.right",
                            "view.left",
                        ],
                    },
                    ["view.zoomFit", "view.toggleDisplayMode", "view.toggleProjection"],
                ],
            },
            {
                groupName: "ribbon.group.importExport",
                items: ["file.import", "file.export", "file.exportBom"],
            },
            {
                groupName: "ribbon.group.other",
                items: ["wechat.group"],
            },
        ],
    },
    {
        tabName: "ribbon.tab.manager",
        groups: [
            {
                groupName: "ribbon.group.other",
                items: ["test.performance"],
            },
        ],
    },
];
