import { Arrangement, TAGNAME } from "arrangement"
import { RuleProperties } from "json-rules-engine"

export interface DeckTreeNode {
    id: string
    label: string
    kind: 'folder' | 'note'
    due: number
    total: number
    rule: RuleProperties
    children: DeckTreeNode[]
}

interface NoteCounts {
    due: number
    total: number
}

interface TreeBranch extends NoteCounts {
    id: string
    label: string
    kind: DeckTreeNode['kind']
    paths: string[]
    children: Map<string, TreeBranch>
}

// Fix the locale and break equivalent-label ties so input order cannot affect the tree.
const naturalOrder = new Intl.Collator('en', { numeric: true, sensitivity: 'base' })

function compareNames(left: string, right: string): number {
    return naturalOrder.compare(left, right) || (left < right ? -1 : left > right ? 1 : 0)
}

function branch(
    siblings: Map<string, TreeBranch>,
    kind: DeckTreeNode['kind'],
    label: string,
    route: string[],
): TreeBranch {
    // Structured identities distinguish path boundaries and node kinds.
    const id = JSON.stringify([kind, route])
    let node = siblings.get(id)
    if (!node) {
        node = { id, label, kind, due: 0, total: 0, paths: [], children: new Map() }
        siblings.set(id, node)
    }
    return node
}

function addNote(node: TreeBranch, path: string, counts: NoteCounts): void {
    node.due += counts.due
    node.total += counts.total
    node.paths.push(path)
}

function scopedRule(paths: string[], base: RuleProperties | null): RuleProperties {
    const pathCondition = { fact: 'card', path: '$.path', operator: 'in', value: paths }
    return {
        conditions: { all: base ? [base.conditions, pathCondition] : [pathCondition] },
        event: { type: 'deck-tree' },
    }
}

function finishTree(siblings: Map<string, TreeBranch>, base: RuleProperties | null): DeckTreeNode[] {
    return Array.from(siblings.values()).sort((left, right) => {
        const noteOrder = Number(left.kind === 'note') - Number(right.kind === 'note')
        return noteOrder || compareNames(left.label, right.label) || compareNames(left.id, right.id)
    }).map(node => ({
        id: node.id,
        label: node.label,
        kind: node.kind,
        due: node.due,
        total: node.total,
        rule: scopedRule(node.paths, base),
        children: finishTree(node.children, base),
    }))
}

/** Group existing queue patterns by note, then roll each note into its ancestors once. */
export function buildDeckTree(arrangement: Arrangement): DeckTreeNode[] {
    const duePatterns = new Set(arrangement.patternsFor(TAGNAME.STUDY))
    const notes = new Map<string, NoteCounts>()
    for (const pattern of arrangement.patternsFor(TAGNAME.ALLTAG)) {
        const path = pattern.card.note.path
        let counts = notes.get(path)
        if (!counts) {
            counts = { due: 0, total: 0 }
            notes.set(path, counts)
        }
        counts.total++
        if (duePatterns.has(pattern)) counts.due++
    }

    const roots = new Map<string, TreeBranch>()
    // Sorting notes once also gives every ancestor a deterministic exact-path rule array.
    const paths = Array.from(notes.keys()).sort(compareNames)
    for (const path of paths) {
        const counts = notes.get(path)!
        const parts = path.split('/')
        const route: string[] = []
        let siblings = roots
        for (let index = 0; index < parts.length; index++) {
            const name = parts[index]
            const isNote = index === parts.length - 1
            route.push(name)
            const node = branch(siblings, isNote ? 'note' : 'folder',
                isNote ? name.replace(/\.md$/i, '') : name, route)
            addNote(node, path, counts)
            siblings = node.children
        }
    }
    return finishTree(roots, arrangement.rule)
}
