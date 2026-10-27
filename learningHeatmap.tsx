import { DatabaseHelper } from 'db'
import i18n from 'i18next'
import { activityDate, activityLevel, activityYear, ActivityDay } from 'learningActivity'
import React from 'react'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const LEVELS = ['0', '1–4', '5–9', '10–19', '20+']
// Rows carry no weekday labels, so the day's own description names its weekday.
const dateFormat = new Intl.DateTimeFormat('en', { dateStyle: 'full' })

export function LearningHeatmap() {
    const db = DatabaseHelper.getInstance()
    const activity = React.useSyncExternalStore(db.subscribeActivity, db.getActivity)
    const [today, setToday] = React.useState(() => new Date())
    const [chosenYear, setChosenYear] = React.useState<number | null>(null)
    const [selected, setSelected] = React.useState(() => activityDate(today))
    const year = chosenYear ?? today.getFullYear()
    const todayKey = activityDate(today)
    const titleId = React.useId()
    const root = React.useRef<HTMLElement>(null)
    const cells = React.useRef(new Map<string, HTMLButtonElement>())
    const calendar = React.useMemo(() => activityYear(activity, year, today), [activity, year, today])
    const years = React.useMemo(() => [...new Set([today.getFullYear(), ...Object.keys(activity).map(date => Number(date.slice(0, 4)))])]
        .sort((a, b) => b - a), [activity, today])
    // Wide panes join both halves into one strip; narrow panes stack July–December below January–June.
    const split = calendar.months[6].column
    const halves = [[0, split], [split, calendar.weeks]]
    // A boundary runs between weeks, stepping across the week where a month starts mid-week.
    const edges: { column: number, rows: string, kind: string }[] = []
    for (const { first } of calendar.months.slice(1)) {
        const column = Math.floor(first / 7)
        const row = first % 7
        if (row === 0) edges.push({ column, rows: '1 / 8', kind: 'is-vertical' })
        else edges.push(
            { column: column + 1, rows: `1 / ${row + 1}`, kind: 'is-vertical is-above' },
            { column, rows: `${row + 1} / span 1`, kind: 'is-step' },
            { column, rows: `${row + 1} / 8`, kind: 'is-vertical is-below' },
        )
    }
    const selectedDay = calendar.days.find(day => day?.date === selected)
        ?? calendar.days.find(day => day?.date === todayKey)
        ?? calendar.days.find(day => day && !day.future)!
    const describe = (day: ActivityDay) => String(i18n.t('ActivityDay', {
        count: day.count,
        date: dateFormat.format(new Date(`${day.date}T12:00:00`)),
    }))

    React.useEffect(() => {
        const ownerWindow = root.current?.ownerDocument.defaultView
        if (!ownerWindow) return
        let timer: number
        const refresh = () => {
            const now = new Date()
            setToday(now)
            ownerWindow.clearTimeout(timer)
            const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
            timer = ownerWindow.setTimeout(refresh, midnight.getTime() - now.getTime() + 100)
        }
        refresh()
        ownerWindow.addEventListener('focus', refresh)
        return () => {
            ownerWindow.clearTimeout(timer)
            ownerWindow.removeEventListener('focus', refresh)
        }
    }, [])

    const move = (event: React.KeyboardEvent, index: number) => {
        let target: number
        switch (event.key) {
            case 'ArrowUp': target = index - 1; break
            case 'ArrowDown': target = index + 1; break
            case 'ArrowLeft': target = index - 7; break
            case 'ArrowRight': target = index + 7; break
            case 'Home': target = event.ctrlKey ? 0 : index - index % 7; break
            case 'End': target = event.ctrlKey ? calendar.days.length - 1 : index + 6 - index % 7; break
            default: return
        }
        event.preventDefault()
        event.stopPropagation()
        const first = calendar.days.findIndex(day => day !== null)
        const last = calendar.days.reduce((last, day, i) => day && !day.future ? i : last, first)
        const day = calendar.days[Math.max(first, Math.min(last, target))]
        if (day) cells.current.get(day.date)?.focus()
    }

    return <section className="obsidanki-activity" aria-labelledby={titleId} ref={root} style={{
        '--obsidanki-activity-weeks': calendar.weeks,
        '--obsidanki-activity-half': Math.max(split, calendar.weeks - split),
    } as React.CSSProperties}>
        <div className="obsidanki-activity-header">
            <h2 id={titleId}>{i18n.t('ActivityTitle')}</h2>
            <select aria-label={String(i18n.t('ActivityYear'))} value={year}
                onChange={event => { setChosenYear(Number(event.target.value)); setSelected('') }}>
                {years.map(year => <option key={year} value={year}>{year}</option>)}
            </select>
        </div>
        <p className="obsidanki-activity-summary">
            {i18n.t('ActivityReviews', { count: calendar.reviews })}
            {' · '}{i18n.t('ActivityDays', { count: calendar.activeDays })}
        </p>
        <div className="obsidanki-activity-calendar" role="group" aria-label={String(i18n.t('ActivityCalendar', { year }))}>
            {halves.map(([from, to]) => <div key={from} className="obsidanki-activity-half"
                style={{ '--obsidanki-activity-half-weeks': to - from } as React.CSSProperties}>
                <div className="obsidanki-activity-months" aria-hidden="true">
                    {calendar.months.filter(({ column }) => column >= from && column < to).map(({ month, column, span }) =>
                        <span key={month} style={{ gridColumn: `${column - from + 1} / span ${span}` }}>{MONTHS[month]}</span>)}
                </div>
                <div className="obsidanki-activity-grid">
                    {calendar.days.slice(from * 7, to * 7).map((day, offset) => {
                        const index = from * 7 + offset
                        return !day || day.future
                            ? <span key={day?.date ?? index} aria-hidden="true"
                                className={'obsidanki-activity-cell ' + (day ? 'is-future' : 'is-outside')} />
                            : <button type="button" key={day.date}
                                className={'obsidanki-activity-cell' + (day.date === todayKey ? ' is-today' : '')}
                                data-date={day.date} data-level={activityLevel(day.count)}
                                tabIndex={day.date === selectedDay?.date ? 0 : -1}
                                aria-label={describe(day)} title={describe(day)}
                                ref={element => {
                                    if (element) cells.current.set(day.date, element)
                                    else cells.current.delete(day.date)
                                }}
                                onFocus={() => setSelected(day.date)} onClick={() => setSelected(day.date)}
                                onKeyDown={event => move(event, index)} />
                    })}
                    {edges.filter(({ column }) => column >= from && column < to).map(({ column, rows, kind }) =>
                        <span key={`${column} ${rows}`} aria-hidden="true"
                            className={`obsidanki-activity-edge ${kind}` + (column === from && from > 0 ? ' is-seam' : '')}
                            style={{ gridColumn: `${column - from + 1} / span 1`, gridRow: rows }} />)}
                </div>
            </div>)}
        </div>
        <div className="obsidanki-activity-footer">
            <span aria-live="polite">{selectedDay && describe(selectedDay)}</span>
            <div className="obsidanki-activity-legend" aria-label={String(i18n.t('ActivityScale'))}>
                <span>{i18n.t('ActivityLess')}</span>
                {LEVELS.map((range, level) => <span key={level} className="obsidanki-activity-cell"
                    data-level={level} title={`${range} reviews`} aria-label={`${range} reviews`} />)}
                <span>{i18n.t('ActivityMore')}</span>
            </div>
        </div>
        {Object.keys(activity).length === 0 && <p className="obsidanki-activity-empty">{i18n.t('ActivityEmpty')}</p>}
    </section>
}
