import { Card } from "card";
import { CardIDTag, IDComment } from "cardHead";
import { cyrb53 } from "hash";
import { log } from "main";
import { renderMarkdown } from "markdown";
import { NodeContainer } from "nodeContainer";
import { PatternParser } from "ParserCollection";
import { Pattern, PatternProps, prettyText } from "Pattern";
import React from "react";
import { TagParser } from "tag";

const hasClozeReg = /==(\S[\s\S]*?)==/m
const clozeReg = /==(\S[\s\S]*?)==/gm

class multiclozePattern extends Pattern {
    insertPatternID() {
        if (this.originalID) {
            return
        }
        this.card.updateFile({
            updateFunc: (contentText): string => {
                let newtext = this.text.replace("#multicloze", ()=>{return `#multicloze ${IDComment(this.TagID)} `})
                return contentText.replace(this.text, ()=>{return newtext})
            }
        })
    }
    Component = (props: PatternProps): React.JSX.Element => {
        return <ClozePatternComponent index={0} text={this.text} patternProps={props} clozeOriginal={""} clozeInner={""} path={this.card.note.path} replaceAll={true}></ClozePatternComponent>
    }
    get FrontText(): string {
        return this.text.replace(clozeReg, "[...]")
    }
    get BackText(): string {
        // 展开所有挖空
        return this.text.replace(clozeReg, "$1")
    }
    text: string
    originalID: string
    constructor(card: Card, text: string, originalID: string, tagid: string, sourceOffset: number) {
        super(card, tagid, sourceOffset)
        this.text = text
        this.originalID = originalID
    }
}

function replaceClosestSubstring(
    inputStr: string,
    targetSubstr: string,
    replacement: string,
    referenceIndex: number
): string {
    // 找到所有子字符串B的索引位置
    let indices: number[] = [];
    let currentIndex = inputStr.indexOf(targetSubstr);

    while (currentIndex !== -1) {
        indices.push(currentIndex);
        currentIndex = inputStr.indexOf(targetSubstr, currentIndex + 1);
    }

    // 如果A中没有子字符串B，直接返回原始字符串A
    if (indices.length === 0) {
        return inputStr;
    }

    // 找到距离给定index最近的子字符串B的索引位置
    let closestIndex = indices.reduce((prev, curr) => {
        return Math.abs(curr - referenceIndex) < Math.abs(prev - referenceIndex)
            ? curr
            : prev;
    });

    // 将找到的子字符串B替换为C
    return (
        inputStr.substring(0, closestIndex) +
        replacement +
        inputStr.substring(closestIndex + targetSubstr.length)
    );
}


class clozePattern extends Pattern {
    text: string // 整段文本
    clozeOriginal: string // 带==和标签的完形文本
    clozeInner: string // ==内部的文本
    originalID: string
    index: number // 匹配到的索引位置
    insertPatternID() {
        if (this.originalID) {
            return
        }
        this.card.updateFile({
            updateFunc: (content): string => {
                let addtag = `${this.clozeOriginal} ${IDComment(this.TagID)} `
                let newtext = replaceClosestSubstring(this.text, this.clozeOriginal, addtag, this.index)
                return content.replace(this.text, ()=>{return newtext})
            }
        })
    }
    Component = (props: PatternProps): React.JSX.Element => {
        return <ClozePatternComponent index={this.index} text={this.text} patternProps={props} clozeOriginal={this.clozeOriginal} clozeInner={this.clozeInner} path={this.card.note.path} replaceAll={false}></ClozePatternComponent>
    }
    get FrontText(): string {
        return this.text.replace(this.clozeOriginal, "[...]")
    }
    get BackText(): string {
        return this.text.replace(clozeReg, "$1")
    }
    constructor(card: Card, text: string, index: number, clozeOriginal: string, clozeInner: string, originalID: string, tagid: string, sourceOffset: number) {
        super(card, tagid, sourceOffset)
        this.text = text
        this.clozeInner = clozeInner
        this.clozeOriginal = clozeOriginal
        this.originalID = originalID
        this.index = index
    }
}

type clozePatternComponentProps = {
    text: string
    clozeOriginal: string
    clozeInner: string
    replaceAll: boolean
    path: string
    patternProps: PatternProps
    index: number
}

type clozePatternComponentState = {
    markdownDivMask: HTMLDivElement
    markdownDivAnswer: HTMLDivElement
}

const clozeBlank = `<span class="obsidanki-cloze obsidanki-cloze-blank">[…]</span>`

// The question shows a blank in place of the cloze; the answer is a separate render, swapped in on reveal
class ClozePatternComponent extends React.Component<clozePatternComponentProps, clozePatternComponentState> {
    private loadFlag: boolean
    componentDidMount() {
        void this.renderSides()
    }
    private async renderSides() {
        if (this.loadFlag) {
            return
        }
        this.loadFlag = true
        let masktext: string
        let answertext: string
        if (this.props.replaceAll) {
            masktext = this.props.text.replace(clozeReg, clozeBlank)
            answertext = this.props.text.replace(clozeReg, `<mark class="obsidanki-cloze">$1</mark>`)
        } else {
            masktext = replaceClosestSubstring(this.props.text, this.props.clozeOriginal, clozeBlank, this.props.index)
            answertext = replaceClosestSubstring(this.props.text, this.props.clozeOriginal, `<mark class="obsidanki-cloze">${this.props.clozeInner}</mark>`, this.props.index)
        }
        await renderMarkdown(prettyText(masktext), this.state.markdownDivMask, this.props.path, this.props.patternProps.view)
        await renderMarkdown(prettyText(answertext), this.state.markdownDivAnswer, this.props.path, this.props.patternProps.view)
        this.setState({
            markdownDivMask: this.state.markdownDivMask,
            markdownDivAnswer: this.state.markdownDivAnswer,
        })
    }
    constructor(props: clozePatternComponentProps) {
        super(props)
        this.state = {
            markdownDivMask: createDiv(),
            markdownDivAnswer: createDiv(),
        }
        this.loadFlag = false
    }
    render() {
        return <div className="obsidanki-card">
            <NodeContainer node={this.props.patternProps.showAns ? this.state.markdownDivAnswer : this.state.markdownDivMask}></NodeContainer>
        </div>
    }
}

export class ClozeParser implements PatternParser {
    Parse(card: Card): Pattern[] {
        let reg = /==(\S[\s\S]*?)==((?: (?:#(?!OBSIDANKI(?:\/|\b))[\w/]+\b|%%OBSIDANKI\/[\w/]+%%))*)/gm
        let results: Pattern[] = []
        for (const [index, body] of card.bodyList.entries()) {
            // The hash input below concatenates the index as a string, as the former for-in key did.
            const bi = String(index)
            let bodytag = TagParser.parse(body)
            let multicloze = bodytag.findTag("multicloze")
            if (multicloze) {
                const firstCloze = hasClozeReg.exec(body)
                if (firstCloze) {
                    let newID = `#${CardIDTag}/${card.ID}/mc/${cyrb53(body, 4)}`
                    let idTag = bodytag.findTag(CardIDTag, card.ID, "mc")
                    let originalID = idTag?.Original || ""
                    let result = new multiclozePattern(card, body, originalID, idTag?.Canonical || newID, card.bodyOffsets[index] + firstCloze.index)
                    results.push(result)
                } else {
                    log(() => `Ignored file: ${card.note.path} does not contain cloze pattern`);
                }
            } else {
                for (let i = 0; i < 10000; i++) {
                    let regArr = reg.exec(body)
                    if (regArr == null) {
                        break
                    }
                    let newID = `#${CardIDTag}/${card.ID}/c/${cyrb53(bi + i + regArr[0], 4)}`
                    let tagInfo = TagParser.parse(regArr[2] || "")
                    let idTag = tagInfo.findTag(CardIDTag, card.ID, "c")
                    let originalID = idTag?.Original || ""
                    let result = new clozePattern(card, body, regArr.index, regArr[0], regArr[1], originalID, idTag?.Canonical || newID, card.bodyOffsets[index] + regArr.index)
                    results.push(result)
                }
            }
        }
        return results
    }
}
