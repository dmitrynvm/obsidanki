import {ObsidankiAPI} from 'api';
import {NewCardSearch} from 'cardSearch';
import {handlerDeckCode} from 'deck';
import {DeckBuilderModal} from 'deckBuilder';
import {initLanguage} from 'language';
import {App, EventRef, MarkdownView, Notice, Plugin, TFile, View, addIcon, debounce} from 'obsidian';
import {ClozeParser} from 'patternCloze';
import {MultiLineParser, SingleLineParser} from 'patternLine';
import {ObsidankiSettingTab, GlobalSettings, setGlobalSettings, ObsidankiSettings} from 'setting';
import {emojiTagPlugin} from 'tag';
import {ParserCollection} from "./ParserCollection";
import {ReviewView, VIEW_TYPE_REVIEW} from './view';
import {DeckPreviewView, VIEW_TYPE_DECK_PREVIEW} from 'deckPreview';
import {DatabaseHelper} from 'db';
import {t} from 'i18next';

let appInstance: App;
const DEBUG_ENABLED: boolean = false;

export function setAppInstance(app: App) {
	appInstance = app;
}

export function getAppInstance(): App {
	return appInstance;
}

export function log(logSupplier: () => unknown): void {
	if (DEBUG_ENABLED) {
		const logParts = logSupplier();
		if (Array.isArray(logParts)) {
			console.debug("[Obsidanki]", ...(logParts as unknown[]));
			return;
		} else {
			console.debug("[Obsidanki]", logParts);
		}
	}
}

export function logTrueExpr(logSupplier: () => unknown): boolean {
	log(logSupplier);
	return true;
}

class ObsidankiWriterHelper {
	cardCount: number = 0
	patternCount: number = 0
	filePath: string = ""
	event1: EventRef
	event2: EventRef
	checkDebounced = debounce((file: TFile, text: string) => {
		void this.check(file, text);
	}, 500, true);

	unregister() {
		getAppInstance().workspace.offref(this.event1)
		getAppInstance().workspace.offref(this.event2)
	}

	constructor() {
		this.event1 = getAppInstance().workspace.on("active-leaf-change", () => {
			let view = getAppInstance().workspace.getActiveViewOfType(MarkdownView)
			if (!view || !view.file) {
				return
			}
			this.checkDebounced(view.file, view.editor.getValue())
		})
		this.event2 = getAppInstance().workspace.on("editor-change", (editor, view) => {
			if (!view || !view.file) {
				return;
			}
			this.checkDebounced(view.file, editor.getValue())
		});
	}

	private async check(file: TFile, text: string) {
		let search = NewCardSearch()
		let result = await search.search(file, text)
		let newcardcount = result.AllCard.length
		let newpatterncount = 0
		result.AllCard.forEach(element => {
			newpatterncount += element.patterns.length
		});

		if (file.path == this.filePath) {
			if (newcardcount !== this.cardCount) {
				let change = newcardcount - this.cardCount;
				let symbol = change > 0 ? "+" : "-";
				new Notice(`Card ${symbol}${Math.abs(change)}`);
			}
			if (newpatterncount !== this.patternCount) {
				let change = newpatterncount - this.patternCount;
				let symbol = change > 0 ? "+" : "-";
				new Notice(`Pattern ${symbol}${Math.abs(change)}`);
			}
		}
		this.cardCount = newcardcount
		this.patternCount = newpatterncount
		this.filePath = file.path
	}
}

export default class ObsidankiPlugin extends Plugin {
	public api: ObsidankiAPI
	writerHelper: ObsidankiWriterHelper

	async openView() {
		const active = this.app.workspace.getActiveViewOfType(View)?.leaf
		const activeType = active?.getViewState().type
		const leaf = active && (activeType === VIEW_TYPE_REVIEW || activeType === VIEW_TYPE_DECK_PREVIEW)
			? active
			: this.app.workspace.getLeavesOfType(VIEW_TYPE_REVIEW)[0] ??
				this.app.workspace.getLeavesOfType(VIEW_TYPE_DECK_PREVIEW)[0] ??
				(active && activeType === 'empty' ? active : this.app.workspace.getLeaf('tab'))
		await leaf.setViewState({
			type: VIEW_TYPE_REVIEW,
			active: true,
			state: { route: "tree" },
		})
		await this.app.workspace.revealLeaf(leaf)
	}

	async refreshTreeViews(): Promise<void> {
		for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_REVIEW)) {
			const state = leaf.getViewState()
			if (state.state?.route !== "study") {
				await leaf.setViewState({ type: VIEW_TYPE_REVIEW, state: state.state })
			}
		}
	}

	async onload() {
		setAppInstance(this.app)
		this.registerEditorExtension(emojiTagPlugin)
		await this.loadSettings();
		await DatabaseHelper.getInstance().ready
		initLanguage()
		this.registerView(VIEW_TYPE_REVIEW, (leaf) => new ReviewView(leaf, async (nodes) => {
			GlobalSettings.CollapsedTreeNodes = nodes
			await this.saveSettings()
		}));
		this.registerView(VIEW_TYPE_DECK_PREVIEW, (leaf) => new DeckPreviewView(leaf));
		addIcon("flashcards", `
		<path d="M 6.56 26.72 L 44.504 9.026 C 47.786 7.496 51.688 8.916 53.218 12.198 L 58.634 23.812 L 87.211 23.812 C 90.832 23.812 93.768 26.748 93.768 30.369 L 93.768 85.564 C 93.768 89.185 90.832 92.121 87.211 92.121 L 45.344 92.121 C 42.213 92.121 39.594 89.926 38.943 86.991 L 35.429 88.629 C 32.147 90.159 28.245 88.739 26.715 85.457 L 3.388 35.434 C 1.858 32.152 3.278 28.25 6.56 26.72 Z M 49.168 14.22 C 48.491 12.768 46.766 12.14 45.314 12.817 L 8.944 29.777 C 7.492 30.454 6.865 32.179 7.542 33.631 L 30.766 83.436 C 31.443 84.888 33.168 85.516 34.62 84.838 L 38.787 82.895 L 38.787 30.369 C 38.787 26.748 41.723 23.812 45.344 23.812 L 53.641 23.812 L 49.168 14.22 Z M 43.313 30.49 L 43.313 85.444 C 43.313 87.046 44.611 88.344 46.213 88.344 L 86.343 88.344 C 87.945 88.344 89.243 87.046 89.243 85.444 L 89.243 30.49 C 89.243 28.888 87.945 27.59 86.343 27.59 L 46.213 27.59 C 44.611 27.59 43.313 28.888 43.313 30.49 Z" fill="currentColor" stroke="currentColor"/>
	    `
		)
		this.addRibbonIcon('flashcards', 'Obsidanki', async () => {
			await this.openView()
		});
		this.addCommand({
			id: 'open-decks',
			name: t('OpenDecks'),
			callback: () => {
				void this.openView()
			}
		})
		this.addCommand({
			id: 'open-deck-builder',
			name: t('OpenDeckBuilder'),
			callback: () => {
				new DeckBuilderModal(this.app).open()
			}
		})
		this.addSettingTab(new ObsidankiSettingTab(this.app, this));
		this.registerObsidankiParser()
		this.api = new ObsidankiAPI
		this.writerHelper = new ObsidankiWriterHelper()
		this.registerMarkdownCodeBlockProcessor("obsidanki-deck-config", handlerDeckCode)
		if (DEBUG_ENABLED) {
			new Notice('Obsidanki loaded in debug mode')
		}
	}

	registerObsidankiParser() {
		const parserCol = ParserCollection.getInstance();
		parserCol.registerParser(new SingleLineParser());
		parserCol.registerParser(new MultiLineParser());
		parserCol.registerParser(new ClozeParser())
	}

	onunload() {
		const parserCol = ParserCollection.getInstance();
		parserCol.clean()
		this.writerHelper.unregister()
	}

	async loadSettings() {
		setGlobalSettings(await this.loadData() as Partial<ObsidankiSettings> | null)
	}

	async saveSettings() {
		await this.saveData(GlobalSettings);
	}

}
