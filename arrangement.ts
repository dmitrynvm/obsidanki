import { NewCardSearch } from "cardSearch"
import { CardsWatcher, NewCardsWatch } from "cardWatcher"
import { ParseRule } from "deck"
import i18next from "i18next"
import { RuleProperties } from "json-rules-engine"
import { Pattern } from "Pattern"
import { defaultSchedule } from "schedule"
import { GlobalSettings } from "setting"

export class ArrangementItem {
    Name: TAGNAME
    Count: number
    Display: string
    constructor(name: TAGNAME, count: number, display: string) {
        this.Name = name
        this.Count = count
        this.Display = display
    }
}

export enum TAGNAME {
    NEWTAG = "new",
    REVIEWTAG = "review",
    LEARNTAG = "learn",
    HARDTAG = "hard",
    ALLTAG = "all",
    AHEAD = "ahead",
    STUDY = "study",
}

export class Stats {
    NewCount: number
    ReviewCount: number
    LearnCount: number
}

export function hardPatterns(p: Pattern[]): Pattern[] {
    return p.filter((p) => {
        return p.schedule.Ease - defaultSchedule.MIN_EASE_VALUE
            < 0.33 * (GlobalSettings.DefaultEase - defaultSchedule.MIN_EASE_VALUE)
    })
}

function shuffled(p: Pattern[]): Pattern[] {
    for (let i = p.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        const tmp = p[i]
        p[i] = p[j]
        p[j] = tmp
    }
    return p
}

function aheadPatterns(p: Pattern[], now: moment.Moment): Pattern[] {
    return p.filter((p) => {
        let learnInfo = p.schedule.LearnInfo
        return !learnInfo.IsNew
            && !learnInfo.IsLearn
            && p.schedule.NextTime.isAfter(now)
    }).sort((a, b) => {
        return a.schedule.NextTime.valueOf() - b.schedule.NextTime.valueOf()
    })
}

export class PatternIter {
    pattern: Pattern
    index: number
    total: number
    learn: boolean
    constructor(pattern: Pattern, index: number, total: number, learn: boolean) {
        this.pattern = pattern
        this.index = index
        this.total = total
        this.learn = learn
    }
}

abstract class ArrangementBase {
    abstract PatternSequence(Name: string): AsyncGenerator<PatternIter, boolean, unknown>
    abstract stats(): Stats
}

function isToday(date: moment.Moment): boolean {
    const todayStart = window.moment().startOf('day')
    const todayEnd = window.moment().endOf('day')
    return date.isBetween(todayStart, todayEnd, null, '[]');
}

export class Arrangement extends ArrangementBase {
    rule: RuleProperties | null = null
    private allPattern: Pattern[]
    private newPattern: Pattern[]
    private needReviewPattern: Pattern[]
    private needLearn: Pattern[]
    private hardPatterns: Pattern[]
    // All Contents reviews in a fresh shuffle on every load; its preview keeps file order (allPattern)
    private allShuffled: Pattern[]
    private aheadPatterns: Pattern[]
    // private wait:Pattern[]
    private watcher: CardsWatcher
    constructor() {
        super()
        this.allPattern = []
        this.newPattern = []
        this.needReviewPattern = []
        this.hardPatterns = []
        this.allShuffled = []
        this.aheadPatterns = []
    }
    async init(rule: RuleProperties | null) {
        this.rule = rule
        let search = NewCardSearch()
        let allcards = await search.search()
        this.allPattern = []
        this.newPattern = []
        this.needReviewPattern = []
        this.watcher = NewCardsWatch(allcards.AllCard)
        for (let card of allcards.AllCard) {
            for (let p of card.patterns) {
                this.allPattern.push(p)
            }
        }
        if (rule != null) {
            this.allPattern = await ParseRule(rule, this.allPattern)
        }
        this.sort()
    }
    stats(): Stats {
        let newCount = 0
        let reviewCount = 0
        let learnCount = 0
        for (let p of this.allPattern) {
            if (p.schedule.Last && p.schedule.Last != "") {
                if (isToday(p.schedule.LastTime)) {
                    if (p.schedule.Opts.length == 1) {
                        newCount++
                    } else {
                        reviewCount++
                    }
                }
            }
            if (p.schedule.Learned && p.schedule.Learned != "") {
                if (isToday(p.schedule.LearnedTime)) {
                    learnCount++
                }
            }
        }
        let stats = new Stats
        stats.LearnCount = learnCount
        stats.NewCount = newCount
        stats.ReviewCount = reviewCount
        return stats
    }
    // Study runs everything due in one session: due reviews, then reinforce, then new
    private studyPatterns(): Pattern[] {
        return [...this.needReviewPattern, ...this.needLearn, ...this.newPattern]
    }
    studyItem(): ArrangementItem | undefined {
        const n = this.studyPatterns().length
        if (n > 0) {
            return new ArrangementItem(TAGNAME.STUDY, n, i18next.t('StartStudy'))
        }
        return undefined
    }
    nextDue(): moment.Moment | undefined {
        return this.aheadPatterns[0]?.schedule.NextTime
    }
    // 供预览用：按牌组取对应的 pattern 列表
    patternsFor(name: string): Pattern[] {
        if (name == TAGNAME.NEWTAG) {
            return this.newPattern
        } else if (name == TAGNAME.REVIEWTAG) {
            return this.needReviewPattern
        } else if (name == TAGNAME.LEARNTAG) {
            return this.needLearn
        } else if (name == TAGNAME.AHEAD) {
            return this.aheadPatterns
        } else if (name == TAGNAME.HARDTAG) {
            return this.hardPatterns
        } else if (name == TAGNAME.ALLTAG) {
            return this.allPattern
        } else if (name == TAGNAME.STUDY) {
            return this.studyPatterns()
        }
        return []
    }
    private sort() {
        let now = window.moment()
        this.newPattern = []
        this.needReviewPattern = []
        this.needLearn = []
        // this.wait = []
        for (let p of this.allPattern) {
            let learnInfo = p.schedule.LearnInfo
            if (learnInfo.IsNew) {
                this.newPattern.push(p)
            } else if (p.schedule.NextTime.isBefore(now)) {
                this.needReviewPattern.push(p)
            } else if (learnInfo.IsLearn) {
                this.needLearn.push(p)
            }
        }
        this.hardPatterns = hardPatterns(this.allPattern);
        this.newPattern.sort(() => {
            return .5 - Math.random()
        })
        this.needReviewPattern.sort(() => {
            return .5 - Math.random()
        })
        this.needLearn.sort((a, b) => {
            if (a.schedule.LearnedTime.isAfter(b.schedule.LearnedTime)) {
                return 1
            }
            if (a.schedule.LearnedTime.isSame(b.schedule.LearnedTime)) {
                return 0
            }
            return -1
        })
        this.allShuffled = shuffled([...this.allPattern]);
        this.aheadPatterns = aheadPatterns(this.allPattern, now);
    }
    async findLivePattern(p: Pattern): Promise<Pattern | undefined> {
        let liveCard = await this.watcher.getLiveCard(p.card)
        if (!liveCard) {
            return
        }
        for (let cardp of liveCard.patterns) {
            if (p.TagID == cardp.TagID) {
                return cardp
            }
        }
        return
    }
    async *PatternSequence(name: string) {
        let patterns = null;

        if (name == TAGNAME.REVIEWTAG) {
            patterns = this.needReviewPattern;
        } else if (name == TAGNAME.NEWTAG) {
            patterns = this.newPattern;
        } else if (name == TAGNAME.LEARNTAG) {
            patterns = this.needLearn;
        } else if (name == TAGNAME.HARDTAG) {
            patterns = this.hardPatterns;
        } else if (name == TAGNAME.ALLTAG) {
            patterns = this.allShuffled;
        } else if (name == TAGNAME.STUDY) {
            patterns = this.studyPatterns();
        } else if (name == TAGNAME.AHEAD) {
            patterns = this.aheadPatterns;
        }

        if (patterns) {
            const learnSet = new Set(this.needLearn)
            for (let i = 0; i < patterns.length; i++) {
                let p = patterns[i]
                let cardp = await this.findLivePattern(p)
                if (cardp) {
                    yield new PatternIter(cardp, i, patterns.length, (name == TAGNAME.LEARNTAG || name == TAGNAME.STUDY) && learnSet.has(p))
                }
            }
        }

        return true;
    }
}
