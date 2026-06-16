import type { Navigation3DType } from "../navigation";
import type { CommandKeys } from "./commandKeys";

type ShortcutMap = Partial<Record<CommandKeys, string | string[]>>;

export const Chili3dShortcuts: ShortcutMap = {
    // System
    "doc.save": "ctrl+s",
    "doc.open": "ctrl+o",
    "edit.undo": "ctrl+z",
    "edit.redo": ["ctrl+y", "ctrl+shift+z"],
    "edit.selectAll": "ctrl+a",
    "view.zoomFit": "f",
    "view.toggleDisplayMode": "w",
    "modify.deleteNode": ["Delete", "Backspace"],
    "modify.cutNode": "ctrl+x",
    "modify.copyNode": "ctrl+c",
    "modify.pasteNode": "ctrl+v",
    "modify.duplicate": "ctrl+d",
    "modify.isolate": "ctrl+i",
    "modify.hideOthers": "alt+h",
    "modify.hideSelected": "ctrl+h",
    "modify.showAll": "alt+shift+h",
    "modify.toggleLock": "ctrl+l",
    "modify.groupFolder": "ctrl+g",
    "modify.ungroup": "ctrl+shift+g",
    "special.last": [" ", "Enter"],

    // Sketching
    "create.line": "l",
    "create.rect": "r",
    "create.circle": "c",
    "measure.length": "d",

    // Primitives
    "create.box": "b",
    "create.sphere": "s",
    "create.cylinder": "y",
    "create.cone": "n",
    "create.pipe": "shift+p",

    // Modify
    "modify.trim": "t",
    "create.offset": "o",
    "modify.rotate": "shift+r",
    "create.extrude": "p",
    "modify.move": "m",
    "modify.array": "shift+a",
    "boolean.common": "shift+i",
    "modify.explode": "x",
    "modify.chamfer": "shift+c",
    "modify.fillet": "shift+f",
};

export const DefaultShortcuts: ShortcutMap = Chili3dShortcuts;

export const RevitShortcuts: ShortcutMap = {
    ...Chili3dShortcuts,
    "modify.move": "m+v", // MV
    "modify.rotate": "r+o", // RO
    "modify.trim": "t+r", // TR
    "create.line": "l+i", // LI
    // Add more as needed
};

export const BlenderShortcuts: ShortcutMap = {
    ...DefaultShortcuts,
    "modify.move": "g",
    "modify.rotate": "r",
    "create.extrude": "e",
    // "delete": "x" // if key exists
};

export const SolidworksShortcuts: ShortcutMap = {
    ...DefaultShortcuts,
    "create.line": "l",
    // Often heavily mouse/gesture based or S-key menu
};

export const CreoShortcuts: ShortcutMap = {
    ...DefaultShortcuts,
};

export const ShortcutProfiles: Record<Navigation3DType, ShortcutMap> = {
    Chili3d: Chili3dShortcuts,
    Revit: RevitShortcuts,
    Blender: BlenderShortcuts,
    Creo: CreoShortcuts,
    Solidworks: SolidworksShortcuts,
};
