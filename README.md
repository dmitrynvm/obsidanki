# Obsidanki

Obsidanki turns the notes in your Obsidian vault into spaced-repetition flashcards and reviews them on an Anki-style screen: see the prompt, reveal the answer, then grade it **Again / Hard / Good / Easy**, mostly from the keyboard. Plain `word :: definition` vocabulary lines need no markup; explicit `#Q` blocks add multi-line and cloze cards. Decks follow your folder and note tree, intervals are scheduled to the minute, and review history stays in a local database file. Obsidanki is a fork of [aosr](https://github.com/linanwx/aosr) by linanwx.

**Requirements**

- Obsidian **1.7.2** or later, on desktop and mobile.
- On iOS and iPadOS, full styling needs **iOS 16.4** or later: the styles use `@property`, `color-mix()` and container queries.

# Installation

Obsidanki is not listed in the Obsidian community plugin directory. Install it with BRAT or manually.

## BRAT

1. Install and enable the **BRAT** community plugin.
2. Run **Add beta plugin** from BRAT and enter `dmitrynvm/obsidanki`.
3. Enable **Obsidanki** under **Settings → Community plugins**.

BRAT keeps Obsidanki updated to the latest release.

## Manual

1. Download `main.js`, `manifest.json` and `styles.css` from the [latest release](https://github.com/dmitrynvm/obsidanki/releases).
2. Copy them into `<vault>/.obsidian/plugins/obsidanki/`.
3. Reload Obsidian, then enable **Obsidanki** under **Settings → Community plugins**.

# Coming from aosr

Obsidanki is a separate plugin with its own plugin id `obsidanki`, database `obsidanki.db` and `%%OBSIDANKI/...%%` card IDs. Notes in the `#Q`, `::`, `:::`, `?` and `==` formats work unchanged, but aosr review history and card IDs are not imported: cards start as new and receive Obsidanki IDs, and existing aosr IDs are not read. Embedded deck rules must use the `obsidanki-deck-config` code block name. Disable aosr after switching so the two plugins don't both write IDs into the same `#Q` blocks.

# Changelog

### 2.0.0

First Obsidanki release.

- **Deck tree.** The main screen is a **folder → subfolder → note** tree matching the vault's paths, with live **due/total** counts. Folder expansion is saved and restored across navigation and restarts. Separate review categories and the **Show Hard Cards** toggle are removed.
- **Plain-note vocabulary.** Non-excluded Markdown notes without `#Q` blocks contribute `::` and `:::` lines directly, without IDs being written into the note.
- **Learning activity** calendar below the tree: daily reviews, yearly totals, active days and a year selector.
- **Anki-style reviewer.** Reveal the answer, then grade **Again / Hard / Good / Easy**; each grade shows its next interval. The answer is hidden until revealed (clozes show `[…]`). Only the card and the answer bar are on screen; the progress bar, toolbar and file context are gone.
- **Keys.** `Space`/`Enter` reveals, then grades **Good**; `h` `j` `k` `l` or `1`–`4` grade; `s` skips; `o`/`O` open the source; `q`/`Esc` go back. A click in the card area reveals, then grades **Easy**.
- **In-tab navigation.** The tree, card lists, card previews and study share one Obsidanki tab, navigated with Obsidian's **Back / Forward** arrows.
- One minimal, theme-based style across the tree, reviewer, previews, deck rule builder and settings. The interface is English-only.
- Removed: the **Waiting Timeout Baseline**, **Hide Context**, **Migrate Data** and **Convert Card ID Format** settings; experimental Word TTS; legacy ID formats, embedded-note schedules and migration tools.
- Minimum Obsidian version is now 1.7.2.
- The production bundle is minified: `main.js` is about 1.1 MB instead of about 3.9 MB.
- Commands are **Open decks** and **Open deck rule builder** (ids `open-decks` and `open-deck-builder`; rebind any hotkeys set for the old commands). Setting names use sentence case, and the settings tab no longer has its own heading.
- The default database location is derived from the vault's configuration folder (`<config folder>/obsidanki.db`, normally `.obsidian/obsidanki.db`). Saved database paths keep working.
- If saving a grade fails, a notice reports the error and the card stays on screen; grading it again is safe.

Earlier versions: see the [aosr release history](https://github.com/linanwx/aosr/releases).

# Features

- **Rich content**: cards render Markdown, including images, audio and video embeds.
- **Opens in a tab**: review in a regular Obsidian tab while editing notes beside it.
- **Minute-level intervals**: reviews are scheduled to the minute, not the day.
- **Three pattern types**: single-line (one-way or reversed), multi-line and cloze deletion.
- **Mobile**: on phones, controls are at least 44px tall and keyboard hints are hidden.
- **Decks**: the vault's folder tree, plus custom rule-based decks embedded in notes, with a builder that writes the rule for you.
- **Clean tags**: explicit card IDs are hidden comments, so they stay out of the tag pane and graph view. Plain vocabulary notes need no markers.

# Format

## Plain vocabulary

A non-excluded Markdown note without explicit `#Q` blocks can contain `word :: definition` or bidirectional `word ::: definition` lines directly, using the configured one-line delimiters. YAML frontmatter, headings, fenced and indented code, and hidden comments are ignored; lines containing a delimiter inside an inline code span are skipped.

Plain notes are indexed and studied without inserting IDs or rewriting their text. Identity combines the note path with the question and its duplicate occurrence. Editing answers or adding lines preserves schedules; moving or renaming the note, changing a question, or reordering identical questions can change identities and reset those cards.

If a note contains explicit `#Q` blocks, only their ranges are indexed; unmarked vocabulary outside them is ignored. Multi-line and cloze patterns always require explicit blocks.

## Card

An explicit block card begins with a line starting with `#Q` and runs to the next Markdown heading, the next `#Q`, or the end of the note. Use `#/Q` to close it explicitly. `#Q` is case-sensitive.

```
#Q
This is a card.
Write questions and answers in one of the pattern formats below.
Only content inside the block is reviewed.
```

A card contains one or more **patterns**, each a question and its answer. A vocabulary card, for example, can hold many `::` lines, one pattern per line.

Use `***` on its own line to split a card into sub-cards without writing another `#Q`:

```
#Q
Card1
***
Card2
```

This is equivalent to:

```
#Q
Card1

#Q
Card2
```

With **Allow empty line as a splitter** turned on, an empty line also splits sub-cards.

### Range cards

A range card begins with `#Q` and ends with `#/Q`, bounding the review content explicitly, independent of headings:

```markdown
#Q
...
(blank line)
...
#/Q
```

Patterns follow their usual rules inside range cards. A multi-line pattern cannot contain blank lines, so a range card can hold several multi-line patterns separated by blank lines. For a cloze, the question (the remaining text) spans the whole card or sub-card, which suits a longer question with a cloze answer; use `#multicloze` to hide several parts of the answer together. Very complex answers are usually better split into smaller cards.

## Pattern

### :: pattern

`::` splits a line: the part before it is the question, the part after it the answer. Each line is a separate pattern.

```
word::definition
word::definition
```

`:::` creates a card reviewed in both directions, question → answer and answer → question:

```
word:::definition
```

### ? pattern

A line containing only `?` splits the lines above (question) from the lines below (answer):

```
Question.
Maybe there are many lines.
?
Answer.
Maybe there are many lines.
```

### == pattern

A `==highlight==` becomes a cloze: the rest of the text is the question, the highlighted part the answer. Each cloze is a separate pattern:

```
Fruits include ==watermelons==, ==apples== and ==pears==.
```

To review them together, highlight them as one cloze:

```
Fruits include ==watermelons, apples, and pears==.
```

or add the `#multicloze` tag.

#### Multicloze pattern

If a card (or sub-card) contains `#multicloze`, all its clozes are hidden and revealed as one pattern:

```
You should remember ==this== and ==that== at the same time. #multicloze
```

## Example

```
#Q
word1::ans1
word2::ans2
word:::definition

#Q
This is a question1.
?
This is an answer.
***
This is a question2.
?
This is an answer.

#Q
This is a very ==important== answer.

#Q
word1::ans1
***
This is a question.
?
This is an answer.
***
This is a very ==important== answer.
***
This is multi-cloze ==question== and ==answer==. #multicloze

#Q

Information

Complex card information

Answer:
==The answer.==

#/Q
```

# Using AI to create cards

AI assistants can turn study material into Obsidanki cards. Give the assistant the format, your material and your requirements, for example:

```
I need flashcards for the Obsidanki plugin for Obsidian.

CARD FORMAT:
- Plain vocabulary notes can use :: and ::: without #Q; if #Q is used, only marked ranges are processed
- A block card begins with #Q and ends at the next heading, the next #Q, or the end of the note
- For cards with empty lines, use #Q ... #/Q (range cards)
- Use *** to split into sub-cards within one #Q block

PATTERN FORMATS (question-answer pairs):
1. Single-line: word::definition (use ::: for bidirectional cards)
2. Multi-line: question lines, then a line containing only ?, then answer lines
3. Cloze: This is ==important== content. Add #multicloze to group all clozes in a card.

EXAMPLES:
#Q
word1::definition1
word2::definition2

#Q
What is the capital of France?
?
Paris is the capital of France.

#Q
The ==Eiffel Tower== is located in ==Paris==. #multicloze

My study material:
[Your content here]

Requirements:
- Front: the key term and the sentence containing it
- Back: definition, part of speech and two example sentences
- Use the multi-line (?) format

Output Obsidanki-formatted cards I can paste into Obsidian.
```

A typical answer, from a Norwegian text:

```markdown
#Q
**kjent**
Norge er kjent som et vakkert land.
?
**Meaning:** known, famous
**Part of speech:** adjective
**Examples:**
1. Han er kjent for sin vennlighet. (He is known for his kindness.)
2. Dette er et kjent problem. (This is a well-known problem.)

#Q
**fjorder**
Du kan se vakre fjell, dype fjorder, varme strender.
?
**Meaning:** fjords (narrow inlets of sea between cliffs)
**Part of speech:** noun (plural)
**Examples:**
1. Norges fjorder er verdenskjente. (Norway's fjords are world-famous.)
2. Vi seilte gjennom fjordene. (We sailed through the fjords.)
```

# Review

Click the **Obsidanki** ribbon icon or run **Obsidanki: Open decks** from the command palette. Both open the deck tree in an Obsidanki tab, or return an existing Obsidanki tab to the tree, including from a preview or review.

## Deck tree

The tree follows the vault's exact **folder → subfolder → note** hierarchy. `Course/English/...` appears under **Course → English**, while `Vocab/English/...` stays under **Vocab → English**; equal folder names in different locations are never merged. Root-level notes appear at the top level. Only notes with included cards and their ancestor folders are shown.

Each row shows **due/total**, rolled up from every note beneath it:

- Click the chevron to collapse or expand a branch. New branches start expanded; changes are saved per vault and restored after navigation and restarts.
- Click the name to study that branch: due reviews, then cards being relearned, then new cards. With nothing due, the name opens the list of all its cards.
- Click the **due** number to list the cards in that queue without grading.
- Click the **total** number to browse every card in the branch without grading.

When nothing is due, **All caught up** and the time until the next review appear. An empty library shows **No cards**.

| Key | Action |
|---|---|
| `j` / `k` or `↓` / `↑` | Move between visible rows |
| `→` | Expand a branch, then move to its first child |
| `←` | Collapse a branch, or move to its parent |
| `Space` / `Enter` | Study the selected row, or browse it when nothing is due |
| `d` | List its due cards |
| `p` | List all its cards |

## Learning activity

**Learning activity** appears below the tree. It shows the current calendar year, with earlier recorded years in the year selector, the year's review total and its number of active days. Each completed **Again / Hard / Good / Easy** grade counts once, in local calendar days, including new cards and relearning; revealing, skipping, browsing and inserting card IDs do not count. Daily shades represent **0**, **1–4**, **5–9**, **10–19** and **20+** reviews.

Wide panes show the year as one strip of weeks; narrow panes stack January–June above July–December. Rows run Monday to Sunday. Click or focus a day to show its date and review count. `Tab` enters the calendar at today; arrow keys move by day (vertically) and week (horizontally), `Home`/`End` to the start/end of the week, and `Ctrl+Home`/`Ctrl+End` to the year's first/last elapsed day.

Activity tracking starts with Obsidanki 2.0.0; earlier activity is not reconstructed from schedules. Counts are vault-wide, are stored in `obsidanki.db` and remain if notes are later excluded or removed. Grades made in embedded rule decks count too.

## Card lists

Lists open in the same Obsidanki tab, titled with the selected branch or note, 20 cards per page. Use the arrows or the **X of Y** page selector to change pages. **Search** matches questions and answers across the whole list, ignoring case; changing the search returns to page 1.

Click a row, or focus it and press `Enter` / `Space`, to open the card. **Show** reveals the answer and **Next** continues without grading. Hover or focus a row to show its **Source** arrow, which opens the note and selects the card's definition. You can also hold the **Source navigation modifier** (Command on macOS, Control elsewhere) and click a row, or press the modifier with `Space` on a focused row. Choose the modifier in **Settings → Obsidanki → Source navigation modifier**; if macOS reserves Command+Space for Spotlight, choose another.

While viewing a card, `Space` / `Enter` reveals the answer, then advances; `s` skips; `q` / `Esc` returns to the list; `o` / `O` opens the current / previous card's source. In the list, `q` / `Esc` returns to the tree. Browsing never changes schedules.

Use Obsidian's header **Back / Forward** arrows to move between the tree, lists, cards and study. Back restores a list's search and page. Going Forward into a study session you left reloads its remaining queue from saved schedules without replaying completed grades.

## Reviewer

Studying shows each card's question. Reveal the answer, then grade how well you recalled it; the interval above each grade is when the card comes back.

| Key | Action |
|---|---|
| `Space` / `Enter` | **Show** (reveal the answer), then grade **Good** |
| `h` `j` `k` `l` or `1`–`4` | **Again**, **Hard**, **Good**, **Easy** |
| `s` | Skip the card |
| `o` / `O` | Open the current / previous card in its note |
| `q` / `Esc` | Back to the deck tree |

A primary click in the card area reveals the answer, then grades **Easy**. Selecting text, clicking links or embedded controls, and modified clicks keep their normal behavior. A card cannot be graded twice by rapid clicks or keys. If saving a grade fails, a notice reports the error and the card stays on screen; grading it again is safe.

Keys act only in the focused Obsidanki tab, never while typing or in a dialog; `Ctrl`/`Alt`/`Cmd` combinations keep their usual behavior. When the queue is finished, the tree reappears. Leaving a card never grades it.

# Settings

| Setting | Default | Description |
|---|---|---|
| **Initial ease** | 250 | Baseline growth of review intervals; see below. |
| **Easy choice bonus** | 1 | Days added when you grade **Easy**. |
| **Hard choice bonus** | 1 | Days subtracted when you grade **Again**. |
| **Source navigation modifier** | Command on macOS, Control elsewhere | Modifier for opening a list row's source definition. |
| **Database path** | `<config folder>/obsidanki.db`, normally `.obsidian/obsidanki.db` | Review data file, relative to the vault root. Takes effect after reloading Obsidian. |
| **Exclude patterns** | (empty) | Notes that are not scanned for cards. |
| **Multi-line delimiter** | `?` | Separates question and answer in multi-line patterns. |
| **One-line delimiter** | `::` | Separates question and answer in one-line patterns. |
| **One-line reversed delimiter** | `:::` | One-line patterns reviewed in both directions. |
| **Allow empty line as a splitter** | off | Split sub-cards at empty lines as well as `***`. |

## Ease and bonuses

The defaults work well in most cases. Intervals are based on the time since a card's last review and its ease, which starts from **Initial ease** and adapts to your recent grades. With an ease of 250 and a card last reviewed 2 days ago:

- **Good** multiplies the interval by 2.5: about 5 days.
- **Easy** also adds the **Easy choice bonus**: about 6 days.
- **Hard** divides by 2.5: about 0.8 days.
- **Again** divides by 2.5 and subtracts the **Hard choice bonus**, bringing the card back sooner.

Intervals vary by up to ±5% so cards spread out. If you review too much every day, raise the easy choice bonus to 2 or 3. To see forgotten cards sooner, raise the hard choice bonus. Change the initial ease only to shift all cards, usually within 200–300.

## Excluding files

To stop Obsidanki from scanning some notes (templates, archives, drafts), list them in **Settings → Obsidanki → Exclude patterns**, one pattern per line:

```
Archive/
**/Templates/**
Notes/Todo.md
```

- Paths are written from the vault root, without a leading `/`. `Archive/` excludes the top-level `Archive` folder only; use `**/Archive/**` for a folder with that name anywhere.
- A line matches any path that starts with it, or that matches it as a glob (`*` within one folder level, `**` across levels). `Arch` would also exclude `Architecture/`, so end folder names with `/`.
- Matching is case-sensitive. Leading and trailing spaces are ignored.
- Changes apply when you close settings: open deck trees refresh, while a running study session continues unchanged.

# Decks

Besides the folder tree, you can define your own decks with rules, for example by tag or path. Rules use [json-rules-engine](https://github.com/CacheControl/json-rules-engine) and are written in an `obsidanki-deck-config` code block in any note, which renders as a deck.

## Deck rule builder

Run **Obsidanki: Open deck rule builder** from the command palette to open the **Deck rule builder**:

- Add one or more conditions. Each picks a source (**Card** or **File**), a field (file path, card tags, card text, headings, or frontmatter tags), an operator (matches regex, contains, equals; equals is not offered for tag fields) and a value.
- Choose how conditions combine: **all**, **any**, or **none** (exclude matching cards).
- The builder shows live how many of your cards match.
- **Insert into note** adds the `obsidanki-deck-config` block to the active note; **Copy code block** copies it.

Write the rule by hand for anything the builder can't express.

## Rule examples

1. Cards whose note path matches a keyword:

`````
```obsidanki-deck-config
{
	"rule": {
		"conditions": {
			"all": [{
				"fact": "card",
				"operator": "regexMatch",
				"value": "KEYWORD",
				"path": "$.path"
			}]
		},
		"event": {
			"type": "match"
		}
	}
}
```
`````

2. Cards whose path does not match a keyword:

`````
```obsidanki-deck-config
{
	"rule": {
		"conditions": {
			"not": {
				"fact": "card",
				"operator": "regexMatch",
				"value": "KEYWORD",
				"path": "$.path"
			}
		},
		"event": {
			"type": "match"
		}
	}
}
```
`````

3. Cards with a tag, such as `#math` in `#Q a^2 + b^2 = ? :: c^2 #math`:

`````
```obsidanki-deck-config
{
	"rule": {
		"conditions": {
			"all": [{
				"fact": "card",
				"operator": "contains",
				"value": "#math",
				"path": "$.tags"
			}]
		},
		"event": {
			"type": "match"
		}
	}
}
```
`````

4. Notes with a tag in their frontmatter:

`````
```obsidanki-deck-config
{
	"rule": {
		"conditions": {
			"all": [{
				"fact": "file",
				"path": "$.tags",
				"operator": "regexMatch",
				"value": "mathematics"
			}]
		},
		"event": {
			"type": "match"
		}
	}
}
```
`````

Rules can combine conditions further; see the [json-rules-engine documentation](https://github.com/CacheControl/json-rules-engine). Besides the built-in operators, Obsidanki provides `regexMatch`, and `contains` also matches substrings of text fields. The facts available to rules are:

```
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
```

## Using decks in notes

Paste a rule block into any note. When the cursor is outside the block, or in reading view, it renders as a deck with **Study** and **Browse** buttons and their counts. Studying happens inside the note; the counts open card lists in an Obsidanki tab. Embedded decks are mouse-only.

If the block doesn't render as a deck:

- The block must start with ` ```obsidanki-deck-config ` and end with ` ``` `.
- Check for extra backticks at the beginning or end, which can appear when copying from GitHub.
- The content must be valid JSON; an error message is shown in place of the deck otherwise.

# Card IDs

Obsidanki stores block-card IDs as Obsidian comments so it can find their review data:

```
#Q %%OBSIDANKI/abc123%%
word::definition
```

Obsidanki adds the ID to a `#Q` block when one of its cards is first shown in a study session. Multi-line and cloze patterns also get their own ID comment, such as `? %%OBSIDANKI/abc123/m/f00d%%`. Single-line patterns get none: their IDs derive from the text before the delimiter and its occurrence within the card block, so editing the answer preserves review history and duplicate questions stay distinct.

Comments are hidden in reading view; in the editor Obsidanki shows them as a small 🏷 badge. They don't appear in the tag pane or graph view. Don't edit or delete these IDs, or the card loses its review history.

# Review data

Review history and learning activity are stored only in `obsidanki.db`, in the vault's configuration folder by default (normally `.obsidian/obsidanki.db`). To use another location, set **Settings → Obsidanki → Database path** and reload Obsidian; the existing file is not moved. Include both the database and your notes in backups and synchronization.

# Dataview

With the Dataview plugin, you can query your review data. `await app.plugins.plugins.obsidanki.api.getAllPattern()` returns every pattern with its schedule. Enable **JavaScript queries** in Dataview's settings to use `dataviewjs`:

`````
```dataviewjs
let patterns = await app.plugins.plugins.obsidanki.api.getAllPattern();

let today = new Date();
today.setHours(0, 0, 0, 0);

let futureLimit = new Date();
futureLimit.setDate(today.getDate() + 15); // 15 days from today

let reviewCountsByDate = {};

patterns.forEach(pattern => {
    let nextReviewDate = new Date(pattern.schedule.Next);

    if (nextReviewDate < today) {
        nextReviewDate = today;
    }

    if (nextReviewDate <= futureLimit) {
        nextReviewDate.setHours(0, 0, 0, 0);
        let dateStr = nextReviewDate.toISOString().split('T')[0];
        if (!reviewCountsByDate[dateStr]) {
            reviewCountsByDate[dateStr] = 0;
        }
        reviewCountsByDate[dateStr]++;
    }
});

let tableData = Object.entries(reviewCountsByDate)
    .map(([date, count]) => [date, count])
    .sort((a, b) => new Date(a[0]) - new Date(b[0])); // Sort by date

dv.header(3, "Total amount of Review");
dv.table(["Count"], [[patterns.length]])

dv.header(3, "The amount of daily Review required in the future");
dv.table(["Date", "Review Count"], tableData);

let difficultPatterns = patterns
    .map(pattern => [pattern.TagID.substring(1), pattern.schedule.Ease])
    .sort((a, b) => a[1] - b[1]) // Sort by Ease
    .slice(0, 10); // Take only the first 10
dv.header(3, "The most difficult content in terms of review")

dv.table(["TagID", "Ease"], difficultPatterns);
```
`````

> The `::` card format overlaps with Dataview's inline field syntax (`key:: value`), so Dataview may also read card lines as metadata.

# Compared with obsidian-spaced-repetition

Obsidanki is similar to [obsidian-spaced-repetition](https://github.com/st3v3nmw/obsidian-spaced-repetition), with some differences:

- Review times are calculated in minutes, not days, so reviews around midnight are not rounded into the previous or next day.
- Review opens in a regular tab instead of a pop-up, so you can edit notes while reviewing.
- Cards you forget go through a short relearning step before returning to normal reviews.
- Clozes are identified independently, so adding a new cloze doesn't disturb existing ones.

# Precautions

- Avoid identical multi-line or cloze patterns within the same card block. Single-line duplicates are distinguished by their occurrence within the block.
- Development and testing use Obsidian's **Strict line breaks** setting turned off; turning it on is untested.

# Credits

Obsidanki is based on [aosr](https://github.com/linanwx/aosr) by [linanwx](https://github.com/linanwx), released under the MIT license.

Thanks to the aosr contributors, especially [Aliaksei Rusetski](https://github.com/AliakseiRusetski) for major contributions in aosr 1.1.6 ([PR #50](https://github.com/linanwx/aosr/pull/50)), and [RethinkWu](https://github.com/RethinkWu) for the deck rule builder and card preview in aosr 1.2.0 ([PR #63](https://github.com/linanwx/aosr/pull/63)).

# License

MIT; see [`LICENSE`](LICENSE). Licenses of the bundled third-party packages are listed in [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).
