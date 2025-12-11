[![npm version](https://img.shields.io/npm/v/@itrocks/translate?logo=npm)](https://www.npmjs.org/package/@itrocks/translate)
[![npm downloads](https://img.shields.io/npm/dm/@itrocks/translate)](https://www.npmjs.org/package/@itrocks/translate)
[![GitHub](https://img.shields.io/github/last-commit/itrocks-ts/translate?color=2dba4e&label=commit&logo=github)](https://github.com/itrocks-ts/translate)
[![issues](https://img.shields.io/github/issues/itrocks-ts/translate)](https://github.com/itrocks-ts/translate/issues)
[![discord](https://img.shields.io/discord/1314141024020467782?color=7289da&label=discord&logo=discord&logoColor=white)](https://25.re/ditr)

# translate

Manage dynamic string translations with support for variables and composite patterns.

*This documentation was written by an artificial intelligence and may contain errors or approximations.
It has not yet been fully reviewed by a human. If anything seems unclear or incomplete,
please feel free to contact the author of this package.*

## Installation

```bash
npm i @itrocks/translate
```

This package has a runtime dependency on `papaparse`, which is installed automatically
as a transitive dependency when you install `@itrocks/translate`.

## Usage

`@itrocks/translate` provides a tiny in-memory translation engine for Node.js.

You typically use it to:

- declare the current UI language with `trInit()`,
- load translation keys from a CSV file with `trLoad()`,
- translate strings at runtime with `tr()`,
- optionally inspect or extend the in-memory `translations` map.

The focus is on **dynamic translations of small text snippets** (labels, button
texts, messages) with support for:

- automatic case handling (uppercasing the first letter),
- placeholders like `$1`, `$2`, ... replaced by runtime values,
- composite expressions that can themselves contain expressions.

### Minimal example

```ts
import { tr, trInit, trLoad } from '@itrocks/translate'

async function main() {
  // 1. Select the language and reset internal state
  trInit('en-US')

  // 2. Load translations from a ;‑separated CSV file
  await trLoad('locales/en-US.csv')

  // 3. Translate a simple key
  console.log(tr('hello'))          // e.g. "Hello"

  // 4. Translate a key with placeholders
  console.log(tr('welcome.user.$1', ['John'])) // e.g. "Welcome, John"
}

main().catch(console.error)
```

### Complete example with composite patterns

`tr()` can both translate **simple keys** and **composite expressions**. Composite
expressions are translated by splitting them around punctuation and translating
each part separately while preserving spaces.

You can also store patterns with placeholders in the translation file. When a
pattern matches the source text, `tr()` automatically:

- translates each captured part,
- appends the translated parts to the `parts` array,
- and reuses them to build the final translated string.

```ts
import { expressions, lang, tr, trInit, trLoad, translations } from '@itrocks/translate'

async function initTranslations() {
  // Initialize the language (any BCP 47 code string is accepted)
  trInit('fr-FR')

  // Load a ;‑separated CSV file with two columns: source;translation
  // Example content:
  // hello;Bonjour
  // "Hello, $1";"Bonjour, $1"
  // "You have $1 new messages";"Vous avez $1 nouveaux messages"
  await trLoad('locales/fr-FR.csv')

  console.log('Current language:', lang())

  console.log(tr('hello'))                 // "Bonjour"
  console.log(tr('Hello, $1', ['Marie']))  // "Bonjour, Marie"
  console.log(tr('You have $1 new messages', ['3']))
  // => "Vous avez 3 nouveaux messages"

  // The underlying maps are available if you need to inspect or extend them
  console.log('Loaded translations:', translations.size)
  console.log('Expression patterns:', expressions.size)
}

initTranslations().catch(console.error)
```

> **Note**
> This package is intentionally minimal: it does not manage locales, fallbacks,
> or pluralization rules on its own. Those concerns are expected to be handled
> by your application or higher‑level framework.

## API

### `DefaultOptions`

```ts
export const DefaultOptions: Options
```

The default options used by `tr()` when no explicit `options` are provided.

Currently only one option is defined:

- `ucFirst: boolean` (default `true`): when `true`, if the input text starts
  with an uppercase ASCII letter (`A`–`Z`), the translated string is forced to
  start with an uppercase letter as well.

You can override this behavior per call using the `options` argument of `tr()`.

### `expressions`

```ts
export const expressions: Set<RegExp>
```

The set of **compiled expression patterns** used for advanced matching in `tr()`.

You normally do not need to modify this set manually. It is populated by
`trLoad()` when a source key in the CSV file contains placeholders like `$1`.

Each such key generates a regular expression that is later used by `tr()` to
match dynamic sentences and extract sub‑parts for translation.

### `translations`

```ts
export const translations: Map<string, string>
```

The in‑memory translation dictionary. Keys are **source texts** (usually
English strings or stable identifiers), and values are their translated
counterparts in the currently active language.

This map is cleared each time you call `trInit()`. It is filled by `trLoad()`
and can be extended or inspected manually if needed.

### `type Options`

```ts
export type Options = {
  ucFirst?: boolean
}
```

Additional options that can be passed to `tr()`:

- `ucFirst` (default: `DefaultOptions.ucFirst`): whether the first character of
  the translated string should be uppercased when the original first character
  is an uppercase ASCII letter.

### `lang()`

```ts
function lang(): string
```

Returns the **current language code** previously set with `trInit()`.

The package does not interpret the value: you can use any string (for example
`'en-US'`, `'fr-FR'`, `'de'`), as long as it is meaningful to your
application.

### `tr()`

```ts
// Overload 1: no parts array, only options
function tr(text: string, options: Options): string

// Overload 2: explicit parts and optional options
function tr(text: string, parts?: string[], options?: Options): string
```

Translates the given `text` using the current `translations` map and returns
the translated string.

Behavior details:

1. **Spacing preservation** – leading and trailing whitespace in `text` are
   preserved around the translated content.
2. **Lookup strategy** – for the trimmed `text`, `tr()` looks up, in order:
   - an exact match in `translations`,
   - if `ucFirst` is enabled and the first character is uppercase, the same key
     but with the first letter lower‑cased,
   - the lower‑cased key,
   - a match from expression patterns in `expressions` (see `trLoad()`).
3. **Composite sentences** – if no translation is found, `tr()` looks for a
   punctuation separator (`.?!;:,()`). When found, the text is split around the
   first such separator, each part is translated separately with `tr()`, and the
   final string is reassembled while preserving spaces (including non‑breaking
   spaces around the separator).
4. **Fallback** – if no translation or expression match is found, the original
   trimmed text is returned.
5. **Placeholders** – if a `parts` array is provided, elements are substituted
   into the translated string by replacing `$1`, `$2`, ... from the end of the
   array backwards.

Usage patterns:

```ts
tr('hello')
tr('Hello', { ucFirst: false })
tr('welcome.$1', ['John'])
tr('You have $1 new messages', ['3'])
```

### `trInit()`

```ts
function trInit(lang: string): void
```

Initializes or switches the current language. This function:

- sets the internal language code returned by `lang()`,
- clears all previously loaded `translations`,
- clears all compiled `expressions`.

Call this once per language at application startup, or whenever you change the
active language and want to reload translation data.

### `trLoad()`

```ts
async function trLoad(file: string): Promise<void | unknown>
```

Loads translations from a **semicolon‑separated CSV file** at the given path.

Behavior:

- If the file does not exist or cannot be accessed, the function simply
  returns without throwing.
- It reads the file as UTF‑8 and parses it using `papaparse` with `;` as the
  delimiter.
- Each row is expected to have at least two columns: `row[0]` is the source
  string, `row[1]` is the translated string. Extra columns are ignored.
- For each row, the pair is stored in `translations`.
- If `row[0]` contains a placeholder like `$1`, an expression `RegExp` is
  created and added to `expressions` to support dynamic matching in `tr()`.

Typical CSV snippet:

```csv
hello;Hello
"Hello, $1";"Hello, $1"
"You have $1 new messages";"You have $1 new messages"
```

## Typical use cases

Here are some scenarios where `@itrocks/translate` is a good fit:

1. **Translating UI labels and messages in a Node.js application**
   - Keep a simple `locales/<lang>.csv` file with two columns: source and
     translation.
   - At startup, call `trInit('<lang>')` and `trLoad('locales/<lang>.csv')`.
   - Use `tr('settings')`, `tr('Save changes')`, etc., in your rendering
     or logging code.

2. **Integrating with a template or transformer system**
   - Combine `@itrocks/translate` with higher‑level packages such as
     `@itrocks/transformer` or `@itrocks/property-translate` to automatically
     translate values when rendering views or model properties.

3. **Dynamic messages with parameters**
   - Define entries in your CSV containing `$1`, `$2`, ... placeholders.
   - At runtime, call `tr('You have $1 new messages', ['3'])`.
   - The placeholders are replaced by the elements of the `parts` array.

4. **Expression‑based translations**
   - Use keys with `$1` in your CSV (for example, `"Hello, $1"`).
   - When you call `tr('Hello, John')`, `@itrocks/translate` matches the
     pattern, translates `"John"` if possible, and then builds the final
     sentence using the captured parts.

5. **Inspecting and debugging translations**
   - Use `translations.size` to quickly see how many entries were loaded.
   - Inspect `translations.get('some key')` or iterate over the map when
     debugging missing or incorrect translations.
