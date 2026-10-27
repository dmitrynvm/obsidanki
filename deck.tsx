import { Pattern } from "Pattern";
import { findOutline } from "card";
import { Engine, RuleProperties } from "json-rules-engine";
import { log } from "main";
import { MarkdownPostProcessorContext, MarkdownRenderChild, parseFrontMatterTags } from "obsidian";
import React from "react";
import { Root, createRoot } from "react-dom/client";
import { App } from "view";


export interface DeckConfig {
    rule: RuleProperties
}

interface FactPattern {
    card: {
        path: string
        tags: string[]
        text: string
        outline: string // outline heading string
    }
    file: {
        tags: string[] // from frontmatter
    }
}

function convertToFact(p: Pattern): FactPattern {
    log(() => `Converting pattern to fact: ${p.TagID}`);
    let tags = parseFrontMatterTags(p.card.fileCache?.frontmatter) || []
    let outline = findOutline(p.card.fileCache, p.card.indexBuff)
    return {
        card: {
            path: p.card.note.path,
            tags: p.card.tags,
            text: p.card.cardText,
            outline: outline
        },
        file: {
            tags: tags
        }
    }
}

export async function ParseRule(rule: RuleProperties, allPattern: Pattern[]) {
    let results: Pattern[] = []
    let engine = new Engine()
    try {
        engine.addRule(rule)
        engine.addOperator('regexMatch', (factValue, regex) => {
            if (typeof regex !== "string") return false;
    
            if (typeof factValue === "string") {
                const regexPattern = new RegExp(regex);
                return regexPattern.test(factValue);
            }
        
            if (Array.isArray(factValue)) {
                const regexPattern = new RegExp(regex);
                return factValue.some(item => {
                    return typeof item === "string" && regexPattern.test(item);
                });
            }
        
            return false;
        })
        // 内置 contains 只接受数组，card.path / card.text / card.outline 这类字符串永远不匹配
        // 覆盖成：字符串按子串匹配，数组按元素匹配（与内置行为一致）
        engine.addOperator('contains', (factValue, value) => {
            if (typeof factValue === "string") {
                return typeof value === "string" && factValue.includes(value);
            }
            if (Array.isArray(factValue)) {
                return factValue.includes(value);
            }
            return false;
        })
        await Promise.all(allPattern.map(async (pattern) => {
            let fact = convertToFact(pattern)
            const events = await engine.run(fact)
            if (events.events.length > 0) {
                results.push(pattern);
            }
        }))
    } catch (error) {
        console.error(error)
    }
    return results
}

export function handlerDeckCode(source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) {
    let config: DeckConfig
    try {
        config = JSON.parse(source) as DeckConfig
        let testEngine = new Engine()
        testEngine.addRule(config.rule)
        ctx.addChild(new DeckView(el, config))
    } catch (error) {
        console.error(error)
        el.createSpan(
            { "text": String(error) }
        )
    }
}

export class DeckView extends MarkdownRenderChild {
    root: Root
    rule: RuleProperties
    constructor(containerEl: HTMLElement, rule: DeckConfig) {
        super(containerEl)
        this.rule = rule.rule
    }
    onload(): void {
        let rootDiv = this.containerEl.createDiv()
        this.root = createRoot(rootDiv);
        this.root.render(
            <App view={this} rule={this.rule}></App>
        )
    }
    onunload(): void {
        this.root.unmount()
    }
}
