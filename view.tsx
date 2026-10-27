import HourglassBottomIcon from '@mui/icons-material/HourglassBottom';
import { Pattern } from "Pattern";
import { Arrangement, PatternIter, TAGNAME } from 'arrangement';
import { IDComment } from 'cardHead';
import i18n from 'i18next';
import { RuleProperties } from 'json-rules-engine';
import { log, getAppInstance } from 'main';
import { Component, EditorPosition, ItemView, MarkdownRenderChild, MarkdownView, Notice, TFile, ViewStateResult, WorkspaceLeaf } from 'obsidian';
import { openDeckPreview } from 'deckPreview';
import { DeckTreeMenu } from 'deckTreeMenu';
import * as React from "react";
import { Root, createRoot } from "react-dom/client";
import { I18nextProvider, Trans } from 'react-i18next';
import { LearnEnum, LearnOpt, Moment, ReviewEnum, ReviewOpt } from "schedule";
import { cardKeyScope, paneKeysActive, REVEAL_KEYS } from "keyboard";
import { cardClickActive, preventCardMultiClickSelection } from "cardClick";

export const VIEW_TYPE_REVIEW = "obsidanki-review-view"

type ReviewingProps = {
	arrangement: Arrangement
	goStage: (stage: ReviewStage, history?: boolean) => void
	view: Component
	arrangeName: TAGNAME
	isActive: () => boolean
}

type ReviewingState = {
	nowPattern: Pattern | undefined
	showAns: boolean
	learn: boolean
	patternIter: AsyncGenerator<PatternIter, boolean, unknown>
}

// One row of the answer bar, left to right. Keys follow vim order (h j k l) and Anki's 1-4.
type Grade = {
	label: string
	keys: string[]
	review: ReviewEnum
	learn: LearnEnum
}

const GRADES: Grade[] = [
	{ label: "GradeAgain", keys: ["h", "1"], review: ReviewEnum.FORGET, learn: LearnEnum.FORGET },
	{ label: "GradeHard", keys: ["j", "2"], review: ReviewEnum.HARD, learn: LearnEnum.HARD },
	{ label: "GradeGood", keys: ["k", "3", " ", "Enter"], review: ReviewEnum.FAIR, learn: LearnEnum.FAIR },
	{ label: "GradeEasy", keys: ["l", "4"], review: ReviewEnum.EASY, learn: LearnEnum.EASY },
]

// Anki-style compact interval: <1m, 45m, 3h, 2d, 1.7mo, 4.5y
export function formatInterval(next: Moment, now: Moment = window.moment()): string {
	const seconds = Math.max(0, next.diff(now, "seconds"))
	if (seconds < 60) {
		return "<1m"
	}
	const minutes = Math.round(seconds / 60)
	if (minutes < 60) {
		return `${minutes}m`
	}
	const hours = Math.round(seconds / 3600)
	if (hours < 24) {
		return `${hours}h`
	}
	const days = Math.round(seconds / 86400)
	if (days < 30) {
		return `${days}d`
	}
	if (days < 365) {
		return `${Math.round(days / 3) / 10}mo`
	}
	return `${Math.round(days / 36.5) / 10}y`
}


class Reviewing extends React.Component<ReviewingProps, ReviewingState> {
	initFlag: boolean
	busy = false
	lastPattern: Pattern | undefined
	mounted = false
	rootRef = React.createRef<HTMLDivElement>()
	keyWindow: Window | null = null
	openUnpinnedFile = async (note: TFile) => {
		let leaf: WorkspaceLeaf | undefined
		if (this.props.view instanceof MarkdownRenderChild) {
			leaf = getAppInstance().workspace.getLeaf(true)
		} else {
			leaf = getAppInstance().workspace.getLeavesOfType("markdown").at(0)
			if (!leaf || leaf.getViewState()?.pinned == true) {
				leaf = getAppInstance().workspace.getLeaf(true)
			}
		}
		await leaf.openFile(note)
		return leaf
	}
	openPatternFile = async (pattern: Pattern | undefined) => {
		if (!pattern) {
			return
		}
		// Refresh offsets after a card ID was inserted or the source note was edited.
		pattern = await this.props.arrangement.findLivePattern(pattern) ?? pattern
		// 打开文件
		let leaf = await this.openUnpinnedFile(pattern.card.note)
		if (!(leaf.view instanceof MarkdownView)) {
			return
		}
		let view = leaf.view
		// Locate the current note ID; untagged patterns retain their exact source offset.
		let noteText = view.data
		let idText = IDComment(pattern.TagID)
		let index = noteText.indexOf(idText)
		let length = idText.length
		if (index < 0) {
			index = pattern.sourceOffset
			length = 0
		}
		// 换算位置
		let tagpos = view.editor.offsetToPos(index)
		let tagposEnd: EditorPosition = {
			line: tagpos.line,
			ch: tagpos.ch + length
		}
		// 滚动
		if (view.getMode() == "preview") {
			view.currentMode.applyScroll(tagpos.line)
		} else {
			view.editor.setSelection(tagpos, tagposEnd)
			view.editor.scrollIntoView({ from: tagpos, to: tagposEnd }, true)
			view.editor.setSelection(tagpos, tagposEnd)
			view.editor.scrollIntoView({ from: tagpos, to: tagposEnd }, true)

			// 避免某些情况仍然没有正确定位
			window.setTimeout(function () {
				view.editor.setSelection(tagpos, tagposEnd)
				view.editor.scrollIntoView({ from: tagpos, to: tagposEnd }, true)
			}, 800)
		}
	}
	constructor(props: ReviewingProps) {
		super(props)
		this.state = {
			nowPattern: undefined,
			showAns: false,
			learn: false,
			patternIter: this.props.arrangement.PatternSequence(this.props.arrangeName),
		}
		this.initFlag = false
	}
	componentDidMount() {
		this.mounted = true
		// Embedded decks stay mouse-only; pane keys follow the hosting window.
		if (!(this.props.view instanceof MarkdownRenderChild)) {
			this.keyWindow = this.rootRef.current?.ownerDocument.defaultView ?? window
			this.keyWindow.addEventListener("keydown", this.onKeyDown, true)
			this.keyWindow.addEventListener("keyup", this.onKeyUp, true)
		}
		if (!this.initFlag) {
			this.initFlag = true
			void this.next()
		}
	}
	componentWillUnmount() {
		this.mounted = false
		this.keyWindow?.removeEventListener("keydown", this.onKeyDown, true)
		this.keyWindow?.removeEventListener("keyup", this.onKeyUp, true)
	}
	onKeyDown = (e: KeyboardEvent) => {
		if (!paneKeysActive(this.rootRef.current, e)) {
			return
		}
		const action = this.keyAction(e.key)
		if (!action) {
			return
		}
		e.preventDefault()
		e.stopPropagation()
		if (e.repeat) {
			return
		}
		action()
	}
	// A focused button would otherwise fire a second click on space/enter keyup
	onKeyUp = (e: KeyboardEvent) => {
		if (REVEAL_KEYS.includes(e.key) && paneKeysActive(this.rootRef.current, e)) {
			e.preventDefault()
		}
	}
	onCardClick = (event: React.MouseEvent<HTMLDivElement>) => {
		if (!this.busy && cardClickActive(event)) {
			const key = this.state.showAns && this.canGrade ? "l" : " "
			this.keyAction(key)?.()
		}
	}
	keyAction(key: string): (() => void) | null {
		switch (key) {
			case "q": case "Escape": return () => this.props.goStage(ReviewStage.Loading)
			case "s": return this.skip
			case "o": return () => { void this.openPatternFile(this.state.nowPattern) }
			case "O": return () => { void this.openPatternFile(this.lastPattern) }
		}
		if (!this.state.nowPattern) {
			return null
		}
		if (!this.state.showAns) {
			return REVEAL_KEYS.includes(key) ? () => this.setState({ showAns: true }) : null
		}
		if (!this.canGrade) {
			return REVEAL_KEYS.includes(key) ? this.skip : null
		}
		const grade = GRADES.find((g) => g.keys.includes(key))
		return grade ? () => this.grade(grade) : null
	}
	// Upstream never grades the hard-cards list; it is browse-only
	get canGrade(): boolean {
		return this.props.arrangeName !== TAGNAME.HARDTAG
	}
	// Serializes clicks and keys so one card is never graded twice
	async run(task: () => Promise<void>) {
		if (this.busy || !this.mounted || !this.props.isActive()) {
			return
		}
		this.busy = true
		try {
			await task()
		} catch (error) {
			// The grade, if any, is already saved; only showing the next card failed.
			console.error(error)
			new Notice(String(i18n.t('ReviewLoadFailed', { error: error instanceof Error ? error.message : String(error) })))
		} finally {
			this.busy = false
		}
		const active = this.rootRef.current?.ownerDocument.activeElement
		if (active instanceof HTMLElement && this.rootRef.current?.contains(active)) {
			active.blur()
		}
	}
	skip = () => {
		void this.run(this.next)
	}
	grade = (grade: Grade) => {
		const pattern = this.state.nowPattern
		if (!pattern || !this.state.showAns || !this.canGrade) {
			return
		}
		const opt = this.state.learn ? new LearnOpt(grade.learn) : new ReviewOpt(grade.review)
		void this.run(async () => {
			try {
				await pattern.SubmitOpt(opt)
			} catch (error) {
				// The card stays on screen; SubmitOpt restored its schedule, so grading again is safe.
				console.error(error)
				new Notice(String(i18n.t('ReviewSaveFailed', { error: error instanceof Error ? error.message : String(error) })))
				return
			}
			await this.next()
		})
	}
	next = async () => {
		if (!this.mounted || !this.props.isActive()) return
		this.lastPattern = this.state.nowPattern
		let result = await this.state.patternIter.next()
		if (!this.mounted || !this.props.isActive()) return
		if (result.done) {
			this.props.goStage(ReviewStage.Loading, false)
			return
		}
		let patternIter : PatternIter = result.value;
		let nextPattern : Pattern = patternIter.pattern;
		await nextPattern.InitObsidankiID();
		if (!this.mounted || !this.props.isActive()) return
		log(() => `Displaying id: ${nextPattern.TagID} 
		at file: ${nextPattern.card.note.path} 
		at index: ${patternIter.index} 
		pattern: ${nextPattern.FrontText}`);
		// Keep the grading lock until the next card is committed, not just queued for rendering.
		await new Promise<void>((resolve) => {
			this.setState({
				nowPattern: nextPattern,
				showAns: false,
				learn: patternIter.learn,
			}, resolve)
		})
	}
	PatternComponent = () => {
		if (this.state.nowPattern) {
			return <this.state.nowPattern.Component view={this.props.view} showAns={this.state.showAns}></this.state.nowPattern.Component>
		}
		return <div></div>
	}
	// Next-review interval for review-mode cards, learning progress for learn-mode cards
	gradeHint(grade: Grade): string {
		const schedule = this.state.nowPattern?.schedule
		if (!schedule) {
			return ""
		}
		if (this.state.learn) {
			return `${(schedule.CalcLearnRate(grade.learn) * 100).toFixed(0)}%`
		}
		return formatInterval(schedule.CalcNextTime(grade.review))
	}
	renderBar() {
		if (!this.state.nowPattern) {
			return null
		}
		if (!this.state.showAns || !this.canGrade) {
			const label = this.state.showAns ? "NextCard" : "ShowAnswer"
			const onClick = this.state.showAns ? this.skip : () => this.setState({ showAns: true })
			return <div className="obsidanki-review-action">
				<span className="obsidanki-review-hint" aria-hidden="true"></span>
				<button className="obsidanki-button obsidanki-review-button" aria-keyshortcuts="Space Enter" onClick={onClick}>
					<Trans i18nKey={label} />
					<kbd className="obsidanki-review-key" aria-hidden="true">space</kbd>
				</button>
			</div>
		}
		return GRADES.map((grade) => {
			const shortcuts = grade.keys.filter((k) => k.length === 1 && k !== " ")
			return <div className="obsidanki-review-action" key={grade.label}>
				<span className="obsidanki-review-hint">{this.gradeHint(grade)}</span>
				<button className="obsidanki-button obsidanki-review-button" title={shortcuts.join(" · ")} aria-keyshortcuts={shortcuts.join(" ")} onClick={() => this.grade(grade)}>
					<Trans i18nKey={grade.label} />
					<kbd className="obsidanki-review-key" aria-hidden="true">{shortcuts[0]}</kbd>
				</button>
			</div>
		})
	}
	render() {
		return <div className="obsidanki-ui obsidanki-review" ref={this.rootRef}>
			<div className="obsidanki-review-card markdown-rendered" onMouseDown={preventCardMultiClickSelection} onClick={this.onCardClick}>
				<this.PatternComponent></this.PatternComponent>
			</div>
			<div className="obsidanki-review-bar">
				{this.renderBar()}
			</div>
		</div>
	}
}


class LoadingComponent extends React.Component {
	render() {
		return <HourglassBottomIcon />
	}
}

// Embedded rule decks stay mouse-only; the main pane owns the keyboard tree.
function EmbeddedMenu({ arrangement, onStudy }: {
	arrangement: Arrangement
	onStudy: (rule: RuleProperties | null) => Promise<void>
}) {
	const study = arrangement.studyItem()
	const total = arrangement.patternsFor(TAGNAME.ALLTAG).length
	const next = arrangement.nextDue()
	const stats = arrangement.stats()
	return <div className="obsidanki-ui obsidanki-start">
		{study ? <div className="obsidanki-start-row is-primary">
			<button className="obsidanki-start-go" onClick={() => { void onStudy(arrangement.rule) }}>
				<span className="obsidanki-start-label">{study.Display}</span>
			</button>
			<button className="obsidanki-start-count" title={`${i18n.t("DeckPreviewTab")}: ${study.Display}`} aria-label={`${i18n.t("DeckPreviewTab")}: ${study.Display} (${study.Count})`} onClick={() => { void openDeckPreview(arrangement.rule, TAGNAME.STUDY, study.Display) }}>{study.Count}</button>
		</div> : <div className="obsidanki-start-status">
			{i18n.t(total > 0 ? "StartCaughtUp" : "StartNoCards")}
			{total > 0 && next && <span className="obsidanki-start-next">{i18n.t("StartNextDue", { interval: formatInterval(next) })}</span>}
		</div>}
		{(stats.ReviewCount > 0 || stats.NewCount > 0 || stats.LearnCount > 0) &&
			<div className="obsidanki-start-today">{i18n.t("StartToday", { review: stats.ReviewCount, new: stats.NewCount, learn: stats.LearnCount })}</div>}
		{total > 0 && <div className="obsidanki-start-decks">
			<div className="obsidanki-start-row">
				<button className="obsidanki-start-go" onClick={() => { void openDeckPreview(arrangement.rule, TAGNAME.ALLTAG, i18n.t("StartBrowse")) }}>
					<span className="obsidanki-start-label">{i18n.t("StartBrowse")}</span>
				</button>
				<button className="obsidanki-start-count" title={`${i18n.t("DeckPreviewTab")}: ${i18n.t("StartBrowse")}`} aria-label={`${i18n.t("DeckPreviewTab")}: ${i18n.t("StartBrowse")} (${total})`} onClick={() => { void openDeckPreview(arrangement.rule, TAGNAME.ALLTAG, i18n.t("StartBrowse")) }}>{total}</button>
			</div>
		</div>}
	</div>
}

// interface DeckSettingProps {

// }

// interface DeckSettingStates {
// 	deckName: string
// 	pathRegex: string
// 	unfold: boolean
// 	matchType: DeckMatchType
// }

// class CustomPaperComponent extends React.Component<DeckSettingProps, DeckSettingStates> {
// 	constructor(props: DeckSettingProps | Readonly<DeckSettingProps>) {
// 		super(props);
// 		this.state = {
// 			deckName: '',
// 			pathRegex: '',
// 			matchType: DeckMatchType.PATHREGEX,
// 			unfold: false,
// 		};
// 	}

// 	handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
// 		if (event.target.name == "deckName") {
// 			this.setState({
// 				deckName: event.target.value
// 			})
// 		}
// 		if (event.target.name == "pathRegex") {
// 			this.setState({
// 				pathRegex: event.target.value
// 			})
// 		}
// 		if (event.target.name == "matchType") {
// 			let type: DeckMatchType = DeckMatchType[event.target.value as keyof typeof DeckMatchType];
// 			this.setState({
// 				matchType: type
// 			})
// 		}
// 	}

// 	submit = (event: FormEvent) => {
// 		event.preventDefault();
// 	}

// 	render() {
// 		if (!this.state.unfold) {
// 			return <Button onClick={() => {
// 				this.setState({
// 					unfold: true
// 				})
// 			}} ><AddIcon /></Button>
// 		}
// 		return (
// 			<Paper sx={{ color: 'var(--text-normal)', bgcolor: 'var(--background-primary)', margin: 2 }}>
// 				<form onSubmit={this.submit}>
// 					<Box p={2} sx={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
// 						<Typography><Trans i18nKey="DeckName" />:</Typography>
// 						<TextField required name="deckName" value={this.state.deckName} onChange={this.handleInputChange} />

// 						<Typography><Trans i18nKey="MatchType" />:</Typography>
// 						<Select
// 							required
// 							defaultValue={DeckMatchType.PATHREGEX}
// 							name="matchType"
// 							value={this.state.matchType}
// 							onChange={this.handleInputChange}>
// 							<MenuItem value={DeckMatchType.PATHREGEX}><Trans i18nKey="PathRegex" /></MenuItem>
// 						</Select>
// 						<TextField required name="pathRegex" value={this.state.pathRegex} onChange={this.handleInputChange} />

// 					</Box>

// 					<Box p={2} sx={{ gap: '10px', margin: 2, display: 'flex', flexDirection: 'row' }}>
// 						<Button onClick={() => {
// 							this.setState({
// 								unfold: false
// 							})
// 						}}><Trans i18nKey="Cancel" /></Button>
// 						<Button type='submit'><Trans i18nKey="OK" /></Button>
// 					</Box>
// 				</form>
// 			</Paper>
// 		);
// 	}
// }

type ReviewProps = {
	view: ReviewView | MarkdownRenderChild
	rule: RuleProperties | null
	route?: ReviewNavigationState["route"]
	onStudy?: (rule: RuleProperties | null) => Promise<void>
	onMenu?: (history: boolean) => Promise<void>
	isCurrent?: () => boolean
}

enum ReviewStage {
	Loading,
	Maindesk,
	Reviewing,
}

type ReviewState = {
	stage: ReviewStage
	arrangement: Arrangement
}

class ReviewComponent extends React.Component<ReviewProps, ReviewState> {
	private mounted = false
	private loadVersion = 0
	isActive = () => this.mounted && (this.props.isCurrent?.() ?? true)
	async sync(rule: RuleProperties | null = this.props.rule, stage = ReviewStage.Maindesk) {
		const version = ++this.loadVersion
		const arrangement = new Arrangement()
		await arrangement.init(rule)
		if (this.isActive() && version === this.loadVersion) {
			this.setState({ arrangement, stage })
		}
	}
	componentDidMount() {
		this.mounted = true
		void this.sync(this.props.rule, this.props.route === "study" ? ReviewStage.Reviewing : ReviewStage.Maindesk)
	}
	componentWillUnmount() {
		this.mounted = false
		this.loadVersion++
	}
	constructor(props: ReviewProps) {
		super(props)
		this.state = {
			stage: ReviewStage.Loading,
			arrangement: new Arrangement(),
		}
	}
	goStage = (stage: ReviewStage, history = true) => {
		if (!this.isActive()) return
		if (stage === ReviewStage.Loading && this.props.onMenu) {
			void this.props.onMenu(history)
			return
		}
		this.setState({ stage })
		if (stage === ReviewStage.Loading) void this.sync()
	}
	startDeck = async (rule: RuleProperties | null) => {
		if (!this.isActive()) return
		if (this.props.onStudy) {
			await this.props.onStudy(rule)
			return
		}
		this.setState({ stage: ReviewStage.Loading })
		await this.sync(rule, ReviewStage.Reviewing)
	}
	render(): React.ReactNode {
		// The review screen owns the whole pane; the deck list keeps the reading-view layout
		if (this.state.stage == ReviewStage.Reviewing) {
			return <Reviewing
				arrangeName={TAGNAME.STUDY}
				arrangement={this.state.arrangement}
				goStage={this.goStage}
				view={this.props.view}
				isActive={this.isActive}
			></Reviewing>
		}
		return <div className="markdown-preview-view markdown-rendered is-readable-line-width allow-fold-headings">
			<div className="markdown-preview-sizer markdown-preview-section" style={{ paddingBottom: `${window.innerHeight / 2}px` }}>
				{
					this.state.stage == ReviewStage.Loading
						? <LoadingComponent></LoadingComponent>
						: this.props.view instanceof MarkdownRenderChild
							? <EmbeddedMenu arrangement={this.state.arrangement} onStudy={this.startDeck} />
							: <DeckTreeMenu arrangement={this.state.arrangement} onStudy={this.startDeck} onCollapsedChange={this.props.view.saveTreeState} />
				}
			</div>
		</div>
	}
}



export function App(props: ReviewProps) {
	return (
		<I18nextProvider i18n={i18n}>
			<ReviewComponent {...props} />
		</I18nextProvider>
	);
}

type ReviewNavigationState = {
	route: "tree" | "study"
	rule: RuleProperties | null
}

// Automatic study exhaustion replaces the current route instead of adding history.
// This input-only flag is deliberately absent from getState() snapshots.
type ReviewNavigationInput = Partial<ReviewNavigationState> & { history?: boolean }

export class ReviewView extends ItemView {
	navigation = true
	scope = cardKeyScope(this)
	root: Root | null = null
	private state: ReviewNavigationState = { route: "tree", rule: null }
	private stateVersion = 0

	constructor(leaf: WorkspaceLeaf, readonly saveTreeState: (nodes: string[]) => Promise<void>) {
		super(leaf)
	}

	getViewType(): string {
		return VIEW_TYPE_REVIEW
	}
	getDisplayText(): string {
		return "Obsidanki"
	}
	getState(): ReviewNavigationState {
		return { ...this.state }
	}
	async setState(state: ReviewNavigationInput | undefined, result: ViewStateResult): Promise<void> {
		const next: ReviewNavigationState = state?.route === "study"
			? { route: "study", rule: state.rule ?? null }
			: { route: "tree", rule: null }
		result.history = state?.history !== false && (this.state.route !== next.route ||
			JSON.stringify(this.state.rule) !== JSON.stringify(next.rule))
		this.state = next
		const version = ++this.stateVersion
		await super.setState(next, result)
		if (version === this.stateVersion) this.draw()
	}
	async onOpen(): Promise<void> {
		this.root = createRoot(this.contentEl.createDiv({ cls: "obsidanki-root" }))
		this.draw()
	}
	private draw(): void {
		const version = this.stateVersion
		this.root?.render(
			<App key={version} view={this} rule={this.state.rule} route={this.state.route}
				isCurrent={() => version === this.stateVersion}
				onStudy={(rule) => this.leaf.setViewState({
					type: VIEW_TYPE_REVIEW, active: true, state: { route: "study", rule },
				})}
				onMenu={(history) => this.leaf.setViewState({
					type: VIEW_TYPE_REVIEW, active: true, state: { route: "tree", history },
				})}
			/>
		)
	}
	async onClose(): Promise<void> {
		this.stateVersion++
		this.root?.unmount()
		this.root = null
	}
}
