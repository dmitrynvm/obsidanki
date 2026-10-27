import { ItemView, Scope } from "obsidian"

export const REVEAL_KEYS = [" ", "Enter"]

function isNativeKeyTarget(target: EventTarget | null): boolean {
	// Avoid realm-specific instanceof checks: views can live in popout windows.
	if (!target || !("tagName" in target)) {
		return false
	}
	const element = target as HTMLElement
	// Escape may already have detached its dialog before our listener runs.
	return element.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(element.tagName) ||
		!!element.closest(".modal-container")
}

// Only the active pane listens; typing, dialogs and modified keys retain their native behavior.
export function paneKeysActive(root: HTMLElement | null, e: KeyboardEvent): boolean {
	if (!root || e.ctrlKey || e.metaKey || e.altKey || e.isComposing || isNativeKeyTarget(e.target)) {
		return false
	}
	return !!root.closest(".workspace-leaf.mod-active") && !root.ownerDocument.querySelector(".modal-container")
}

export function cardKeyScope(view: ItemView, selector = ".obsidanki-review-card"): Scope {
	const scope = new Scope(view.app.scope)
	// Obsidian handles Escape before DOM listeners and otherwise focuses the last note.
	scope.register([], "Escape", (event) => {
		if (view.containerEl.querySelector(selector) && paneKeysActive(view.containerEl, event)) {
			return false
		}
	})
	return scope
}
