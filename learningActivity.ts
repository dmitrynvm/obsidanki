export type ActivityCounts = Readonly<Record<string, number>>

export type ActivityDay = {
    date: string
    count: number
    future: boolean
}

// Use the learner's local calendar day, not UTC or a fixed 24-hour offset.
export function activityDate(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function activityYear(activity: ActivityCounts, year: number, today: Date) {
    const todayKey = activityDate(today)
    const first = new Date(year, 0, 1, 12)
    const offset = (first.getDay() + 6) % 7
    const days: (ActivityDay | null)[] = Array<ActivityDay | null>(offset).fill(null)
    // Grid index of each month's first day.
    const firsts: number[] = []
    let reviews = 0
    let activeDays = 0
    for (const date = first; date.getFullYear() === year; date.setDate(date.getDate() + 1)) {
        const key = activityDate(date)
        const future = key > todayKey
        const count = future ? 0 : activity[key] ?? 0
        if (date.getDate() === 1) firsts.push(days.length)
        reviews += count
        if (count > 0) activeDays++
        days.push({ date: key, count, future })
    }
    while (days.length % 7) days.push(null)
    const weeks = days.length / 7
    // A month's name starts at its first Monday column, so it never sits over the previous month's week.
    const columns = firsts.map((index, month) => month === 0 ? 0 : Math.ceil(index / 7))
    const months = firsts.map((first, month) => ({ month, first, column: columns[month], span: (columns[month + 1] ?? weeks) - columns[month] }))
    return { days, months, reviews, activeDays, weeks }
}

export function activityLevel(count: number): number {
    if (count === 0) return 0
    if (count < 5) return 1
    if (count < 10) return 2
    if (count < 20) return 3
    return 4
}
