import { Arrangement, TAGNAME } from 'arrangement'
import { buildDeckTree, DeckTreeNode } from 'deckTree'
import { openDeckPreview } from 'deckPreview'
import i18n from 'i18next'
import { RuleProperties } from 'json-rules-engine'
import { paneKeysActive, REVEAL_KEYS } from 'keyboard'
import { LearningHeatmap } from 'learningHeatmap'
import { setIcon } from 'obsidian'
import React from 'react'
import { GlobalSettings } from 'setting'
import { formatInterval } from 'view'

type DeckTreeMenuProps = {
    arrangement: Arrangement
    onStudy: (rule: RuleProperties | null) => Promise<void>
    onCollapsedChange: (nodes: string[]) => Promise<void>
}

type VisibleNode = { node: DeckTreeNode, parent: string | null }
const MOVE_KEYS: Record<string, number> = { j: 1, ArrowDown: 1, k: -1, ArrowUp: -1 }

function expandedChevron(button: HTMLButtonElement | null) {
    if (button) setIcon(button, 'chevron-down')
}

function collapsedChevron(button: HTMLButtonElement | null) {
    if (button) setIcon(button, 'chevron-right')
}

function folderIcon(element: HTMLSpanElement | null) {
    if (element) setIcon(element, 'folder')
}

function noteIcon(element: HTMLSpanElement | null) {
    if (element) setIcon(element, 'file-text')
}

export function DeckTreeMenu({ arrangement, onStudy, onCollapsedChange }: DeckTreeMenuProps) {
    const root = React.useRef<HTMLDivElement>(null)
    const rowElements = React.useRef(new Map<string, HTMLDivElement>())
    const treeId = React.useId()
    const { nodes, maxDepth } = React.useMemo(() => {
        const nodes = buildDeckTree(arrangement)
        let maxDepth = 1
        const measure = (children: DeckTreeNode[], depth: number) => {
            maxDepth = Math.max(maxDepth, depth)
            for (const node of children) {
                if (node.children.length > 0) measure(node.children, depth + 1)
            }
        }
        measure(nodes, 0)
        return { nodes, maxDepth }
    }, [arrangement])
    const [collapsed, setCollapsed] = React.useState(() => new Set(GlobalSettings.CollapsedTreeNodes))
    const collapsedRef = React.useRef(collapsed)
    const [selectedId, setSelectedId] = React.useState<string | null>(null)
    const visible = React.useMemo(() => {
        const rows: VisibleNode[] = []
        const visit = (children: DeckTreeNode[], parent: string | null) => {
            for (const node of children) {
                rows.push({ node, parent })
                if (node.children.length > 0 && !collapsed.has(node.id)) visit(node.children, node.id)
            }
        }
        visit(nodes, null)
        return rows
    }, [nodes, collapsed])
    const selectedIndex = Math.max(0, visible.findIndex(row => row.node.id === selectedId))
    const selected = visible[selectedIndex]
    const next = arrangement.nextDue()
    const caughtUp = nodes.length > 0 && nodes.every(node => node.due === 0)
    const countDigits = nodes.reduce((digits, node) => Math.max(digits, String(node.total).length), 2)

    const toggle = (node: DeckTreeNode) => {
        setSelectedId(node.id)
        const next = new Set(collapsedRef.current)
        if (next.has(node.id)) next.delete(node.id)
        else next.add(node.id)
        collapsedRef.current = next
        setCollapsed(next)
        void onCollapsedChange([...next])
    }
    const activate = (node: DeckTreeNode) => {
        if (node.due > 0) void onStudy(node.rule)
        else void openDeckPreview(node.rule, TAGNAME.ALLTAG, node.label)
    }
    const select = (id: string) => {
        setSelectedId(id)
        const row = rowElements.current.get(id)
        row?.querySelector<HTMLButtonElement>('.obsidanki-tree-name')?.focus({ preventScroll: true })
        row?.scrollIntoView({ block: 'nearest' })
    }

    React.useEffect(() => {
        const keyWindow = root.current?.ownerDocument.defaultView
        if (!keyWindow) return
        const onKeyDown = (event: KeyboardEvent) => {
            if (!selected || !paneKeysActive(root.current, event)) return
            if ((event.target as HTMLElement | null)?.closest?.('.obsidanki-activity')) return
            const { node, parent } = selected
            const move = MOVE_KEYS[event.key]
            let action: (() => void) | undefined
            if (move) {
                const index = Math.min(Math.max(selectedIndex + move, 0), visible.length - 1)
                action = () => select(visible[index].node.id)
            } else if (event.key === 'ArrowRight') {
                if (node.children.length > 0) {
                    action = collapsed.has(node.id) ? () => toggle(node) : () => select(node.children[0].id)
                }
            } else if (event.key === 'ArrowLeft') {
                if (node.children.length > 0 && !collapsed.has(node.id)) action = () => toggle(node)
                else if (parent) action = () => select(parent)
            } else if (REVEAL_KEYS.includes(event.key)) {
                // Tab-focused count and disclosure buttons keep their native action.
                const focused = root.current?.ownerDocument.activeElement
                if (focused?.tagName === 'BUTTON' && root.current?.contains(focused)) {
                    const button = focused as HTMLButtonElement
                    action = () => button.click()
                } else {
                    action = () => activate(node)
                }
            } else if (event.key === 'p') {
                action = () => { void openDeckPreview(node.rule, TAGNAME.ALLTAG, node.label) }
            } else if (event.key === 'd' && node.due > 0) {
                action = () => { void openDeckPreview(node.rule, TAGNAME.STUDY, node.label) }
            }
            if (!action) return
            event.preventDefault()
            event.stopPropagation()
            if (!event.repeat || move) action()
        }
        const onKeyUp = (event: KeyboardEvent) => {
            if ((event.target as HTMLElement | null)?.closest?.('.obsidanki-activity')) return
            if (selected && REVEAL_KEYS.includes(event.key) && paneKeysActive(root.current, event)) {
                event.preventDefault()
            }
        }
        keyWindow.addEventListener('keydown', onKeyDown, true)
        keyWindow.addEventListener('keyup', onKeyUp, true)
        return () => {
            keyWindow.removeEventListener('keydown', onKeyDown, true)
            keyWindow.removeEventListener('keyup', onKeyUp, true)
        }
    }, [visible, selectedIndex, collapsed, onStudy, onCollapsedChange])

    const renderNode = (node: DeckTreeNode, depth = 0): React.ReactNode => {
        const isExpanded = !collapsed.has(node.id)
        const childrenId = `${treeId}-${encodeURIComponent(node.id)}`
        return <li key={node.id}>
            <div
                className={'obsidanki-start-row obsidanki-tree-row'
                    + (node.kind === 'folder' ? ' is-folder' : ' is-note')
                    + (selected?.node.id === node.id ? ' is-selected' : '')}
                data-tree-id={node.id}
                style={{ '--obsidanki-tree-depth': depth } as React.CSSProperties}
                onFocus={() => setSelectedId(node.id)}
                ref={element => {
                    if (element) rowElements.current.set(node.id, element)
                    else rowElements.current.delete(node.id)
                }}
            >
                {node.children.length > 0 ? <button
                    type="button"
                    className="obsidanki-tree-toggle"
                    ref={isExpanded ? expandedChevron : collapsedChevron}
                    aria-expanded={isExpanded}
                    aria-controls={childrenId}
                    aria-label={String(i18n.t(isExpanded ? 'TreeCollapse' : 'TreeExpand', { name: node.label }))}
                    onClick={() => toggle(node)}
                /> : <span className="obsidanki-tree-spacer" aria-hidden="true" />}
                <button
                    type="button"
                    className="obsidanki-start-go obsidanki-tree-name"
                    title={String(i18n.t(node.due > 0 ? 'TreeStudy' : 'TreeBrowse', { name: node.label }))}
                    onClick={() => activate(node)}
                >
                    <span className="obsidanki-tree-icon" ref={node.kind === 'folder' ? folderIcon : noteIcon} aria-hidden="true" />
                    <span className="obsidanki-start-label">{node.label}</span>
                </button>
                <div className="obsidanki-tree-counts">
                    {node.due > 0 ? <button
                        type="button"
                        className="obsidanki-start-count obsidanki-tree-due"
                        aria-label={String(i18n.t('TreeDueList', { name: node.label, count: node.due }))}
                        title={String(i18n.t('TreeDueList', { name: node.label, count: node.due }))}
                        onClick={() => { void openDeckPreview(node.rule, TAGNAME.STUDY, node.label) }}
                    >{node.due}</button> : <span className="obsidanki-tree-zero">0</span>}
                    <span className="obsidanki-tree-slash" aria-hidden="true">/</span>
                    <button
                        type="button"
                        className="obsidanki-start-count obsidanki-tree-total"
                        aria-label={String(i18n.t('TreeAllList', { name: node.label, count: node.total }))}
                        title={String(i18n.t('TreeAllList', { name: node.label, count: node.total }))}
                        onClick={() => { void openDeckPreview(node.rule, TAGNAME.ALLTAG, node.label) }}
                    >{node.total}</button>
                </div>
            </div>
            {node.children.length > 0 && <ul id={childrenId} className="obsidanki-tree-children" hidden={!isExpanded}>
                {isExpanded && node.children.map(child => renderNode(child, depth + 1))}
            </ul>}
        </li>
    }

    return <div
        className="obsidanki-ui obsidanki-start obsidanki-tree"
        ref={root}
        style={{ '--obsidanki-tree-count-digits': countDigits, '--obsidanki-tree-levels': maxDepth } as React.CSSProperties}
    >
        {nodes.length === 0 && <div className="obsidanki-start-status">{i18n.t('StartNoCards')}</div>}
        {caughtUp && <div className="obsidanki-start-status">
            {i18n.t('StartCaughtUp')}
            {next && <span className="obsidanki-start-next">{i18n.t('StartNextDue', { interval: formatInterval(next) })}</span>}
        </div>}
        {nodes.length > 0 && <ul className="obsidanki-tree-roots" aria-label={String(i18n.t('TreeLabel'))}>
            {nodes.map(node => renderNode(node))}
        </ul>}
        <LearningHeatmap />
    </div>
}
