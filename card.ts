import { UpdateCardIDTag } from 'cardHead';
import { CachedMetadata, TFile } from 'obsidian';
import { CardSchedule, PatternSchedule } from 'schedule';
import { ParserCollection, PatternParser } from './ParserCollection';
import { Pattern } from './Pattern';
import { cyrb53 } from './hash';
import { DatabaseHelper } from 'db';
import { getAppInstance } from 'main';
import { GlobalSettings } from "./setting";

// A card parses note content and keeps its schedules in the database.
export interface Card {
	// 获取卡片所属文件
	get note(): TFile
	// 获取卡片ID
	get ID(): string
	// 获取卡片原始字符串
	get cardText(): string
	// 获取源码
	get bodyList(): string[]
	get bodyOffsets(): number[]
	// 获取卡片模式
	get patterns(): Pattern[]
	// 获取卡片偏移量
	get indexBuff(): number
	get tags(): string[]
	get fileCache(): CachedMetadata | null
	// 获取调度
	getSchedule(patternID: string): PatternSchedule
	getSchedules(): CardSchedule
	// 更新文件
	updateFile(info: updateInfo): void
	// 提交文件变更
	commitFile(commitType: commitType): Promise<void>
}

interface commitType {
	schedules?: boolean
	ID?: boolean
}

export function NewCard(cardText: string, content: string, cardID: string, index: number, note: TFile, cache: CachedMetadata | null, parser: PatternParser = ParserCollection.getInstance()): Card {
	return new defaultCard(cardText, content, cardID, index, note, cache, parser)
}

// 更新原文
class updateInfo {
	updateFunc: (content: string) => string
}

function extractStrings(inputText: string): string[] {
	const regex = /#[\/\w]+/gm;
	return inputText.match(regex) || [];
}

export function findOutline(cache: CachedMetadata | null, offset: number): string {
	if (!cache) {
		return ""
	}
	if (!cache.headings || cache.headings.length == 0) {
		return ""
	}
	// Find the position of the heading in the array.
	let position = -1
	for (let i = 0; i < cache.headings.length; i++) {
		if (cache.headings[i].position.start.offset <= offset) {
			position = i
		} else {
			break
		}
	}
	if (position == -1) {
		return ""
	}
	let currentOutline: string[] = []
	let currentLevel = cache.headings[position].level
	// Add the current heading to the outline.
	currentOutline.push(cache.headings[position].heading)
	// Iterate backwards through the headings.
	for (let i = position - 1; i >= 0; i--) {
		let heading = cache.headings[i]

		// If the level is less than the current level, add it to the outline.
		if (heading.level < currentLevel) {
			currentOutline.unshift(heading.heading)
			currentLevel = heading.level
		}

		// If we have reached the top level, stop searching.
		if (currentLevel === 1) {
			break
		}
	}

	return currentOutline.join(" > ")
}

// 默认卡片的实现
class defaultCard implements Card {
	bodyList: string[]
	bodyOffsets: number[]
	note: TFile
	originalID: string = ""
	patterns: Pattern[];
	schedules: CardSchedule
	indexBuff: number
	updateList: updateInfo[];
	cardText: string
	content: string
	tags: string[];
	static bodySplitReg = /\n\*{3,}\n/;
	static bodySplitRegWithSpaces = /\n(?:\*{3,}\s*|\s*)\n/;
	idGenFlag: boolean = false
	fileCache: CachedMetadata | null
	outline: string

	constructor(cardText: string, content: string, cardID: string, index: number, note: TFile, cache: CachedMetadata | null, parser: PatternParser) {
		let tags = extractStrings(cardText)
		this.tags = tags
		this.fileCache = cache
		this.updateList = []
		this.indexBuff = index
		this.cardText = cardText || ""
		this.bodyList = []
		this.content = content
		this.bodyList = content.split(
			GlobalSettings.UseNewLineAsSplitter
				? defaultCard.bodySplitRegWithSpaces
				: defaultCard.bodySplitReg
		);
		let cursor = 0
		const contentOffset = index + cardText.length - content.length
		this.bodyOffsets = this.bodyList.map(body => {
			const start = content.indexOf(body, cursor)
			cursor = start + body.length
			return contentOffset + start
		})
		this.note = note
		this.schedules = new CardSchedule()
		this.originalID = cardID || ""
		this.loadSchedules();

		this.patterns = parser.Parse(this)
	}
	getSchedules(): CardSchedule {
		return this.schedules
	}
	private loadSchedules() {
		let db = DatabaseHelper.getInstance()
		let doc = db.query(this.ID)
		if (doc) {
			this.schedules.setData(doc.CardSchedules)
		}
	}
	updateFile(info: updateInfo) {
		this.updateList.push(info)
	}
	getSchedule(patternID: string): PatternSchedule {
		return this.schedules.getSchedule(patternID)
	}
	// ID 优先使用原始ID 不存在时为卡片hash结果
	get ID(): string {
		if (this.originalID?.length > 0) {
			return this.originalID
		}
		return cyrb53(this.cardText, 5);
	}
	async commitFile(committype: commitType) {
		// Plain vocabulary has a stable note identity and no IDs to insert.
		if (!committype.ID || this.idGenFlag || (this.originalID && this.updateList.length === 0)) {
			if (committype.schedules) await DatabaseHelper.getInstance().saveReview(this.ID, this.schedules)
			return
		}
		const originalText = await getAppInstance().vault.read(this.note)
		let fileText = originalText
		if (committype.ID == true && this.idGenFlag == false) {
			// 如果卡片内容被更改, 则阻止添加ID, 因为这会破坏卡片格式
			if (fileText.contains(this.cardText)) {
				// 如果不存在复习块ID 则先更新复习块块ID
				if (this.originalID == "") {
					let index = fileText.indexOf(this.cardText)
					if (index >= 0) {
						fileText = UpdateCardIDTag(this.ID, fileText, index)
					}
				}
				// 更新复习块 包括插入复习标记标签
				let newContent = this.content
				for (let updateInfo of this.updateList) {
					newContent = updateInfo.updateFunc(newContent)
				}
				fileText = fileText.replace(this.content, () => {
					return newContent
				})
				this.updateList = []
				this.idGenFlag = true // 确保只添加一次
			}
		}
		// 提交变更
		if (fileText !== originalText) await getAppInstance().vault.modify(this.note, fileText)
		if (committype.schedules) await DatabaseHelper.getInstance().saveReview(this.ID, this.schedules)
	}
}


