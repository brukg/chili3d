// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    EditableShapeNode,
    I18n,
    type IDataExchange,
    type IDocument,
    type INode,
    type IShape,
    LinkNode,
    PubSub,
    Result,
    ShapeNode,
    type VisualNode,
} from "@chili3d/core";
import { exportDxf } from "./dxf/dxfExporter";
import { importDxf } from "./dxf/dxfImporter";
import { importGlb } from "./gltf/gltfImporter";
import { importObj } from "./obj/objImporter";
import { importPly } from "./ply/plyImporter";
import { importSvg } from "./svg/svgImporter";
import { exportThreeMf } from "./threemf/threeMfExporter";
import { importThreeMf } from "./threemf/threeMfImporter";
import { exportUrdf } from "./urdf/urdfExporter";
import { importUrdf } from "./urdf/urdfImporter";
import { validateRobotTree } from "./urdf/urdfValidate";

export class DefaultDataExchange implements IDataExchange {
    importFormats(): string[] {
        return [
            ".step",
            ".stp",
            ".iges",
            ".igs",
            ".brep",
            ".stl",
            ".obj",
            ".ply",
            ".3mf",
            ".glb",
            ".dxf",
            ".svg",
            ".urdf",
        ];
    }

    exportFormats(): string[] {
        return [
            ".step",
            ".iges",
            ".brep",
            ".stl",
            ".stl binary",
            ".3mf",
            ".ply",
            ".ply binary",
            ".obj",
            ".gltf",
            ".glb",
            ".dxf",
            ".urdf",
        ];
    }

    async import(document: IDocument, files: FileList | File[]): Promise<void> {
        for (const file of files) {
            await this.handleSingleFileImport(document, file);
        }
    }

    private async handleSingleFileImport(document: IDocument, file: File) {
        let importResult: Result<INode> | undefined;

        const fileName = file.name.toLocaleLowerCase();
        if (this.extensionIs(fileName, ".brep")) {
            importResult = await this.importBrep(document, file);
        } else if (this.extensionIs(fileName, ".stl")) {
            importResult = await this.importStl(document, file);
        } else if (this.extensionIs(fileName, ".obj")) {
            importResult = importObj(document, file.name, await file.text());
        } else if (this.extensionIs(fileName, ".ply")) {
            importResult = importPly(document, file.name, new Uint8Array(await file.arrayBuffer()));
        } else if (this.extensionIs(fileName, ".3mf")) {
            importResult = await importThreeMf(document, file.name, new Uint8Array(await file.arrayBuffer()));
        } else if (this.extensionIs(fileName, ".glb")) {
            importResult = importGlb(document, file.name, new Uint8Array(await file.arrayBuffer()));
        } else if (this.extensionIs(fileName, ".dxf")) {
            importResult = importDxf(document, file.name, await file.text());
        } else if (this.extensionIs(fileName, ".svg")) {
            importResult = importSvg(document, file.name, await file.text());
        } else if (this.extensionIs(fileName, ".step", ".stp")) {
            importResult = await this.importStep(document, file);
        } else if (this.extensionIs(fileName, ".iges", ".igs")) {
            importResult = await this.importIges(document, file);
        } else if (this.extensionIs(fileName, ".urdf")) {
            importResult = await this.importUrdfZip(document, file);
        }

        this.handleImportResult(document, fileName, importResult);
    }

    private extensionIs(fileName: string, ...extensions: string[]): boolean {
        return extensions.some((ext) => fileName.endsWith(ext));
    }

    private handleImportResult(document: IDocument, name: string, nodeResult: Result<INode> | undefined) {
        if (!nodeResult?.isOk) {
            alert(I18n.translate("error.import.unsupportedFileType:{0}", name));
            return;
        }

        const node = nodeResult.value;
        node.name = name;
        document.modelManager.addNode(node);
        // Now the imported subtree is live in the model, re-wire any cross-node references it carries
        // (e.g. a URDF <mimic> referencing another joint) — they could not resolve while detached.
        document.modelManager.reinitializeSubtree(node);
        document.visual.update();
    }

    async importBrep(document: IDocument, file: File) {
        const shape = shapeFactory.converter.convertFromBrep(await file.text());
        if (!shape.isOk) {
            return Result.err(shape.error);
        }
        return Result.ok(new EditableShapeNode({ document, name: file.name, shape: shape.value }));
    }

    private async importStl(document: IDocument, file: File) {
        const content = new Uint8Array(await file.arrayBuffer());
        return shapeFactory.converter.convertFromSTL(document, content);
    }

    private async importIges(document: IDocument, file: File) {
        const content = new Uint8Array(await file.arrayBuffer());
        return shapeFactory.converter.convertFromIGES(document, content);
    }

    private async importStep(document: IDocument, file: File) {
        const content = new Uint8Array(await file.arrayBuffer());
        return shapeFactory.converter.convertFromSTEP(document, content);
    }

    private async importUrdfZip(document: IDocument, file: File): Promise<Result<INode>> {
        const JSZip = (await import("jszip")).default;
        const zip = await JSZip.loadAsync(await file.arrayBuffer());

        const urdfEntry = zip.file(/\.urdf$/i)[0] ?? zip.file("robot.urdf");
        if (!urdfEntry) {
            return Result.err("error.import.unsupportedFileType");
        }
        const urdf = await urdfEntry.async("string");

        const meshes = new Map<string, Uint8Array>();
        for (const entry of zip.file(/meshes\//i)) {
            const name = entry.name.split("/").pop();
            if (name) meshes.set(name, await entry.async("uint8array"));
        }

        const base = importUrdf(urdf, meshes, document, shapeFactory.converter);
        if (!base) {
            return Result.err("error.import.unsupportedFileType");
        }
        return Result.ok(base);
    }

    async export(type: string, nodes: VisualNode[]): Promise<BlobPart[] | undefined> {
        if (nodes.length === 0) return undefined;

        const document = nodes[0].document;
        let shapeResult: Result<BlobPart> | undefined;
        if (type === ".ply") {
            shapeResult = document.visual.meshExporter.exportToPly(nodes, true);
        } else if (type === ".ply binary") {
            shapeResult = document.visual.meshExporter.exportToPly(nodes, false);
        } else if (type === ".obj") {
            shapeResult = document.visual.meshExporter.exportToObj(nodes);
        } else if (type === ".gltf") {
            shapeResult = await document.visual.meshExporter.exportToGltf(nodes, false);
        } else if (type === ".glb") {
            shapeResult = await document.visual.meshExporter.exportToGltf(nodes, true);
        } else if (type === ".urdf") {
            return await this.exportUrdfZip(nodes);
        } else if (type === ".3mf") {
            return await this.exportThreeMfFile(nodes);
        } else {
            const shapes = this.getExportShapes(nodes);
            if (!shapes.length) return undefined;
            // STL goes through the headless OCCT-mesh converter (not the Three.js
            // visual exporter), so the same path works in the browser and the MCP server.
            if (type === ".stl") shapeResult = this.exportStl(document, shapes, false);
            if (type === ".stl binary") shapeResult = this.exportStl(document, shapes, true);
            if (type === ".step") shapeResult = this.exportStep(document, shapes);
            if (type === ".iges") shapeResult = this.exportIges(document, shapes);
            if (type === ".brep") shapeResult = this.exportBrep(document, shapes);
            // DXF reads 2D curve geometry directly from the shapes (no kernel converter).
            if (type === ".dxf") shapeResult = Result.ok(exportDxf(shapes));
        }

        if (shapeResult) {
            return this.handleExportResult(shapeResult);
        }
        return undefined;
    }

    private getExportShapes(nodes: VisualNode[]): IShape[] {
        const shapes = nodes
            .filter((x): x is ShapeNode => x instanceof ShapeNode)
            .map((x) => x.shape.value.transformedMul(x.worldTransform()));

        !shapes.length && PubSub.default.pub("showToast", "error.export.noNodeCanBeExported");
        return shapes;
    }

    private async exportUrdfZip(nodes: VisualNode[]): Promise<BlobPart[] | undefined> {
        const root = nodes.find((n) => n instanceof LinkNode) as LinkNode | undefined;
        if (!root) {
            // URDF needs the robot organised as a Link/Joint tree — guide the user rather than fail silently.
            PubSub.default.pub("showToast", "error.export.needLinkNode");
            return undefined;
        }
        // Warn (but still export) on a malformed kinematic tree so the user isn't handed a silently
        // broken URDF — a joint with no child link, duplicate names, a dangling mimic, etc.
        const issues = validateRobotTree(root);
        if (issues.length > 0) {
            PubSub.default.pub("showToast", "warn.export.invalidRobot", issues.join("; "));
        }
        const converter = root.document.application.shapeFactory.converter;
        const { urdf, meshes } = exportUrdf(root, root.name, converter);
        const JSZip = (await import("jszip")).default;
        const zip = new JSZip();
        zip.file("robot.urdf", urdf);
        for (const [name, bytes] of meshes) {
            zip.file(`meshes/${name}`, bytes);
        }
        const blob = await zip.generateAsync({ type: "uint8array" });
        return [blob as BlobPart];
    }

    private async exportThreeMfFile(nodes: VisualNode[]): Promise<BlobPart[] | undefined> {
        const shapes = this.getExportShapes(nodes);
        if (!shapes.length) return undefined;
        const converter = nodes[0].document.application.shapeFactory.converter;
        const result = await exportThreeMf(shapes, converter);
        if (!result.isOk) {
            PubSub.default.pub("showToast", "error.export.noNodeCanBeExported");
            return undefined;
        }
        return [result.value as BlobPart];
    }

    private exportStl(doc: IDocument, shapes: IShape[], binary: boolean): Result<BlobPart> {
        return doc.application.shapeFactory.converter.convertToSTL(shapes, { binary }) as Result<BlobPart>;
    }

    private exportStep(doc: IDocument, shapes: IShape[]) {
        return shapeFactory.converter.convertToSTEP(...shapes);
    }

    private exportIges(doc: IDocument, shapes: IShape[]) {
        return shapeFactory.converter.convertToIGES(...shapes);
    }

    private exportBrep(document: IDocument, shapes: IShape[]) {
        const comp = shapeFactory.combine(shapes);
        if (!comp.isOk) {
            return Result.err(comp.error);
        }

        const result = shapeFactory.converter.convertToBrep(comp.value);
        comp.value.dispose();
        return result;
    }

    private handleExportResult(result: Result<BlobPart> | undefined) {
        if (!result?.isOk) {
            PubSub.default.pub("showToast", "error.default:{0}", result?.error);
            return undefined;
        }
        return [result.value];
    }
}
