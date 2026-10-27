# CLAUDE.md - Obsidanki Plugin Development Guide

## Project Overview

**Obsidanki** is a TypeScript-based Obsidian plugin that implements spaced repetition learning using flashcards. The plugin offers minute-level review intervals, rich text support (audio, images, videos), a separate review window, and multiple learning types.

- **Current Version**: 1.1.5
- **Author**: linanwx
- **License**: MIT
- **Minimum Obsidian Version**: 0.12.0
- **Upstream Repository**: https://github.com/linanwx/aosr

## Quick Start

```bash
# Install dependencies
yarn install

# Development mode (watch)
yarn dev

# Production build
yarn build

# Bump version
yarn version
```

## Project Structure

The project uses a flat structure with all source files at the root level:

```
obsidanki/
├── main.ts              # Plugin entry point (ObsidankiPlugin class)
├── api.ts               # Public API for external access
├── view.tsx             # Review UI component (ReviewView)
├── deckTree.ts          # Vault folder/note tree, rolled-up counts and exact-path scopes
├── deckTreeMenu.tsx     # Expandable main menu, scoped study and due/all count previews
├── learningActivity.ts  # Local-day keys, calendar-year weeks, first-Monday month labels and intensity thresholds
├── learningHeatmap.tsx  # Activity calendar below the tree: one strip on wide panes, two half-year strips when narrow
├── card.ts              # Card model and parsing
├── Pattern.ts           # Abstract pattern base class
├── ParserCollection.ts  # Singleton parser registry
├── patternLine.tsx      # Single/multi-line patterns (:: and ::: formats)
├── patternCloze.tsx     # Cloze deletion patterns (== format)
├── schedule.ts          # Spaced repetition algorithm (SM-2 based)
├── arrangement.ts       # Card arrangement logic (New/Review/Learn/Hard)
├── cardSearch.ts        # Card discovery (#Q blocks or unmarked single-line vocabulary)
├── db.ts                # Data persistence (lowdb)
├── annotationParse.ts   # Annotation handling (YAML serialization)
├── tag.ts               # Editor decoration for tags (CodeMirror)
├── cardHead.ts          # Card ID comments (%%OBSIDANKI/ID%%)
├── cardWatcher.ts       # Live card tracking
├── setting.ts           # Configuration UI and state
├── language.ts          # i18n translations (25+ languages)
├── markdown.tsx         # Markdown rendering utilities
├── deck.tsx             # Deck rule engine (json-rules-engine)
├── migrate.ts           # Data migration tool
├── nodeContainer.tsx    # React node wrapper
├── hash.ts              # String hashing (cyrb53)
├── manifest.json        # Plugin manifest
├── package.json         # Dependencies
├── tsconfig.json        # TypeScript configuration
├── esbuild.config.mjs   # Build configuration
└── styles.css           # Plugin styles
```

## Architecture

### Core Components

1. **Plugin Entry** (`main.ts`): `ObsidankiPlugin` class extends Obsidian's Plugin, registers views, commands, and settings

2. **Card System**:
   - `card.ts`: Defines `Card` interface and `defaultCard` implementation
   - `cardSearch.ts`: Explicit `#Q` ranges remain authoritative. Without them, scan non-excluded Markdown notes for configured single-line/reverse delimiters, skipping frontmatter, headings, code and hidden comments. Pass visible candidate lines keyed by source offset to `SingleLineParser`; do not run multi-line/cloze parsers on unmarked notes. Plain-note IDs derive from the note path, with question/occurrence-based pattern IDs; studying them saves schedules without rewriting notes.
   - `cardWatcher.ts`: Maintains live card index

3. **Pattern System**:
   - `Pattern.ts`: Abstract base class for all pattern types
   - `patternLine.tsx`: Single-line (`::`) and reversible (`:::`) patterns
   - `patternCloze.tsx`: Cloze deletion (`==`) patterns
   - `ParserCollection.ts`: Singleton registry for pattern parsers

4. **Scheduling** (`schedule.ts`):
   - SM-2-based spaced repetition algorithm
   - Key parameters: `DefaultEase` (250), `EasyBonus` (1), `HardBonus` (1)
   - Three stages: New → Learning → Review

5. **Data Persistence** (`db.ts`):
   - Uses lowdb for JSON storage
   - Default path: `.obsidian/obsidanki.db`
   - `DatabaseHelper` singleton manages all operations
   - `DatabaseHelper.ready` is awaited before registering views/parsers. `saveReview` writes a schedule snapshot and one local-day increment in the optional `activity` date→count map together, serializing writes and publishing activity snapshots only after success. Failed writes restore the previous in-memory database. Existing databases without activity start empty; never infer historical counts from `Last`/`Learned`.
   - `Card.commitFile({schedules: true})` is the shared grade persistence boundary for line/reverse/cloze patterns. It awaits `saveReview`; ID-only initialization does not record activity. The calendar subscribes to successful commits, uses local calendar dates (not UTC day slicing), and keeps its keyboard events out of tree navigation.

6. **UI Layer** (`view.tsx`):
   - React-based interface; the main menu mirrors the vault's folder/note hierarchy with restored open/closed branches, uniform adaptive indentation, full-width hover/focus rows, elbow guides and aligned due/total counts. Indentation depends on the entire tree depth, not the currently expanded branches. Closing settings after exclusion changes refreshes tree views but leaves active study sessions alone. Embedded rule decks retain a mouse-only Study/Browse menu.
   - `CollapsedTreeNodes` stores closed folders' structured `DeckTreeNode.id` values in plugin data. `DeckTreeMenu` restores them on mount and saves toggles through the `ReviewView.saveTreeState` callback injected by the plugin. Hidden descendants and excluded folders retain their entries; new identities start expanded. Fold changes do not create navigation history.
   - Review screen (`Reviewing`) is plain DOM styled by `styles.css` with Obsidian theme variables: reveal, then Again/Hard/Good/Easy mapped to `ReviewOpt`/`LearnOpt`; keys captured on the host window while the pane is active
   - Native navigation stays on one leaf: `ReviewView` stores `{route: tree | study, rule}`; `DeckPreviewView` stores list/card route, scope, query, page and `{path, tagId}` card identity. Both use `navigation=true`, `getState`/`setState` and `ViewStateResult.history`. Search, paging, browse-next and completed-study exit do not add history entries. Forward into study rebuilds the remaining queue from persisted schedules.
   - List rows use `GlobalSettings.SourceNavigationModifier` live: modifier-click or modifier-Space calls `openPatternAt` and selects the current definition. Modified Space is armed on keydown, cancelled on blur and activated on keyup to avoid repeating into the editor. macOS Control-click is handled through `contextmenu`; ordinary context menus and typing keep their native behavior.
   - i18next for internationalization

### Design Patterns

- **Singleton**: `ParserCollection.getInstance()`, `DatabaseHelper.getInstance()`, `getAppInstance()`
- **Factory**: `NewCard()`, `NewCardSearch()`, `NewSchedule()`
- **Observer**: Card watcher for live updates
- **Strategy**: Multiple parser implementations

## Key Technologies

| Category | Technologies |
|----------|-------------|
| Language | TypeScript 4.7 |
| UI Framework | React 18, Material-UI 5 |
| Build Tool | esbuild |
| Database | lowdb (JSON) |
| i18n | i18next |
| Rule Engine | json-rules-engine |
| Editor | CodeMirror 6 |

## Development Guidelines

### Naming Conventions

- **Classes**: PascalCase (`ObsidankiPlugin`, `ReviewView`, `PatternSchedule`)
- **Functions**: camelCase (`newCard()`, `findOutline()`)
- **Constants**: UPPERCASE (`CardIDTag`, `VIEW_TYPE_REVIEW`)
- **DOM Elements**: `contentEl`, `containerEl`, `el`

### File Organization

- One main class/component per file
- Exports at file level (default or named)
- Imports at top of file

### TypeScript Configuration

- Target: ES6
- Module: ESNext
- JSX: react
- Strict null checks enabled
- No implicit any

### Code Patterns

```typescript
// Singleton pattern
class DatabaseHelper {
    private static instance: DatabaseHelper;
    static getInstance(): DatabaseHelper {
        if (!this.instance) {
            this.instance = new DatabaseHelper();
        }
        return this.instance;
    }
}

// Factory pattern
function NewCard(text: string, path: string): Card {
    return defaultCard(text, path);
}

// Interface-based contracts
interface Card {
    ID: string;
    text: string;
    path: string;
    // ...
}
```

### React Patterns

- Functional components with hooks
- JSX in `.tsx` files
- Material-UI component usage
- i18next context (`I18nextProvider`)

## Card Format Reference

### Card Markers

- **Plain vocabulary**: Without explicit blocks, `::` and `:::` lines need no markers. IDs depend on the note path and question/occurrence; renaming or moving the note changes its identity.
- **Block Card**: Starts with `#Q`, ends at the next Markdown heading, the next `#Q`, or the end of the note
- **Range Card**: Starts with `#Q`, ends with `#/Q` (supports empty lines)
- **Sub-card separator**: `***`

### Pattern Types

| Pattern | Syntax | Description |
|---------|--------|-------------|
| Single-line | `word::definition` | Question → Answer |
| Reversible | `word:::definition` | Bidirectional |
| Multi-line | `Question\n?\nAnswer` | Multi-line Q&A |
| Cloze | `A ==cloze==` | Fill-in-the-blank |
| Multicloze | `==a== and ==b== #multicloze` | Grouped cloze |

### Regular Expressions

```typescript
// Card detection
/(^#Q\b.*|^#\/Q\b.*)/gm

// Cloze patterns
/==(\S[\s\S]*?)==/gm

// Tag extraction
/#[\/\w]+/gm
```

## Configuration

### User Settings (`setting.ts`)

| Setting | Default | Description |
|---------|---------|-------------|
| `DefaultEase` | 250 | Base difficulty multiplier |
| `EasyBonus` | 1 | Extra days for easy answers |
| `HardBonus` | 1 | Reduced days for hard answers |
| `ObsidankiDbPath` | `.obsidian/obsidanki.db` | Database location |
| `ExcludeWorkingPathesPattern` | (empty) | Glob patterns to exclude |
| `SourceNavigationModifier` | `Meta` on macOS, `Ctrl` elsewhere | Source-definition shortcut modifier (`Meta`, `Ctrl`, `Alt`, `Shift`) |
| `CollapsedTreeNodes` | `[]` | Saved collapsed folder identities; managed automatically by the main tree |

### Customizable Delimiters

| Setting | Default |
|---------|---------|
| `OneLineDelimeter` | `::` |
| `OneLineReversedDelimeter` | `:::` |
| `MultiLineDelimeter` | `?` |

## Build System

### esbuild Configuration

- **Entry**: `main.ts`
- **Output**: `main.js` (CommonJS)
- **Target**: ES2018
- **Source maps**: Inline in dev, none in prod
- **External**: `obsidian`, `electron`, CodeMirror, Node builtins

### Scripts

```bash
# Watch mode development
yarn dev

# Type check + production build
yarn build

# Version bump (updates manifest.json and versions.json)
yarn version
```

## CI/CD

GitHub Actions workflow (`.github/workflows/releases.yml`):

1. Triggers on git tag push
2. Runs on Ubuntu latest with Node 20.x
3. Installs dependencies (`yarn --frozen-lockfile`)
4. Builds (`tsc -noEmit && esbuild production`)
5. Creates GitHub release
6. Uploads: `main.js`, `manifest.json`, `styles.css`, `.zip`

## Testing

**Note**: No automated testing framework is currently configured. Quality assurance relies on:
- ESLint for static analysis
- TypeScript type checking (strict mode)
- Manual testing

## Common Tasks

### Adding a New Pattern Type

1. Create new parser class extending `Pattern` in a new `.tsx` file
2. Implement `parse()` method to detect and extract patterns
3. Register parser in `ParserCollection`
4. Add UI component for review display

### Modifying Scheduling Algorithm

Edit `schedule.ts`:
- `PatternSchedule` interface defines schedule structure
- `Operation` enum defines review actions
- `ReviewOpt` and `LearnOpt` handle review logic

### Adding New Settings

1. Add property to `ObsidankiSettings` interface in `setting.ts`
2. Add default value to `DEFAULT_SETTINGS`
3. Add UI control in `ObsidankiSettingTab.display()`
4. Update `loadSettings()` and `saveSettings()` if needed

### Database Operations

```typescript
// Get database instance
const db = DatabaseHelper.getInstance();

// Read card data
const cardDoc = await db.read(cardId);

// Write card data
await db.write(cardId, scheduleData);
```

## Debugging

Enable debug logging by setting `DEBUG_ENABLED = true` in `main.ts`:

```typescript
export var DEBUG_ENABLED = true;

export function debugLog(...args: any[]) {
    if (DEBUG_ENABLED) {
        console.log(...args);
    }
}
```

## Key Files to Understand

For new contributors, start with these files in order:

1. `main.ts` - Plugin lifecycle and registration
2. `card.ts` - Core card data structure
3. `Pattern.ts` - Pattern abstraction
4. `schedule.ts` - Spaced repetition logic
5. `view.tsx` - Review UI
6. `db.ts` - Data persistence

## Known Limitations

- No duplicate pattern content in the same file (relies on unique string matching)
- "Strict line breaks" mode in Obsidian may cause issues (recommended off)
- No automated test coverage
- Code comments primarily in Chinese

## External Resources

- [Obsidian Plugin API](https://docs.obsidian.md/Plugins/Getting+started/Build+a+plugin)
- [json-rules-engine Documentation](https://github.com/CacheControl/json-rules-engine)
- [lowdb Documentation](https://github.com/typicode/lowdb)
- [Material-UI Documentation](https://mui.com/material-ui/)
