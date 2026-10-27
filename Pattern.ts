import type React from 'react';
import { CardIDTag } from 'cardHead';
import { Component } from 'obsidian';
import { NewSchedule, Operation, PatternSchedule } from 'schedule';
import { TagParser } from 'tag';
import { Card } from './card';


export type PatternProps ={
	view:Component
	showAns:boolean
}

// 卡片的展示模式
export abstract class Pattern {
	TagID: string;
	readonly sourceOffset: number;
	private pcard: Card;
	get schedule(): PatternSchedule {
		return this.card.getSchedule(this.TagID)
	}
	get card(): Card {
		return this.pcard
	}
	constructor(card:Card, id:string, sourceOffset:number) {
		this.pcard = card
		this.TagID = id
		this.sourceOffset = sourceOffset
	}
	abstract Component(props:PatternProps): React.JSX.Element;
	abstract insertPatternID(): void;
	// 界面按钮点击: apply the grade and persist it. On failure the schedule is restored so a retry does not grade twice.
	async SubmitOpt(opt: Operation): Promise<void> {
		const schedule = this.card.getSchedule(this.TagID)
		const before = NewSchedule(schedule.id)
		before.copy(schedule)
		schedule.apply(opt)
		try {
			// 原文中不一定包含pattern的ID 可能需要更新
			this.insertPatternID()
			await this.card.commitFile({ ID: true, schedules: true })
		} catch (error) {
			schedule.copy(before)
			throw error
		}
	}
	// 纯正面文本（不含答案），供预览用
	abstract get FrontText(): string;
	// Answer text used by card browsing and search.
	abstract get BackText(): string;
	async InitObsidankiID() {
		this.insertPatternID()
		await this.card.commitFile({ID:true})
	}
}

export const cardParserRegFlags = "gm";
export function escapeRegExp(text: string): string {
	return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function prettyText (text:string):string {
	let tags = TagParser.parse(text)
	for (let tag of tags.Tags) {
		if (tag.Head != CardIDTag) {
			continue
		}
		text = text.replace(tag.Original, ()=>{return ""})
	}
	text = text.replace("#multicloze", ()=>{return ""})
	return text
}