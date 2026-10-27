import { CardIDTag } from 'cardHead';
import { Notice, TFile } from 'obsidian';
import { TagParser } from 'tag';
import { Card, NewCard } from "./card";
import { log, getAppInstance } from 'main';
import { minimatch } from 'minimatch';
import { GlobalSettings, parseExcludePatterns } from 'setting';
import { SingleLineParser } from 'patternLine';
import { cyrb53 } from 'hash';

// 搜索的结果
export class SearchResult {
	AllCard: Card[]
	SearchName: string
	constructor() {
		this.AllCard = []
	}
}

// 卡片搜寻器负责搜索可能的卡片
export interface cardSearcher {
	search(file?: TFile, text?: string): Promise<SearchResult>
}

export function NewCardSearch(tagName?: string): cardSearcher {
	return new defaultCardSearch(tagName)
}

interface elem {
	all: string
	start: number
	end: number
	content: string
	heading: string
}

// 默认的卡片搜索
// 搜索标签开头的一行，到该段落结束位置，该区域的内容被视为卡片Card的内容
class defaultCardSearch implements cardSearcher {
	private tagName = "Q"
	private matchReg: RegExp
	private qReg = /(^#Q\b.*|^#\/Q\b.*)/gm;
	constructor(tagName?: string) {
	}
	findAllQ(text: string) {
		let match;
		const matches = [];
		while ((match = this.qReg.exec(text)) !== null) {
			matches.push({
				text: match[0],
				start: match.index,
				end: match.index + match[0].length
			});
		}
		return matches;
	}
	matchText(text: string) {
		const qTags = this.findAllQ(text);
		const matches: elem[] = [];
		for (let i = 0; i < qTags.length; i++) {
			if (qTags[i].text.startsWith('#Q')) {
				if (matches.length > 0) {
					if (matches[matches.length - 1].end > qTags[i].start) {
						continue
					}
				}
				let end;
				if (i + 1 < qTags.length && qTags[i + 1].text.startsWith('#/Q')) {
					end = qTags[i + 1].start - 1;
				} else {
					// Without a closing #/Q the block runs to the next heading, the next #Q, or the end of the note
					const headingRe = /^#{1,6}\s/gm
					headingRe.lastIndex = qTags[i].end
					const heading = headingRe.exec(text)
					const nextQ = i + 1 < qTags.length ? qTags[i + 1].start : text.length
					const boundary = Math.min(heading ? heading.index : text.length, nextQ)
					end = text.slice(0, boundary).trimEnd().length
				}
				const all = text.slice(qTags[i].start, end)
				const content = text.slice(qTags[i].end + 1, end)
				if (all.length == 0 || content.length == 0) {
					continue
				}
				matches.push({ all: all, start: qTags[i].start, end: end, content: content, heading: qTags[i].text });
			}
		}
		return matches;
	}

	// Explicit #Q blocks are authoritative. Otherwise, index only vocabulary lines,
	// never frontmatter, fenced/indented code, code spans, or hidden comments.
	private inlineLines(text: string): Map<number, string> | null {
		const lines = new Map<number, string>()
		const separators = [GlobalSettings.OneLineDelimeter, GlobalSettings.OneLineReversedDelimeter]
		let fenceEnd: RegExp | null = null
		let commentEnd: string | null = null
		let frontmatter = false
		for (const match of text.matchAll(/^.*$/gm)) {
			const line = match[0].replace(/\r$/, "")
			const offset = match.index ?? 0
			if (offset === 0 && line.replace(/^\uFEFF/, "") === "---") {
				frontmatter = true
				continue
			}
			if (frontmatter) {
				if (/^(---|\.\.\.)\s*$/.test(line)) frontmatter = false
				continue
			}
			const unquoted = line.replace(/^(?: {0,3}> ?)+/, "")
			if (fenceEnd) {
				if (fenceEnd.test(unquoted)) fenceEnd = null
				continue
			}
			let visible = ""
			let cursor = 0
			while (cursor < unquoted.length) {
				if (commentEnd) {
					const end = unquoted.indexOf(commentEnd, cursor)
					if (end < 0) break
					cursor = end + commentEnd.length
					commentEnd = null
				} else {
					const html = unquoted.indexOf("<!--", cursor)
					const obsidian = unquoted.indexOf("%%", cursor)
					const start = html < 0 ? obsidian : obsidian < 0 ? html : Math.min(html, obsidian)
					if (start < 0) {
						visible += unquoted.slice(cursor)
						break
					}
					visible += unquoted.slice(cursor, start)
					commentEnd = start === html ? "-->" : "%%"
					cursor = start + (start === html ? 4 : 2)
				}
			}
			const fence = /^ {0,3}(`{3,}|~{3,})/.exec(visible)
			if (fence) {
				fenceEnd = new RegExp(`^ {0,3}${fence[1][0]}{${fence[1].length},}\\s*$`)
				continue
			}
			if (/^#Q\b/.test(line) && /^#Q\b/.test(visible)) return null
			if (/^(?: {4}|\t| {0,3}#{1,6}(?:\s|$))/.test(unquoted)) continue
			let codeDelimiter = false
			visible = visible.replace(/(`+).*?\1/g, code => {
				if (separators.some(separator => code.includes(separator))) codeDelimiter = true
				return code
			})
			if (!codeDelimiter && separators.some(separator => visible.includes(separator))) lines.set(offset, visible)
		}
		return lines
	}

	async search(file?: TFile, text?: string): Promise<SearchResult> {
		let result = new SearchResult()
		result.SearchName = this.openingTagName()
		if (file) {
			if (!text) {
				result.AllCard = await this.getCardFromFile(file)
			} else {
				result.AllCard = this.getCardFromText(text, file)
			}
		} else {
			result.AllCard = await this.getCardFromVaultFile()
		}
		return result
	}
	private openingTagName(): string {
		return "#" + this.tagName;
	}
	isExcludedFile(file: TFile): boolean {
		for (const pattern of parseExcludePatterns(GlobalSettings.ExcludeWorkingPathesPattern)) {
			if (file.path.startsWith(pattern)
				|| minimatch(file.path, pattern)) {
				log(() => `Ignored file: ${file.path} due to pattern: ${pattern}`);
				return true;
			}
		}
		return false;
	}
	async getCardFromVaultFile(): Promise<Card[]> {
		let cards: Card[] = []
		const notes: TFile[] = getAppInstance().vault.getMarkdownFiles();
		for (const note of notes) {
			if (!this.isExcludedFile(note)) {
				cards.push(...await this.getCardFromFile(note))
			}
		}
		return cards
	}
	async getCardFromFile(note: TFile): Promise<Card[]> {
		let cards: Card[] = []
		try {
			let fileText = await getAppInstance().vault.cachedRead(note)
			if (fileText) {
				cards = this.getCardFromText(fileText, note);
			}
		} catch (error) {
			log(() => `Failed to read file: ${note.path}, error: ${error}`);
			new Notice(`[Obsidanki] Failed to read file: ${note.path}, error: ${error}`);
		}
		return cards;
	}
	private getCardFromText(fileText: string, note: TFile): Card[] {
		const cache = getAppInstance().metadataCache.getFileCache(note)
		const inline = this.inlineLines(fileText)
		if (inline !== null) {
			if (inline.size === 0) return []
			// Keep question IDs stable across answer edits and additions, without writing IDs.
			const id = `plain_${cyrb53(note.path, 11)}`
			const card = NewCard(fileText, fileText, id, 0, note, cache, new SingleLineParser(inline))
			return card.patterns.length > 0 ? [card] : []
		}
		let cards: Card[] = []
		let results = this.matchText(fileText)
		for (let result of results) {
			let cardText = result.all;
			let index = result.start || 0;
			let headingtags = TagParser.parse(result.heading);
			let idTag = headingtags.findTag(CardIDTag);
			let blockID = idTag?.Suffix || "";
			let content = result.content;
			let card: Card = NewCard(cardText, content, blockID, index, note, cache);
			cards.push(card)
		}
		log(() => `Found ${cards.length} cards in file: ${note.path}`);
		return cards
	}
}
