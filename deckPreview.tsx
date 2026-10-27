import { Box, Typography } from "@mui/material"
import i18next from "i18next"
import { RuleProperties } from "json-rules-engine"
import { Component, ItemView, Keymap, MarkdownView, Platform, setIcon, View, ViewStateResult } from "obsidian"
import React from "react"
import { createRoot, Root } from "react-dom/client"
import { useTranslation } from "react-i18next"

import { Arrangement, TAGNAME } from "arrangement"
import { getAppInstance } from "main"
import { MarkdownRenderComponent } from "markdown"
import { Pattern, prettyText } from "Pattern"
import { cardKeyScope, paneKeysActive, REVEAL_KEYS } from "keyboard"
import { cardClickActive, preventCardMultiClickSelection } from "cardClick"
import { VIEW_TYPE_REVIEW } from "view"
import { GlobalSettings } from "setting"

export const VIEW_TYPE_DECK_PREVIEW = "obsidanki-deck-preview"

const PAGE_SIZE = 20

type PreviewNavigationState = {
	route: "list" | "card"
	tagName: TAGNAME
	title: string
	rule: RuleProperties | null
	query: string
	page: number
	card: { path: string, tagId: string } | null
}

// Keep navigation in the active plugin pane; embedded decks never replace their source note.
export async function openDeckPreview(rule: RuleProperties | null, tagName: TAGNAME, title: string): Promise<void> {
	const app = getAppInstance()
	const active = app.workspace.getActiveViewOfType(View)?.leaf
	const activeType = active?.getViewState().type
	const leaf = active && (activeType === VIEW_TYPE_REVIEW || activeType === VIEW_TYPE_DECK_PREVIEW)
		? active
		: app.workspace.getLeavesOfType(VIEW_TYPE_REVIEW)[0] ??
			app.workspace.getLeavesOfType(VIEW_TYPE_DECK_PREVIEW)[0] ?? app.workspace.getLeaf('tab')
	await leaf.setViewState({
		type: VIEW_TYPE_DECK_PREVIEW,
		active: true,
		state: { route: "list", tagName, title, rule, query: "", page: 0, card: null },
	})
	await app.workspace.revealLeaf(leaf)
}

// Open the live pattern's definition, not the beginning of its #Q block.
export async function openPatternAt(snapshot: Pattern | undefined, arrangement: Arrangement | null): Promise<void> {
	if (!snapshot) {
		return
	}
	try {
		// Refresh offsets after note edits or insertion of %%OBSIDANKI/...%% ID comments.
		const pattern = (arrangement && await arrangement.findLivePattern(snapshot)) || snapshot
		const app = getAppInstance()
		// 优先复用已经打开、且没有钉住的 markdown 标签页；都没有才开新 tab
		let leaf = app.workspace.getLeavesOfType("markdown").find((l) => l.getViewState()?.pinned != true)
		if (!leaf) {
			leaf = app.workspace.getLeaf('tab')
		}
		await leaf.setViewState({
			type: 'markdown',
			active: true,
			state: { file: pattern.card.note.path, mode: 'source', source: true },
		})
		await app.workspace.revealLeaf(leaf)
		if (!(leaf.view instanceof MarkdownView)) {
			console.error("[Obsidanki] jump failed: leaf is not a MarkdownView")
			return
		}
		const view = leaf.view
		// Raw newline counting also keeps CRLF notes aligned with the editor.
		const source = await app.vault.cachedRead(pattern.card.note)
		let line = 0
		for (let offset = source.indexOf('\n'); offset >= 0 && offset < pattern.sourceOffset; offset = source.indexOf('\n', offset + 1)) {
			line++
		}
		const from = { line, ch: 0 }
		const to = { line, ch: view.editor.getLine(line).length }
		view.editor.focus()
		view.editor.setSelection(from, to)
		view.editor.scrollIntoView({ from, to }, true)
	} catch (error) {
		console.error("[Obsidanki] jump to card failed:", error)
	}
}

function renderSourceIcon(button: HTMLButtonElement | null): void {
	if (button) setIcon(button, 'external-link')
}

function renderLeftChevron(button: HTMLButtonElement | null): void {
	if (button) setIcon(button, 'chevron-left')
}

function renderRightChevron(button: HTMLButtonElement | null): void {
	if (button) setIcon(button, 'chevron-right')
}

function PreviewCard({ pattern, arrangement, index, view, onCard }: { pattern: Pattern, arrangement: Arrangement, index: number, view: Component, onCard: (pattern: Pattern) => void }) {
	const { t } = useTranslation()
	const frontId = React.useId()
	const sourceKeyDown = React.useRef(false)
	return (
		<Box
			className="obsidanki-preview-row"
			sx={{
				display: 'flex',
				alignItems: 'center',
				gap: 2,
				paddingX: 1,
				paddingY: 0.5,
				boxSizing: 'border-box',
			}}
		>
			<button
				type="button"
				className="obsidanki-preview-open"
				title={String(t('DeckPreviewCard'))}
				aria-labelledby={frontId}
				onClick={(event) => {
					if (event.detail > 0 && Keymap.isModifier(event.nativeEvent, GlobalSettings.SourceNavigationModifier)) {
						event.preventDefault()
						void openPatternAt(pattern, arrangement)
					} else {
						onCard(pattern)
					}
				}}
				onContextMenu={(event) => {
					// macOS delivers Control-click as a context-menu event, not a click.
					if (!Platform.isMacOS || GlobalSettings.SourceNavigationModifier !== "Ctrl" || !event.ctrlKey) return
					event.preventDefault()
					event.stopPropagation()
					void openPatternAt(pattern, arrangement)
				}}
				onKeyDown={(event) => {
					if (event.key !== " " || event.nativeEvent.isComposing ||
						(!sourceKeyDown.current && !Keymap.isModifier(event.nativeEvent, GlobalSettings.SourceNavigationModifier))) return
					event.preventDefault()
					event.stopPropagation()
					if (!event.repeat) sourceKeyDown.current = true
				}}
				onKeyUp={(event) => {
					if (event.key !== " " || !sourceKeyDown.current) return
					sourceKeyDown.current = false
					event.preventDefault()
					event.stopPropagation()
					// Match native Space activation: release before focusing the editor.
					void openPatternAt(pattern, arrangement)
				}}
				onBlur={() => { sourceKeyDown.current = false }}
			/>
			<Typography className="obsidanki-preview-index" variant="body2" sx={{ color: 'var(--text-muted)', flexShrink: 0 }}>
				{index}
			</Typography>
			<Box id={frontId} className="obsidanki-preview-text markdown-rendered" sx={{ flex: 1, minWidth: 0 }}>
				<MarkdownRenderComponent
					markdown={prettyText(pattern.FrontText)}
					sourcePath={pattern.card.note.path}
					component={view}
				/>
			</Box>
			<div className="obsidanki-preview-actions">
				<button
					ref={renderSourceIcon}
					className="obsidanki-button obsidanki-preview-action"
					title={String(t('DeckPreviewSource'))}
					aria-label={String(t('DeckPreviewSource'))}
					onClick={() => { void openPatternAt(pattern, arrangement) }}
				/>
			</div>
		</Box>
	)
}

function DeckPreview({ arrangement, state, view, onNavigate }: {
	arrangement: Arrangement
	state: PreviewNavigationState
	view: Component
	onNavigate: (state: PreviewNavigationState | null) => Promise<void>
}) {
	const { t } = useTranslation()
	const { tagName, page, query, card } = state
	const [showAnswer, setShowAnswer] = React.useState(false)
	const root = React.useRef<HTMLDivElement>(null)
	const previousCard = React.useRef<Pattern | null>(null)
	const patterns = React.useMemo(() => arrangement.patternsFor(tagName), [arrangement, tagName])
	// Normalize once per deck; changing pages never reparses card text.
	const searchText = React.useMemo(() => patterns.map(pattern =>
		`${prettyText(pattern.FrontText)}\n${prettyText(pattern.BackText)}`.toLowerCase()
	), [patterns])
	const term = query.trim().toLowerCase()
	const filtered = React.useMemo(() => term
		? patterns.filter((_, index) => searchText[index].includes(term))
		: patterns, [patterns, searchText, term])
	const openedIndex = state.route === "card" && card
		? filtered.findIndex(pattern => pattern.card.note.path === card.path && pattern.TagID === card.tagId)
		: -1
	const openedCard = filtered[openedIndex]
	const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
	const current = Math.min(page, pageCount - 1)
	const slice = filtered.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE)
	const resetScroll = () => root.current?.closest('.view-content')?.scrollTo({ top: 0 })
	const changePage = (nextPage: number) => {
		void onNavigate({ ...state, page: nextPage })
		resetScroll()
	}
	const closeCard = () => onNavigate({ ...state, route: "list", card: null })
	const nextCard = () => {
		if (!openedCard) return
		previousCard.current = openedCard
		const next = filtered[openedIndex + 1]
		setShowAnswer(false)
		if (next) {
			void onNavigate({ ...state, card: { path: next.card.note.path, tagId: next.TagID } })
		} else {
			void closeCard()
		}
	}
	React.useEffect(() => {
		setShowAnswer(false)
	}, [state.route, state.card?.path, state.card?.tagId])
	const revealOrNext = showAnswer ? nextCard : () => setShowAnswer(true)

	React.useEffect(() => {
		if (!(view instanceof ItemView)) return
		const keyWindow = root.current?.ownerDocument.defaultView
		if (!keyWindow) return
		const onKeyDown = (event: KeyboardEvent) => {
			if (!paneKeysActive(root.current, event)) return
			let action: (() => void) | undefined
			if (openedCard && REVEAL_KEYS.includes(event.key)) {
				action = revealOrNext
			} else if (event.key === 'q' || event.key === 'Escape') {
				action = () => {
					if (state.route === "card") void closeCard()
					else void onNavigate(null)
				}
			} else if (openedCard && event.key === 's') {
				action = nextCard
			} else if (openedCard && event.key === 'o') {
				action = () => { void openPatternAt(openedCard, arrangement) }
			} else if (openedCard && event.key === 'O' && previousCard.current) {
				const previous = previousCard.current
				action = () => { void openPatternAt(previous, arrangement) }
			}
			if (!action) return
			event.preventDefault()
			event.stopPropagation()
			if (!event.repeat) action()
		}
		const onKeyUp = (event: KeyboardEvent) => {
			if (openedCard && REVEAL_KEYS.includes(event.key) && paneKeysActive(root.current, event)) {
				event.preventDefault()
			}
		}
		keyWindow.addEventListener('keydown', onKeyDown, true)
		keyWindow.addEventListener('keyup', onKeyUp, true)
		return () => {
			keyWindow.removeEventListener('keydown', onKeyDown, true)
			keyWindow.removeEventListener('keyup', onKeyUp, true)
		}
	}, [openedCard, revealOrNext, nextCard, arrangement, state, view])

	if (openedCard) {
		return <div className="obsidanki-review obsidanki-preview-card" ref={root}>
			<div className="obsidanki-review-card markdown-rendered" onMouseDown={preventCardMultiClickSelection} onClick={(event) => {
				if (cardClickActive(event)) revealOrNext()
			}}>
				<openedCard.Component key={openedCard.TagID} view={view} showAns={showAnswer} />
			</div>
			<div className="obsidanki-review-bar">
				<div className="obsidanki-review-action">
					<button className="obsidanki-button obsidanki-review-button" aria-keyshortcuts="Space Enter" onClick={revealOrNext}>
						{t(showAnswer ? 'NextCard' : 'ShowAnswer')}
						<kbd className="obsidanki-review-key" aria-hidden="true">space</kbd>
					</button>
				</div>
			</div>
		</div>
	}

	return (
		<div className="obsidanki-preview-content" ref={root}>
			<div className="obsidanki-preview-toolbar">
				<input
					type="search"
					className="obsidanki-preview-search"
					aria-label={String(t('DeckPreviewSearch'))}
					placeholder={String(t('DeckPreviewSearch'))}
					value={query}
					onChange={(event) => {
						void onNavigate({ ...state, query: event.target.value, page: 0 })
						resetScroll()
					}}
				/>
				<div className="obsidanki-preview-controls">
					<Typography variant="body2" role="status" sx={{ color: 'var(--text-muted)' }}>
						{t('DeckPreviewSummary', {
							from: filtered.length ? current * PAGE_SIZE + 1 : 0,
							to: Math.min((current + 1) * PAGE_SIZE, filtered.length),
							total: filtered.length,
						})}
					</Typography>
					{filtered.length > 0 && <nav className="obsidanki-preview-pagination" aria-label={String(t('DeckPreviewPages'))}>
						<button
							ref={renderLeftChevron}
							className="obsidanki-button"
							aria-label={String(t('DeckPreviewPreviousPage'))}
							title={String(t('DeckPreviewPreviousPage'))}
							disabled={current === 0}
							onClick={() => changePage(current - 1)}
						/>
						<select
							className="obsidanki-preview-pages"
							aria-label={String(t('DeckPreviewChoosePage'))}
							title={String(t('DeckPreviewChoosePage'))}
							value={current}
							onChange={(event) => changePage(Number(event.target.value))}
						>
							{Array.from({ length: pageCount }, (_, index) => (
								<option key={index} value={index}>{t('DeckPreviewPage', { page: index + 1, pages: pageCount })}</option>
							))}
						</select>
						<button
							ref={renderRightChevron}
							className="obsidanki-button"
							aria-label={String(t('DeckPreviewNextPage'))}
							title={String(t('DeckPreviewNextPage'))}
							disabled={current === pageCount - 1}
							onClick={() => changePage(current + 1)}
						/>
					</nav>}
				</div>
			</div>
			{
				filtered.length == 0 &&
				<Typography variant="body2" sx={{ color: 'var(--text-muted)' }}>
					{term ? t('DeckPreviewNoResults') : t('DeckPreviewNoCards', { tag: String(tagName) })}
				</Typography>
			}
			{
				slice.map((pattern, i) => (
					<PreviewCard
						key={pattern.TagID}
						pattern={pattern}
						arrangement={arrangement}
						index={current * PAGE_SIZE + i + 1}
						view={view}
						onCard={() => {
							resetScroll()
							previousCard.current = null
							setShowAnswer(false)
							void onNavigate({ ...state, route: "card", card: { path: pattern.card.note.path, tagId: pattern.TagID } })
						}}
					/>
				))
			}
		</div>
	)
}

export class DeckPreviewView extends ItemView {
	navigation = true
	scope = cardKeyScope(this, ".obsidanki-preview")
	root: Root | null = null
	private arrangement: Arrangement | null = null
	private state: PreviewNavigationState = {
		route: "list", tagName: TAGNAME.ALLTAG, title: i18next.t('StartBrowse'),
		rule: null, query: "", page: 0, card: null,
	}
	private stateVersion = 0
	private scopeKey: string | null = null
	private pendingArrangement: Promise<Arrangement> | null = null

	getViewType(): string {
		return VIEW_TYPE_DECK_PREVIEW
	}
	getDisplayText(): string {
		return this.state.title
	}
	getState(): PreviewNavigationState {
		return { ...this.state }
	}
	async setState(state: Partial<PreviewNavigationState> | undefined, result: ViewStateResult): Promise<void> {
		// Older workspace layouts have only tagName/title/rule.
		const next: PreviewNavigationState = {
			route: state?.route === "card" && state.card ? "card" : "list",
			tagName: state?.tagName ?? TAGNAME.ALLTAG,
			title: state?.title ?? i18next.t('StartBrowse'),
			rule: state?.rule ?? null,
			query: state?.query ?? "",
			page: state?.page ?? 0,
			card: state?.card ?? null,
		}
		const scopeKey = JSON.stringify(next.rule)
		result.history = this.state.route !== next.route || this.state.tagName !== next.tagName ||
			this.state.title !== next.title || JSON.stringify(this.state.rule) !== scopeKey
		this.state = next
		// Obsidian creates the header before applying a restored or navigated scope.
		this.containerEl.querySelector('.view-header-title')?.setText(next.title)
		const version = ++this.stateVersion
		if (this.scopeKey !== scopeKey || !this.pendingArrangement) {
			this.scopeKey = scopeKey
			this.arrangement = null
			const arrangement = new Arrangement()
			this.pendingArrangement = arrangement.init(next.rule).then(() => arrangement)
		}
		const pending = this.pendingArrangement
		await super.setState(state, result)
		const arrangement = await pending
		if (version !== this.stateVersion) return
		this.arrangement = arrangement
		this.draw()
	}
	async onOpen(): Promise<void> {
		this.root = createRoot(this.contentEl.createDiv({ cls: "obsidanki-ui obsidanki-preview" }))
		this.draw()
	}
	private draw(): void {
		if (!this.arrangement) return
		const version = this.stateVersion
		this.root?.render(
			<DeckPreview arrangement={this.arrangement} state={this.state} view={this}
				onNavigate={(state) => {
					if (version !== this.stateVersion) return Promise.resolve()
					return this.leaf.setViewState(state
						? { type: VIEW_TYPE_DECK_PREVIEW, active: true, state }
						: { type: VIEW_TYPE_REVIEW, active: true, state: { route: "tree" } })
				}}
			/>
		)
	}
	async onClose(): Promise<void> {
		this.stateVersion++
		this.root?.unmount()
		this.root = null
	}
}
