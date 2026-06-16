// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { type CommandKeys, I18n, type I18nKeys, PubSub } from "@chili3d/core";
import { div } from "@chili3d/element";
import style from "./contextMenu.module.css";

// A lightweight right-click menu. Entries are command keys (dispatched through the same
// "executeCommand" channel the hotkeys use) or the SEPARATOR marker for a divider.
export const SEPARATOR = "|";
export type ContextMenuEntry = CommandKeys | typeof SEPARATOR;

let current: HTMLElement | undefined;

const onPointerDown = (e: Event) => {
    if (current && !current.contains(e.target as Node)) closeContextMenu();
};
const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") closeContextMenu();
};

export function closeContextMenu() {
    if (!current) return;
    current.remove();
    current = undefined;
    window.removeEventListener("pointerdown", onPointerDown, true);
    window.removeEventListener("keydown", onKeyDown, true);
}

export function showContextMenu(x: number, y: number, entries: ContextMenuEntry[]) {
    closeContextMenu();

    const menu = div({ className: style.menu });
    for (const entry of entries) {
        if (entry === SEPARATOR) {
            menu.appendChild(div({ className: style.separator }));
            continue;
        }
        const key = entry;
        const item = div({
            className: style.item,
            textContent: I18n.translate(`command.${key}` as I18nKeys),
        });
        item.addEventListener("click", () => {
            closeContextMenu();
            PubSub.default.pub("executeCommand", key);
        });
        menu.appendChild(item);
    }

    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
    document.body.appendChild(menu);
    current = menu;

    // Keep the menu on-screen if it was opened near an edge.
    const rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth) menu.style.left = `${Math.max(0, x - rect.width)}px`;
    if (rect.bottom > window.innerHeight) menu.style.top = `${Math.max(0, y - rect.height)}px`;

    // Defer so the originating right-click doesn't immediately dismiss the menu.
    setTimeout(() => {
        window.addEventListener("pointerdown", onPointerDown, true);
        window.addEventListener("keydown", onKeyDown, true);
    }, 0);
}
