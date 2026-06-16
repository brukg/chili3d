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
                    "create.sketch",
                    "create.sketchRect",
                    "create.sketchCenterRect",
                    "create.sketchRect3p",
                    "create.sketchCircle",
                    "create.sketchCircle3p",
                    "create.sketchSlot",
                    "create.sketchPolygon",
                    {
                        type: "split",
                        items: ["create.rect", "create.circle", "create.ellipse", "create.regularPolygon"],
                    },
                    {
                        type: "split",
                        items: ["create.arc", "create.arc2point", "create.arc3point"],
                    },
                ],
                collapsedItems: ["create.point", "create.polygon", "create.bezier"],
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
                    ["workingPlane.atAngle", "workingPlane.midPlane"],
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
                            "create.cone",
                            "create.pyramid",
                            "create.torus",
                        ],
                    },
                    ["create.extrude", "create.linkedExtrude", "create.boundingBox"],
                    ["create.loft", "create.sweep", "create.revol", "create.thread"],
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
                    ["modify.move", "modify.rotate", "modify.mirror", "modify.moveToOrigin"],
                    ["modify.scale", "modify.scaleNonUniform"],
                    ["modify.array", "modify.trim", "modify.sew"],
                    ["modify.split", "modify.break", "modify.simplifyShape"],
                    ["modify.fillet", "modify.variableFillet", "modify.chamfer"],
                    ["modify.draft", "modify.hole", "modify.fillSurface"],
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
                items: [["modify.createJoint", "modify.createLink", "modify.exportUrdf"]],
            },
        ],
    },
    {
        tabName: "ribbon.tab.tools",
        groups: [
            {
                groupName: "ribbon.group.measure",
                items: [
                    ["measure.length", "measure.angle", "measure.select"],
                    [
                        "measure.properties",
                        "measure.centerOfMass",
                        "measure.boundingBox",
                        "measure.interference",
                    ],
                ],
            },
            {
                groupName: "ribbon.group.tools",
                items: [
                    "convert.curveProjection",
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
                    ["view.zoomFit", "view.toggleDisplayMode"],
                ],
            },
            {
                groupName: "ribbon.group.importExport",
                items: ["file.import", "file.export"],
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
