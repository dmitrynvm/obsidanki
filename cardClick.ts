import type { MouseEvent } from "react"

// Embedded controls, modified clicks and text selection keep their native behavior.
export function cardClickActive(event: MouseEvent<HTMLElement>): boolean {
	if (event.defaultPrevented || event.button !== 0 ||
		event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) {
		return false
	}
	// Avoid instanceof: Obsidian can render cards in a popout window.
	const target = event.target as HTMLElement
	if (target.isContentEditable || target.closest(
		'a, button, input, textarea, select, label, summary, audio, video, [role="button"], [role="link"], [tabindex]'
	)) {
		return false
	}
	return event.currentTarget.ownerDocument.getSelection()?.isCollapsed !== false
}

export function preventCardMultiClickSelection(event: MouseEvent<HTMLElement>): void {
	// Rapid clicks act on cards instead of selecting words/paragraphs and blocking later clicks.
	// The first press still allows drag selection; existing selections and controls stay native.
	if (event.detail > 1 && cardClickActive(event)) {
		event.preventDefault()
	}
}
