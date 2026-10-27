# Obsidanki

Obsidanki is an Obsidian flashcard plugin with an Anki-style review screen, based on the [original plugin](https://github.com/linanwx/aosr).

It uses flashcards to help remember knowledge.

This plugin is similar to [spaced repetition](https://github.com/st3v3nmw/obsidian-spaced-repetition), but some changes have been made according to personal habits.

# What's New

### Obsidanki review screen

- The main screen is a **folder → subfolder → note** tree matching the vault's paths. Folder expansion is saved automatically and restored across navigation and Obsidian restarts; new branches start expanded. Every level uses the same indentation step, adapting to narrow panes and deep paths. Folder/note icons, elbow guides and full-width hover/focus rows clarify the hierarchy; live **due/total** counts align in fixed columns. Click the name to study that branch, the due count to inspect its queue, or the total to browse all its cards without grading. Embedded rule decks retain their mouse-only Study/Browse menu. Separate review categories and the **Show Hard Cards** toggle are removed; existing preview scopes and review history are preserved.
- Non-excluded Markdown notes without `#Q` blocks now contribute plain `::` and `:::` vocabulary to the tree. Changing exclusions refreshes open main trees when settings close, without interrupting a study session.
- A **Learning activity** calendar sits below the tree: daily review intensity, yearly review totals, active days, and a year selector. Completed grades are counted in local calendar days and saved alongside schedules; browsing and skipping do not count.
- One minimal style across the start menu, reviewer, previews, deck builder and settings: the vault's reading font (`--font-text`, PT Mono in this vault), neutral controls, small corner radii, and unboxed key hints. No colored primary button or separate interface font. Counts open deck previews; keyboard selection uses a subtle tint and Tab shows a focus ring. Phone controls are at least 44px tall, with keyboard hints hidden.
- The entire extension interface is English-only, independent of Obsidian's language. Card and note content is unchanged.
- One decision per card: reveal the answer, then grade it **Again / Hard / Good / Easy**. Each button carries its key (`space`, `h` `j` `k` `l`), and each grade shows its next interval (`3h`, `2d`, `1.7mo`); cards being reinforced show learning progress instead, including within Study.
- Review buttons are quiet tinted tiles with the theme's small corner radius (`--radius-s`), no outline, and the label and key centred together; hover and press deepen the tint, keyboard focus shows an accent ring. Narrow panes use two columns; on phones the tiles are 44px tall and shortcut hints are hidden.
- Nothing but the card and the answer bar. The progress bar, toolbar, ease chip and file context are gone; their actions moved to keys.
- The answer is not shown at all until revealed (no blur). Clozes show `[…]`.
- List rows open cards directly. A separate external-link arrow opens the source definition; no Card icon is needed.
- Obsidian's header **Back / Forward** arrows navigate the tree, scoped lists, individual card previews and study in one tab. There is no extra back button inside a card.
- Card-area clicks reveal the answer, then grade **Easy**; `Space` / `Enter` reveals the answer, then grades **Good**. Rapid repeated clicks remain responsive and cannot grade the same card twice.
- Removed settings: **Waiting Timeout Baseline**, **Hide Context**, **Migrate Data** and **Convert Card ID Format**.
- Removed experimental Word TTS, including its URL setting and automatic pronunciation. Old TTS URLs are discarded when settings load.
- Current format only: comment-based block IDs or path-derived plain-note IDs, with database-backed review history. Legacy ID readers, embedded-note schedule readers, old hash adoption and migration tools are removed.
- Plugin id is `obsidanki`, with `obsidanki-*` views, commands and CSS classes, `%%OBSIDANKI/...%%` block-card IDs and `.obsidian/obsidanki.db` review history.

### 1.2.1

- Security update: upgraded `json-rules-engine` (and its `jsonpath-plus` dependency), `lodash` and `@babel/runtime`. No functional changes.

### 1.2.0

- **Card IDs no longer clutter your tags.** IDs use Obsidian comments (`%%OBSIDANKI/...%%`), so they stay out of the tag pane and graph view. See [Card IDs](#card-ids).
- **Deck Rule Builder**: build deck rules with a form instead of writing JSON. See [Deck Rule Builder](#deck-rule-builder).
- **Card preview**: click the count next to a review category to browse its cards and jump to them in your notes.
- **Review Ahead** and **All Contents (Random)** review modes.
- Fixes: reversed (`:::`) cards showed the wrong side in the preview; the `contains` rule operator didn't work on text fields such as `$.path`; jumping from the preview could land on an outdated position.

See the [upstream release history](https://github.com/linanwx/aosr/releases) for earlier versions.

# Thanks

Special thanks to [Aliaksei Rusetski](https://github.com/AliakseiRusetski) for major contributions in 1.1.6 ([PR #50](https://github.com/linanwx/aosr/pull/50)), and to [RethinkWu](https://github.com/RethinkWu) for the deck rule builder, card preview and new review modes in 1.2.0 ([PR #63](https://github.com/linanwx/aosr/pull/63)).

# Features

- **Rich Text Format Support**: The plugin supports rich text formats such as audio. This allows you to create multimedia flashcards for a more immersive learning experience.
- **Dedicated Review Window**: The plugin features a separate review window, allowing you to review cards while simultaneously making changes to them in the editor. This is perfect for making quick adjustments on the fly.
- **Minute-Level Review Intervals**: The plugin allows you to set review intervals down to the minute. This offers a high level of precision in scheduling your reviews.
- **Three Basic Learning Types**: The plugin supports three basic learning types - single line, multi-line, and cloze deletion.
- **Mobile Optimization for Review Interface:** The plugin now supports mobile devices, providing an optimized review interface specifically designed for mobile users. This ensures a seamless and user-friendly experience when reviewing cards on your mobile device.
- **Multi-language support**: Supports virtually all languages within Obsidian. Translated by ChatGPT.
- **Deck Functionality**: Obsidanki now includes a powerful Deck feature that allows you to manage your flashcards in a highly customizable manner. You can define your own rules to manage your decks, providing a tailored review experience. A built-in rule builder lets you create decks without writing JSON.
- **Clean Tags**: Explicit block IDs are stored as hidden comments, so they don't show up in your tag list or graph. Plain vocabulary notes need no markers.

# Demo

The demo shown below is from an earlier version. You can refer to its operation process. Some of the content has been optimized.

![屏幕录制2022-11-08 17 56 11](https://user-images.githubusercontent.com/16589958/200536163-9aa947ff-0898-40ec-ae6a-911fc9107098.gif)

# Format

## Plain vocabulary

A non-excluded Markdown note without explicit `#Q` blocks can contain `word :: definition` or bidirectional `word ::: definition` entries directly. The configured single-line delimiters apply. YAML frontmatter, headings, fenced/indented code and hidden comments are ignored; lines containing a delimiter inside an inline code span are skipped.

Plain notes are indexed and studied without inserting IDs or rewriting their text. Identity combines the note path with the question and its duplicate occurrence. Answer edits and unrelated additions preserve schedules; moving or renaming an unmarked note, changing a question, or reordering identical questions can change those identities.

If a note contains explicit `#Q` blocks, only their ranges are indexed; unmarked vocabulary outside them is ignored. Multi-line and cloze patterns still require explicit blocks.

## Card

An explicit block card begins with `#Q` and runs to the next Markdown heading, the next `#Q`, or the end of the note. Use `#/Q` to close it explicitly. `#Q` is case-sensitive.

```
#Q 
This is a card.
Here, please write your questions and answers in Pattern format. The format of Pattern is described below.
Only content inside the marked block will be treated as review content.
Pattern formats outside this range will not be processed.
```

In the card, the PATTERN is your question and answer. 

A card can contain multiple patterns. For instance, if you're studying a vocabulary list, your card could include several lines of :: style patterns, each pairing a word with its definition. In essence, you can think of a card as a text block within Obsidian, while a pattern is a question and its corresponding answer. A single text block can contain multiple questions and their respective answers.

Using `***` to split the card into sub-cards. This would be helpful if you don't want to write `#Q` and create a new card.

```
#Q
Card1
***
Card2
```

The effect of the above writing is the same as that of the following.

```
#Q
Card1

#Q
Card2
```

### Range Cards (Scope Cards)

Range Cards, also known as Scope Cards, are a special type of card in the Markdown format. They were introduced as a new feature to enhance the flexibility of creating flashcards.

A range card begins with `#Q` and ends with `#/Q`, explicitly bounding review content independently of headings and blank lines. For example:

```markdown
#Q
...
(blank line)
...
(blank line)
...
#/Q
```

Apart from this, Range Cards behave similarly to Block Cards in all other respects.

In the context of Range Cards, patterns still follow their usual rules. Notably, the multi-line pattern does not include complete blank lines. However, within Range Cards, you can create multiple multi-line patterns, each separated by blank lines. In the cloze deletion format, the question - that is, the remaining text - extends across the entire card.

This introduces some best practices for using Range Cards. 

1. **Creating Multiple Multi-line Question Groups**: You can leverage the format of Range Cards to create multiple multi-line patterns. These patterns can be individually grouped and separated by blank lines, providing you with a flexible way of organizing complex information. 

2. **Creating a Complex Question with a Cloze Deletion Answer**: If you're dealing with intricate topics, you can create a comprehensive question, and then use the cloze deletion format (`==`) to encapsulate the answer. If your answer spans multiple lines or you need to consider different sections as a whole answer, you may need to use the `#multicloze` tag to bundle multiple answers together.

Please be aware that if your answer is excessively complicated, involving many blank lines, you may need to reconsider your question structuring. Extremely complex answers may not be suitable for flashcard-based review.


## Pattern

A pattern represents a question and its corresponding answer.

### :: Pattern

In the card, `::` symbol is used to split a line. The front part will become a question, and the back part will become an answer.

```
word::definition
```

Each line will be processed as a separate Pattern.

```
word::definition
word::definition
word::definition
```

You can use the symbol `:::` to create cards that can be reviewed in both directions - from question to answer and from answer to question.

```
word:::definition
```


### ? Pattern

In the card, a line with a `?` will divide the content into a question and an answer. The front part will become a question, and the back part will become an answer.

```
Question.
Maybe there are many lines.
?
Answer.
Maybe there are many lines.
```

### == Pattern

In the card, a cloze with a pair of `==` will split this card. The remaining part will become a question, and the cloze part will become an answer. Note that each cloze will be treated as a separate Pattern.

```
A ==cloze==.
```

```
Fruits include ==watermelons==, ==apples== and ==pears==.
```

Note that each cloze will be treated as a separate Pattern. Otherwise, you should write like this.

```
Fruits include ==watermelons, apples, and pears==.
```

In addition, you could add a [#multicloze](#multicloze-pattern) tag to the card to get the same effect.

##### Multicloze Pattern

If a `#multicloze` tag has been found in the card, Obsidanki treats all cloze in the card as a group of cloze.

```
You should remember ==this== and ==that== at the same time. #multicloze 
```

# Example

Several examples are shown below. Their writing is valid in the document.

```
#Q
word1::ans1
word2::ans2
word3::ans3
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

Complex card information

Complex card information

Answer:
==The answer.==

#/Q
```

# Using AI to Create Cards

Creating flashcards manually can be time-consuming, especially when dealing with large amounts of content. You can leverage AI assistants (like ChatGPT, Claude, etc.) to automatically generate Obsidanki-formatted flashcards from your study materials.

## Example Workflow

Here's a real-world example of how to use AI to create flashcards for language learning:

### Step 1: Prepare Your Prompt

Create a comprehensive prompt that includes:
1. The Obsidanki format specification
2. Your source material
3. Your requirements for the flashcards

### Step 2: Example Prompt Template

```
I need flashcards for the Obsidanki plugin for Obsidian.

Plugin syntax(simplified):

CARD FORMAT:
- Plain vocabulary notes can use :: and ::: without #Q; if #Q is used, only marked ranges are processed
- A block card begins with #Q and ends at the next heading, the next #Q, or the end of the note
- For cards with empty lines, use #Q ... #/Q (range cards)
- Use *** to split into sub-cards within one #Q block

PATTERN FORMATS (question-answer pairs):
1. Single-line pattern: word::definition
   - Use ::: for bidirectional cards (word:::definition)

2. Multi-line pattern:
   Question line 1
   Question line 2
   ?
   Answer line 1
   Answer line 2

3. Cloze deletion: This is ==important== content.
   - Use #multicloze tag to group multiple clozes together

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
[Your content here - e.g., a text passage, vocabulary list, etc.]

Requirements:
- Card front should have two lines: main title (the key term) and subtitle (the sentence containing the term)
- Card back should include: definition, part of speech, and two relevant example sentences
- Focus on the most important content

Please generate the output in Obsidanki format so I can directly copy-paste it into Obsidian.
```

### Step 3: Real Example - Language Learning

**Input to AI:**

```
I need flashcards for the Obsidanki plugin for Obsidian.

Plugin syntax(simplified):

CARD FORMAT:
- A card begins with #Q and ends with an empty line
- Use *** to split into sub-cards

PATTERN FORMATS:
1. Single-line: word::definition
2. Multi-line: Question\n?\nAnswer
3. Cloze: This is ==important==.

My text:
Norge er kjent som et vakkert land, mye på grunn av naturen.
Hvis du reiser til de riktige stedene, kan du se vakre fjell,
dype fjorder, varme strender eller snødekte skoger. Byene i
Norge ligger ofte nær naturen.

Key vocabulary:
- **kjent** (known)
- **naturen** (nature)
- **fjorder** (fjords)
- **snødekte** (snow-covered)

Requirements:
- Front: vocabulary word + sentence context
- Back: meaning, part of speech, 2 example sentences
- Use the multi-line pattern (?) format
```

**AI Output (ready to paste):**

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
**naturen**
Norge er kjent som et vakkert land, mye på grunn av naturen.
?
**Meaning:** the nature
**Part of speech:** noun (definite form)
**Examples:**
1. Vi må ta vare på naturen. (We must take care of nature.)
2. Naturen er vakker om våren. (Nature is beautiful in spring.)

#Q
**fjorder**
Du kan se vakre fjell, dype fjorder, varme strender.
?
**Meaning:** fjords (narrow inlets of sea between cliffs)
**Part of speech:** noun (plural)
**Examples:**
1. Norges fjorder er verdenskjente. (Norway's fjords are world-famous.)
2. Vi seilte gjennom fjordene. (We sailed through the fjords.)

#Q
**snødekte**
Du kan se snødekte skoger.
?
**Meaning:** snow-covered
**Part of speech:** adjective
**Examples:**
1. De snødekte fjellene er vakre. (The snow-covered mountains are beautiful.)
2. Skogen var helt snødekt. (The forest was completely snow-covered.)
```

# Review

Once you've finished your document, click on the card icon in the sidebar to start reviewing.

<img width="174" alt="屏幕快照 2022-11-15 的 12 59 37 下午" src="https://user-images.githubusercontent.com/16589958/201830351-1f2959d7-3610-4fc1-b0e5-1f031de25ee4.png">

The main screen follows the vault's exact **folder → subfolder → note** hierarchy. `Course/English/...` appears under **Course → English**, while `Vocab/English/...` remains under **Vocab → English**. Equal folder names in different locations are never merged, and there are no synthetic language or Other groups. Root-level notes appear directly at the top level. Only notes with included cards and their ancestor folders are shown; existing exclusion settings still apply.

Each row shows **due/total**, rolled up from every note beneath it:

- New branches start expanded. Click the chevron to collapse or reopen a branch; mouse and keyboard changes are saved automatically.
- Click the name to study that branch's due reviews → reinforcement → new cards.
- Click the **due** number to inspect that combined queue without grading.
- Click the **total** number to browse every card in that branch without grading.

Expansion state is kept per vault in the plugin's data file, keyed by full folder identities. Collapsing a parent preserves its children's choices, and excluding a folder does not erase them. Returning from a list or study, reopening the tree, or restarting Obsidian restores the latest choices.

The tree has no Today tally or shortcut-help footer. When nothing is due, **All caught up** and the next review interval appear; branches remain browsable with `0/total` counts, and clicking their names opens the full list. An empty library shows **No cards**, without rows.

**Learning activity** appears directly below the tree, including when no cards are due or the library is empty. It covers the current calendar year, with earlier recorded years available in the year selector. Each completed **Again / Hard / Good / Easy** grade counts once, including new cards and reinforcement; reviewing the same card again counts as another review. Revealing, skipping, browsing and inserting card IDs do not count. Daily shades represent **0**, **1–4**, **5–9**, **10–19** and **20+** reviews, with the year's review total and number of active days above the calendar.

Wide panes show the year as one strip of weeks; narrower panes stack January–June above July–December instead of scrolling. Thin lines separate the months, stepping across the week where a month begins mid-week, and small month names start at each month's first Monday column. Rows run Monday to Sunday without weekday labels; a day's tooltip and the detail line below name its weekday, date and review count. The rest of the current year appears as faint, non-interactive days. Click or focus a day to show its detail. Tab enters the calendar at today's cell; arrow keys move by day vertically and week horizontally, crossing between the stacked halves. Home/End move to the week's boundaries, and Ctrl+Home/End to the year's first/last elapsed day. Calendar shortcuts do not activate tree rows.

Activity tracking starts with this version. Older schedules contain only the latest review timestamps, not a complete dated history, so earlier activity is not reconstructed. Counts are vault-wide, persist in `obsidanki.db`, and remain recorded if notes are later excluded or removed. Embedded rule decks also contribute completed grades, but only the main tree shows the calendar.

Embedded rule decks remain mouse-only **Study / Browse** menus. Their counts and previews stay restricted to the rule; opening a preview never replaces the source note.

Card lists show 20 cards per page. Previous and next arrows flank a compact **X of Y** page selector; click the center to jump directly to any page. Arrows are disabled at the first and last pages. The **Search** field checks questions and answers across the entire selected scope, ignoring case and surrounding spaces. Results are paginated too; changing or clearing the search returns to page 1. Search and page controls form a compact toolbar that stays at the top while scrolling, with full-size touch targets on phones.

Lists open in the same Obsidanki tab, titled with the selected branch or note. Click a row, or focus it and press `Enter` / `Space`, to open its card. **Show** reveals the answer, then **Next** continues without grading. Use Obsidian's header **Back / Forward** arrows to move between the tree, list and card; Back restores the list's search and page, and Forward restores the last browsed card. Revealing or advancing a card does not add a history entry. There is no in-content back button. Hover or keyboard-focus a row to reveal its external-link **Source** arrow, which stays visible on touch screens. This action opens the note in source mode and selects the exact definition row, including duplicate, reversed and cloze cards; positions refresh after note edits. Preview scope, search, page and card identity survive workspace restoration.

In a card list, hold **Command** on macOS (**Control** elsewhere) and click a row, or press that modifier with **Space** on a focused row, to open and select its source definition. Choose Command/Meta, Control, Option/Alt or Shift in **Settings → Obsidanki → Source navigation modifier**. Changes apply immediately to open lists. Ordinary click, Enter and Space still open the card preview; the Source arrow remains available. Modified Space activates on release, so holding the key does not repeat into the editor. If macOS reserves Command+Space for Spotlight, choose another modifier.

While browsing a card, `Space` / `Enter` reveals its answer, then advances; `s` skips; `q` / `Esc` returns to the results; `o` / `O` opens the current / previous card's source. From the list, `q` / `Esc` returns to the tree unless a text field has focus. Navigation follows the filtered results across page boundaries and returns to the original results page after the last card. Browsing never changes review schedules; grading keys apply only in a review session.

The **Obsidanki** ribbon button and **Open Obsidanki** command return to the tree in the current Obsidanki tab, including from a preview or review. Header Back can leave a study session; Forward reloads its remaining queue from saved schedules without replaying completed grades. An exhausted queue returns to the tree without adding a history entry. Leaving a card never grades it; completed grades are kept and menu counts refresh.

In the tree, `j` / `k` or `↑` / `↓` moves between visible rows. `→` expands a branch, then moves into its first child; `←` collapses it or moves to its parent. `Space` / `Enter` studies the selected row, or browses it when nothing is due. `d` opens its due-card list; `p` opens all its cards. Tab-focused disclosure and count buttons retain their own Space/Enter action. Digits have no tree action. These shortcuts remain available without an on-screen help line.

Starting a study session shows each card's question; reveal the answer, then grade how well you recalled it. The interval above each grade is when the card comes back.

A primary mouse or trackpad click anywhere in the card area reveals the answer, then grades **Easy** in a review session or advances without grading while browsing. `Space` / `Enter` still reveals the answer, then grades **Good**. Rapid clicks, including double-clicks, continue the mouse sequence rather than selecting words or paragraphs. Clicks during saving and loading are ignored until the next card is rendered, so a card cannot be graded twice. Drag-selecting text, links, embedded controls, and modified clicks keep their normal behavior.

| Key | Action |
|---|---|
| `Space` / `Enter` | **Show** (reveal the answer), then grade **Good** |
| `h` `j` `k` `l` or `1`–`4` | **Again**, **Hard**, **Good**, **Easy** |
| `s` | Skip the card |
| `o` / `O` | Open the current / previous card in its note |
| `q` / `Esc` | Back to the main menu |

Keys only act in the focused Obsidanki pane, never while typing or using a dialog. `Ctrl`/`Alt`/`Cmd` combinations and text composition retain their native behavior.

# Parameter Adjustment

The default parameters work quite well in most cases. If you think you need to adjust the parameters, the following information can help you.

- **Initial Ease**: This parameter defaults to 250, meaning that the review interval will increase or decrease by 2.5 times. For example, if a card was last reviewed 2 days ago, then if you choose a positive option, the next review time will be 2.5 * 2 = 5 days, so it will be reviewed again after 5 days. If you choose a negative option, the next review time will be 2.5 / 2 = 1.25 days, so it will be reviewed again after 1.25 days.

- **Easy Option Bonus**: This parameter defaults to 1. When you choose the easy option (**Easy**), in this case, the review time will be postponed by an extra day. In the above situation, it is equivalent to reviewing again one more day after 5 days, that is, after 6 days.

- **Hard Option Bonus**: This parameter defaults to 1. When you choose the hard option (**Again**), in this case, the review time will be advanced by one day. In the above situation, it will be reviewed one day earlier after 1.25 days, that is, 0.25 days later.

If you think you are reviewing too much content every day, it is recommended to start adjusting from the easy option bonus. You can adjust it to 2 or 3, so that you can postpone the review time for some too simple content.

If you want to review those forgotten contents more, you can adjust the hard option bonus to 2 or 3. In this case, you will review the content you got wrong earlier.

Generally, there is no need to adjust the initial ease, as the review ease of each card will automatically increase or decrease based on your options, with a baseline value of 250. If you want to change the review baseline of all cards, you can change this value. Generally, you can change it to a value between 200-300. It is not recommended to adjust the value beyond this range.

# Excluding Files

To stop Obsidanki from scanning some notes (templates, archives, drafts…), list them in **Settings → Obsidanki → Exclude Patterns**, one pattern per line:

```
Archive/
**/Templates/**
Notes/Todo.md
```

- Paths are written from the vault root, without a leading `/`. `Archive/` excludes the top-level `Archive` folder only; use `**/Archive/**` to exclude a folder with that name anywhere.
- A line matches any path that starts with it, or any path that matches it as a glob (`*` matches within one folder level, `**` across levels). Note that `Arch` would also exclude `Architecture/`, so end folder names with `/`.
- Matching is case-sensitive. Leading/trailing spaces are ignored.
- After changing the patterns, close and reopen the review tab (or leave a deck with `q`) so the vault is scanned again.

# Deck Functionality in Obsidanki

Obsidanki offers a unique feature known as "Deck" that allows users to manage their flashcards in a highly customizable manner. This feature is designed to cater to the diverse needs of users, providing flexibility in how flashcards are organized and reviewed.

### Background

Users have different preferences when it comes to managing their flashcards. Some may prefer organizing their cards by directories, while others might find it more convenient to manage them by tags. Recognizing this, Obsidanki does not impose a preset deck system. Instead, it empowers users to define their own rules to manage their decks.

### How Deck Works

The Deck feature in Obsidanki leverages a rule-based system powered by "json-rules-engine". This allows users to define the contents of their decks based on custom rules. These rules can be freely defined to customize the inclusion of flashcards in a deck.

### Deck Rule Builder

The easiest way to create a deck is the builder. Open the command palette and run **Obsidanki: Open Deck Rule Builder**.

- Add one or more conditions. Each condition picks a source (card or file), a field (file path, card tags, card text, headings, or frontmatter tags), an operator (matches regex, contains, equals) and a value.
- Choose how conditions combine: **all**, **any**, or **none** (exclude matching cards).
- The builder shows live how many of your cards the rule matches.
- Click **Insert into note** to add the `obsidanki-deck-config` block to the current note, or **Copy code block** to paste it yourself.

If you need something the builder can't express, write the rule by hand as shown below.

### Rule Examples

Here are some examples of how you can define rules for your decks:

1. **Including Cards from a Specific Path:** Replace the keyword in the following code with your desired keyword. The deck will then include cards from the specified path.

`````
```obsidanki-deck-config
{
	"rule": {
		"conditions": {
			"all": [{
				"fact": "card",
				"operator": "regexMatch",
				"value": "KEYWORD",    <--  Replace with your own note path keyword
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

2. **Excluding Cards with a Specific Keyword in Their Path:** You can create a deck that excludes cards with a specific keyword in their path.

`````
```obsidanki-deck-config
{
	"rule":{
		"conditions":{
			"not":
				{
					"fact":"card",
					"operator":"regexMatch",           
					"value":"KEYWORD",    <-- Replace with the keyword you want to filter out
					"path":"$.path"
				}
		},
		"event":{
			"type":"match"
		}
	}
}
```
`````

3. **Filtering Cards with a Specific Tag:** You can create a deck that includes all cards with a specific tag.

`````
```obsidanki-deck-config
{
	"rule": {
		"conditions": {
			"all": [{
				"fact": "card",
				"operator": "contains",
				"value": "#KEYWORD",    <-- Replace with the tag you want to filter
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
4. **Filtering Files with a Specific Tag in Frontmatter:**

``````
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
``````

These examples should suffice for most use cases. However, if you need more complex rules, such as including cards from a specific path that contain certain tags but not others, you may need to write more complex rules. For more information on writing rules, refer to the [json-rules-engine documentation](https://github.com/CacheControl/json-rules-engine). Also, you may need to refer to the fact of the pattern, which is defined as follows:

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

### Using Deck in Your Notes

With Obsidanki's Deck functionality, you can write your own Deck rules directly in your notes. This allows you to review only the selected cards in your notes, providing a tailored review experience.

To use these examples, simply copy and paste the code into your Obsidian notes. If you have the Obsidanki plugin installed, it will automatically recognize the `obsidanki-deck-config` code block and transform it into a deck for review.

If the code block does not automatically transform into a review card, please ensure that your cursor is not within the code block. Additionally, if any errors are prompted, check that the rule is in the correct JSON format. Any formatting errors will prevent the transformation into the correct review interface. Once correctly transformed, you should see an interface similar to the one generated when clicking the button in the sidebar. This interface will also contain the review content you need.

The final note should look something like this:  

<img width="898" alt="截屏2023-07-23 15 02 45" src="https://github.com/linanwx/aosr/assets/16589958/b05aecc8-51f6-40d0-98bc-f07a7ada6221">

### Troubleshooting

If it's not working as expected, please follow these steps:

First, this code can be copied into any note; it doesn't have to be a specific one.

Second, make sure the code block starts with ` ```obsidanki-deck-config ` and ends with ` ``` `, without any extra spaces in between.

Please check that there are no extra backticks (`) at the beginning or end of the code block. This can happen if you copy the code from the GitHub page using Ctrl+C.

Ensure you've removed any placeholders like “ <-- Replace with,” as these are not valid JSON and won't be recognized.

Assuming you have a card tagged with #math, like this:

```markdown
#Q
a^2 + b^2 = ? :: c^2 #math
```

The code to filter corresponding cards would be:

```json
{
	"rule":{
		"conditions":{
			"all":[
				{
					"fact":"card",
					"operator":"contains",
					"value":"#math",
					"path":"$.tags"
				}
			]
		},
		"event":{
			"type":"match"
		}
	}
}
```

Make sure to wrap this code with ` ```obsidanki-deck-config` and  ` ``` ` .

Suppose you have a folder called `math` containing many notes, each with multiple cards. You can use the following code to review all the notes within the `math` folder:

`````
```obsidanki-deck-config
{
	"rule": {
		"conditions": {
			"all": [{
				"fact": "card",
				"operator": "regexMatch",
				"value": "math", 
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

After you finish editing, move the cursor out of this code block or switch Obsidian to preview mode. You should see this code block correctly transformed into a review interface.

# Card IDs

Obsidanki stores card-block IDs as Obsidian comments so it can find their review data:

```
#Q %%OBSIDANKI/abc123%%
word::definition
```

Single-line pattern IDs derive from the text before the delimiter and its occurrence within the card block. Editing the text after the delimiter preserves review history; duplicate questions have distinct IDs. Explicit pattern IDs use the same comment format, such as `%%OBSIDANKI/abc123/s/f00d%%`.

Comments are hidden in reading view, and in the editor Obsidanki shows them as a small badge. They do not appear in the tag pane or graph view. Do not edit or delete these IDs, or the card will lose its review history.

# Review data

Review history is stored only in `obsidanki.db`, under `.obsidian` by default. Change its location with **Settings → Obsidanki → Path to Database**. Include both the database and your notes in backups and synchronization.


# Work with Dataview

By installing the Dataview plugin, you can view information about your review progress.

<img width="839" alt="截屏2023-07-23 14 17 48" src="https://github.com/linanwx/aosr/assets/16589958/fbc09bf0-aa37-43ed-a5e4-174d1920d6b2">


You can obtain the complete set of review data by using the code `let patterns = await app.plugins.plugins.obsidanki.api.getAllPattern();`. Then, you can write Dataview code to display the data. Below is an example provided for you to copy and run.

Please note that you need to enable the corresponding option in Dataview to use `dataviewjs`!

`````
```dataviewjs
let patterns = await app.plugins.plugins.obsidanki.api.getAllPattern();

let today = new Date();
today.setHours(0, 0, 0, 0);

let futureLimit = new Date();
futureLimit.setDate(today.getDate() + 15); // Set the future limit to 15 days from today.

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

> Conflict between the double colon (::) review format and the metadata format of Dataview. It may be necessary to introduce a new format to replace the double colon review format.

# What's the difference? 

What's the difference between Obsidanki and obsidian-spaced-repetition?

- The review time is calculated in minutes, not days. This helps to review the time calculation more accurately. And the calculation when reviewing across the zero point of the day will also be more accurate. For example, at 23:59 and 00:01 in the evening, the review time will not be rudely counted as the day before and the day after.
- The review interface will now open a standard page instead of a pop-up window. Under the standard page, you can do many obsidian activities at the same time, for example, you can review and comment on the document at the same time. In pop-up mode, this mode hinders further operation.
- The review process has been optimized. Now a learning process has been added to learn the last item that was marked as forgotten.
- Redesigned the format. The new format contributes to some minor changes. For example, the cloze will no longer be disrupted by the addition of a new cloze. In addition, the new review format should also be easier to develop and expand.

However, some core functions, such as viewing review data statistics, are not available yet. I will improve the function according to my free time.

# Precautions:

- Avoid identical multi-line or cloze patterns within the same card block. Single-line duplicates are distinguished by their occurrence within the block.
- Currently, development and testing are only carried out with "strict line breaks" mode turned off. It has not been tested with the mode turned on, so it is recommended to turn it off.

# License

- MIT [https://opensource.org/licenses/MIT](https://opensource.org/licenses/MIT)

```
react (MIT)   https://github.com/facebook/react
YAML (ISC)    https://github.com/eemeli/yaml
MUI (MIT)     https://github.com/mui/material-ui
```
