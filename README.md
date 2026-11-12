# Obsidanki

Obsidanki is an Obsidian plugin for spaced-repetition flashcards. You write cards in your notes, for example as `word :: definition` lines, and review them on an Anki-style screen: see the question, reveal the answer, then grade it **Again**, **Hard**, **Good** or **Easy**. Decks follow your vault's folders and notes. Intervals are scheduled to the minute, and review history is kept in a local database file.

## Why a fork

Obsidanki is a fork of [aosr](https://github.com/linanwx/aosr) by [linanwx](https://github.com/linanwx). It keeps aosr's card formats and scheduler and changes the user experience:

- **Vi-like keys.** `h` `j` `k` `l` grade a card, `j`/`k` move through the deck tree, `q` goes back and `o` opens the card's note. You can study and browse without touching the mouse.
- **Review calendar.** A heatmap of daily reviews for the year, like the heatmap add-ons for Anki, shown below the deck tree.
- **Anki-style reviewer.** The screen shows only the card and the four grades, each labelled with its next interval. The answer stays hidden until you reveal it.
- **Deck tree.** Folders and notes appear as an expandable tree with due/total counts. Plain vocabulary notes work without any markup.

## Installation

Requires Obsidian 1.7.2 or later, on desktop or mobile (iOS 16.4 or later for full styling). Obsidanki is not listed in the community plugin directory, so install it in one of two ways:

- **BRAT:** install the BRAT plugin, run **Add beta plugin** and enter `dmitrynvm/obsidanki`. BRAT keeps the plugin updated.
- **Manually:** download `main.js`, `manifest.json` and `styles.css` from the [latest release](https://github.com/dmitrynvm/obsidanki/releases) into `<vault>/.obsidian/plugins/obsidanki/`, then reload Obsidian.

Then enable **Obsidanki** under **Settings → Community plugins**.

## Writing cards

**Plain vocabulary.** In a note without `#Q` blocks, every `word :: definition` line is a card, and `word ::: definition` is reviewed in both directions. Frontmatter, headings, code and comments are ignored. Obsidanki doesn't write anything into these notes; a card's identity comes from the note path and the question, so renaming the note or changing the question resets that card's schedule.

**Blocks.** A line starting with `#Q` begins a card block that runs to the next heading, the next `#Q` or the end of the note; `#/Q` ends it explicitly, which allows blank lines inside. `***` on its own line splits a block into sub-cards. If a note contains any `#Q` block, only its blocks are reviewed. Multi-line and cloze cards need a block:

```
#Q
word::definition
word:::definition (reversed too)
***
Question, possibly
on several lines
?
Answer
***
Fruits include ==apples== and ==pears==.
***
Remember ==this== and ==that== together. #multicloze
```

Each `==highlight==` is a separate cloze card unless the sub-card has `#multicloze`. Obsidanki stores block IDs as hidden comments (`%%OBSIDANKI/…%%`, shown as a 🏷 badge in the editor); don't edit them, or the card loses its history. Avoid identical multi-line or cloze cards in the same block.

## Reviewing

Click the ribbon icon or run **Obsidanki: Open decks**. The main screen shows **Dictionary**, the deck tree with due/total counts, and **Timeline**, the review calendar. Click a name to study it, the due count to list due cards, or the total to browse every card without grading. Back and Forward in the tab header move between the tree, lists and study.

| Where | Key | Action |
|---|---|---|
| Tree | `j` / `k`, `↓` / `↑` | Move between rows |
| Tree | `←` / `→` | Collapse / expand, or go to parent / child |
| Tree | `Space` / `Enter` | Study the row (browse it if nothing is due) |
| Tree | `d` / `p` | List due cards / all cards |
| Study | `Space` / `Enter` | Reveal, then grade **Good** |
| Study | `h` `j` `k` `l` or `1`–`4` | **Again**, **Hard**, **Good**, **Easy** |
| Study | `s` | Skip |
| Study, lists | `o` / `O` | Open the current / previous card's note |
| Anywhere | `q` / `Esc` | Back |

Clicking the card reveals the answer, and a second click grades **Easy**. Keys work only in the focused Obsidanki tab and never while you type. In card lists, **Search** filters questions and answers, and modifier-click on a row (Command on macOS, Control elsewhere) opens its definition in the note.

The calendar counts each grade on its local day; revealing, skipping and browsing don't count. Press `Tab` to enter it at today, then use the arrow keys to move by day or week.

## Settings

| Setting | Default | Meaning |
|---|---|---|
| Initial ease | 250 | Starting interval growth: at 250, **Good** multiplies the time since the last review by 2.5 and **Hard** divides it by 2.5 |
| Easy choice bonus | 1 | Days added on **Easy** |
| Hard choice bonus | 1 | Days subtracted on **Again** |
| Source navigation modifier | Command / Control | Modifier for opening a list row's source |
| Database path | `.obsidian/obsidanki.db` | Review history and calendar data; reload Obsidian after changing it |
| Exclude patterns | (empty) | Paths not scanned, one per line from the vault root: `Archive/`, `**/Templates/**`, `Notes/Todo.md` |
| Multi-line / one-line / reversed delimiter | `?` / `::` / `:::` | Card syntax |
| Allow empty line as a splitter | off | Empty lines split sub-cards like `***` |

Back up and sync the database together with your notes.

## Rule decks

Besides the folder tree, a note can embed a deck defined by a [json-rules-engine](https://github.com/CacheControl/json-rules-engine) rule. **Obsidanki: Open deck rule builder** writes the rule for you; for example, all cards tagged `#math`:

````
```obsidanki-deck-config
{
	"rule": {
		"conditions": {
			"all": [{ "fact": "card", "operator": "contains", "value": "#math", "path": "$.tags" }]
		},
		"event": { "type": "match" }
	}
}
```
````

Facts are `card.path`, `card.tags`, `card.text`, `card.outline` and the frontmatter `file.tags`. Besides the built-in operators, `regexMatch` is available. For Dataview, `app.plugins.plugins.obsidanki.api.getAllPattern()` returns every card with its schedule.

## Coming from aosr

Obsidanki is a separate plugin with its own id, database and card IDs. Notes in aosr's formats work unchanged, but aosr's review history and IDs are not imported, so cards start as new. Rename `aosr-deck-config` blocks to `obsidanki-deck-config`, and disable aosr so the two plugins don't both write IDs into the same blocks.

## License

MIT; see [LICENSE](LICENSE). Licenses of bundled third-party packages are included at the end of `main.js`. Thanks to linanwx and the aosr contributors, especially [Aliaksei Rusetski](https://github.com/AliakseiRusetski) and [RethinkWu](https://github.com/RethinkWu).
