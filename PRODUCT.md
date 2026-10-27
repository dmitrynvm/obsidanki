# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

One learner reviewing vocabulary and sentence cards (English, Finnish, German ↔ Russian) inside their own Obsidian vault, usually at a desk, keyboard-first with vim habits.

## Product Purpose

Obsidanki brings an Anki-style review screen to Obsidian: see the prompt, reveal the answer, grade recall once. Success is getting through a deck quickly without the screen getting in the way.

## Operating Context

- Cards live in vault notes as `term :: translation` and `:::` reversed lines, either unmarked or inside explicit `#Q` blocks. Multi-line `?` and `==cloze==` cards require explicit blocks.
- Schedules live in `.obsidian/obsidanki.db`, keyed by `#OBSIDANKI/...` identities. Explicit blocks store IDs as `%%OBSIDANKI/...%%` comments; unmarked vocabulary derives identity from its note path and question without modifying the note.
- The vault uses the Things 3 theme and PT Mono as its text font.

## Capabilities and Constraints

- Visual changes preserve the scheduler, parsers and deck-rule behavior.
- Grades map 1:1 to upstream operations: Again=FORGET, Hard=HARD, Good=FAIR, Easy=EASY (`ReviewOpt`; `LearnOpt` on the learn deck).
- A card-area click reveals the answer, then grades Easy; Space/Enter reveals the answer, then grades Good. Browsing advances without grading.
- The review screen inherits Obsidian theme variables; it introduces no palette of its own.

## Brand Commitments

- Reference: Anki's reviewer. Card centred, question above a divider, answer below, nothing else on screen.
- Minimalism and consistency throughout the extension: reuse the vault's reading font (`--font-text`, currently PT Mono) for card content, menu labels, controls, previews, builder dropdowns, settings and maintenance dialogs.
- Controls use neutral tints and small theme radii. No saturated Study button, separate sans-serif interface, boxed shortcut hints, or decorative shadows. Accent color is reserved for interaction states such as keyboard focus.

## Product Principles

- One decision per card.
- Only the card and the grades are visible; every other action is a key.
- Never leak the answer before reveal.
