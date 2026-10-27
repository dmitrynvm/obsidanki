import { Card } from "card";
import { CardIDTag, IDComment } from "cardHead";
import { cyrb53 } from "hash";
import { PatternParser } from "ParserCollection";
import { Pattern, PatternProps, prettyText } from "Pattern";
import React from "react";
import { GlobalSettings } from "setting";
import { TagParser } from "tag";
import { renderMarkdown } from "./markdown";
import { NodeContainer } from "./nodeContainer";
import { cardParserRegFlags, escapeRegExp } from "Pattern";


abstract class linePattern extends Pattern {
	keyText: string
	front: string
	back: string
	originalID: string
	reverse: boolean
	constructor(card: Card, keyText: string, front: string, back: string, originalID: string, tagid: string, reverse: boolean, sourceOffset: number) {
		super(card, tagid, sourceOffset)
		this.front = front
		this.keyText = keyText
		this.back = back
		this.originalID = originalID
		this.reverse = reverse
	}
	abstract insertPatternID(): void
	// 反向卡的问题面是 back，和 LinePatternComponent 的渲染保持一致
	get FrontText(): string {
		return this.reverse ? this.back : this.front
	}
	get BackText(): string {
		return this.reverse ? this.front : this.back
	}
	// 展示组件
	Component = (props: PatternProps): React.JSX.Element => {
		return <LinePatternComponent reverse={this.reverse} front={this.front} back={this.back} path={this.card.note.path} patternProps={props}></LinePatternComponent>
	}
}

class singleLinePattern extends linePattern {
	insertPatternID() {
		// Identity comes from the question text; nothing is written into the note
	}
}

class multiLinePattern extends linePattern {
	insertPatternID(): void {
		if (this.originalID) {
			return
		}
		this.card.updateFile({
			updateFunc: (content): string => {
				let newContent = `${this.front}${GlobalSettings.MultiLineDelimeter} ${IDComment(this.TagID)}\n${this.back}`
				return content.replace(this.keyText, () => { return newContent })
			}
		})
	}
}

type singleLinePatternComponentProps = {
	front: string
	back: string
	path: string
	patternProps: PatternProps
	reverse: boolean
}

type singleLinePatternComponentState = {
	markdownDivFront: HTMLDivElement
	markdownDivBack: HTMLDivElement
}

class LinePatternComponent extends React.Component<singleLinePatternComponentProps, singleLinePatternComponentState> {
	componentDidMount() {
		void this.renderSides()
	}
	private async renderSides() {
		let markdownDivFront = this.state.markdownDivFront
		markdownDivFront.empty()
		let markdownDivBack = this.state.markdownDivBack
		markdownDivBack.empty()
		if (this.props.reverse == false) {
			await renderMarkdown(prettyText(this.props.front), markdownDivFront, this.props.path, this.props.patternProps.view)
			await renderMarkdown(prettyText(this.props.back), markdownDivBack, this.props.path, this.props.patternProps.view)
		} else {
			await renderMarkdown(prettyText(this.props.back), markdownDivFront, this.props.path, this.props.patternProps.view)
			await renderMarkdown(prettyText(this.props.front), markdownDivBack, this.props.path, this.props.patternProps.view)
		}
		this.setState({
			markdownDivFront: markdownDivFront,
			markdownDivBack: markdownDivBack,
		})
	}
	constructor(props: singleLinePatternComponentProps) {
		super(props)
		this.state = {
			markdownDivFront: createDiv(),
			markdownDivBack: createDiv(),
		}
	}
	render() {
		// The answer is not in the DOM until revealed, so nothing can be read through it
		return <div className="obsidanki-card">
			<NodeContainer node={this.state.markdownDivFront}></NodeContainer>
			{
				this.props.patternProps.showAns && <>
					<hr className="obsidanki-card-divider"></hr>
					<NodeContainer node={this.state.markdownDivBack}></NodeContainer>
				</>
			}
		</div>
	}
}

export class SingleLineParser implements PatternParser {
	constructor(private readonly includedLines?: ReadonlyMap<number, string>) {}

	private *matches(body: string, bodyOffset: number, expression: RegExp): Generator<RegExpExecArray> {
		expression.lastIndex = 0
		if (!this.includedLines) {
			let match: RegExpExecArray | null
			while ((match = expression.exec(body)) !== null) yield match
			return
		}
		for (const [offset, line] of this.includedLines) {
			if (offset < bodyOffset || offset >= bodyOffset + body.length) continue
			const match = expression.exec(line)
			expression.lastIndex = 0
			if (match) {
				match.index = offset - bodyOffset
				yield match
			}
		}
	}

	Parse(card: Card): Pattern[] {
		const processingTimesLimit = 10000;
		const dSepEscaped = escapeRegExp(GlobalSettings.OneLineDelimeter);
		const rSepEscaped = escapeRegExp(GlobalSettings.OneLineReversedDelimeter);
		let regDirect = new RegExp(
			`^(.+?)(${dSepEscaped})(.+?)$`,
			cardParserRegFlags);
		let regReversed = new RegExp(
			`^(.+?)(${rSepEscaped})(.+?)$`,
			cardParserRegFlags);
		// When one delimiter contains the other (default "::" and ":::"), a line written with the
		// longer one also matches the shorter one's regex. Let the longer delimiter claim it (#65).
		const dSep = GlobalSettings.OneLineDelimeter;
		const rSep = GlobalSettings.OneLineReversedDelimeter;
		const directShadow = rSep.length > dSep.length && rSep.includes(dSep) ? rSep : "";
		const reversedShadow = dSep.length > rSep.length && dSep.includes(rSep) ? dSep : "";
		let results: Pattern[] = []
		const seen = new Map<string, number>()
		for (let bi = 0; bi < card.bodyList.length; bi++) {
			const body = card.bodyList[bi]
			const bodyOffset = card.bodyOffsets[bi]
			let i = 0;
			for (const regArr of this.matches(body, bodyOffset, regDirect)) {
				if (i++ >= processingTimesLimit) break
				let [fullText, frontText, , backText] = regArr;
				if (!(directShadow && fullText.includes(directShadow))) {
					const front = frontText.trim()
					const occurrence = (seen.get(`s:${front}`) ?? 0) + 1
					seen.set(`s:${front}`, occurrence)
					const hashInput = occurrence === 1 ? front : `${front}\n${occurrence}`
					let tagInfo = TagParser.parse(fullText)
					let idTag = tagInfo.findTag(CardIDTag, card.ID, "s")
					const id = idTag?.Canonical ?? `#${CardIDTag}/${card.ID}/s/${cyrb53(hashInput, 4)}`
					results.push(new singleLinePattern(card, fullText, frontText, backText, idTag?.Original || "", id, false, bodyOffset + regArr.index))
				}

			}
			i = 0;
			for (const regArr of this.matches(body, bodyOffset, regReversed)) {
				if (i++ >= processingTimesLimit) break
				let [fullText, frontText, , backText] = regArr;
				if (!(reversedShadow && fullText.includes(reversedShadow))) {
					const front = frontText.trim()
					const occurrence = (seen.get(`r:${front}`) ?? 0) + 1
					seen.set(`r:${front}`, occurrence)
					const hashInput = occurrence === 1 ? front : `${front}\n${occurrence}`
					let tagInfo = TagParser.parse(fullText)
					let idTagForward = tagInfo.findTag(CardIDTag, card.ID, "sf")
					let idTagReverse = tagInfo.findTag(CardIDTag, card.ID, "sr")
					const idForward = idTagForward?.Canonical ?? `#${CardIDTag}/${card.ID}/sf/${cyrb53(hashInput, 4)}`
					const idReverse = idTagReverse?.Canonical ?? `#${CardIDTag}/${card.ID}/sr/${cyrb53(hashInput, 4)}`
					let result1 = new singleLinePattern(card, fullText, frontText, backText, idTagForward?.Original || "", idForward, false, bodyOffset + regArr.index)
					let result2 = new singleLinePattern(card, fullText, frontText, backText, idTagReverse?.Original || "", idReverse, true, bodyOffset + regArr.index)
					results.push(result1, result2)
				}
			}
		}
		return results
	}
}

export class MultiLineParser implements PatternParser {
	Parse(card: Card): Pattern[] {
		let sepEscaped = escapeRegExp(GlobalSettings.MultiLineDelimeter);
		let reg = new RegExp(
			`^((?:(?!(?:${sepEscaped}) ?).+\\n)+)(?:${sepEscaped}) *( (?:#|%%).+)?\\n((?:.+\\n?)+)$`,
			cardParserRegFlags);
		// 捕获不包含? 开头的连续行 然后捕获标签 然后捕获剩余行
		let results: Pattern[] = []
		for (let bi = 0; bi < card.bodyList.length; bi++) {
			const body = card.bodyList[bi]
			const bodyOffset = card.bodyOffsets[bi]
			let regArr = reg.exec(body)
			while (regArr !== null) {
				let fullText = regArr[0];
				let frontText = regArr[1]
				let sepText = regArr[2]
				let backText = regArr[3]
				let newID = `#${CardIDTag}/${card.ID}/m/${cyrb53(fullText, 4)}`
				let tagInfo = TagParser.parse(sepText || "")
				let idTag = tagInfo.findTag(CardIDTag, card.ID, "m")
				let originalID = idTag?.Original || ""
				let result = new multiLinePattern(card, fullText, frontText, backText, originalID, idTag?.Canonical || newID, false, bodyOffset + regArr.index)
				results.push(result)
				regArr = reg.exec(body)
			}
		}
		return results
	}
}
