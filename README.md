[![npm version](https://img.shields.io/npm/v/@itrocks/translate?logo=npm)](https://www.npmjs.org/package/@itrocks/translate)
[![npm downloads](https://img.shields.io/npm/dm/@itrocks/translate)](https://www.npmjs.org/package/@itrocks/translate)
[![GitHub](https://img.shields.io/github/last-commit/itrocks-ts/translate?color=2dba4e&label=commit&logo=github)](https://github.com/itrocks-ts/translate)
[![issues](https://img.shields.io/github/issues/itrocks-ts/translate)](https://github.com/itrocks-ts/translate/issues)
[![discord](https://img.shields.io/discord/1314141024020467782?color=7289da&label=discord&logo=discord&logoColor=white)](https://25.re/ditr)

# translate

Translate English source strings with small, language-specific CSV catalogs.

*This documentation was written by an artificial intelligence and may contain errors or approximations.
It has not yet been fully reviewed by a human. If anything seems unclear or incomplete,
please feel free to contact the author of this package.*

## Installation

```bash
npm i @itrocks/translate
```

## Usage

Translation sources stay in English. Each semicolon-separated CSV file maps them to one language:

```csv
hello;bonjour
private: $1 recipients;privée : $1 destinataires
```

Catalog entries are context-free fragments: start both columns with a lowercase letter unless the word requires a
capital, and keep sentence-separating periods in the caller rather than at either end of a CSV value. The translator
restores an initial capital and translates each period-separated fragment independently.

An isolated `:` or `;` entry may translate to the same separator prefixed with a space when a target language requires
different spacing. The caller still owns the separator itself.

Initialize the default language and load every translated catalog once:

```ts
import { tr, trInit, trLoad, trReverse, trWithLanguage } from '@itrocks/translate'

trInit('en-US')
await trLoad('locales/fr-FR.csv', 'fr-FR')

await trWithLanguage('fr-FR', async () => {
  console.log(tr('Hello'))                           // Bonjour
  console.log(tr('Private: $1 recipients.', ['2'])) // Privée : 2 destinataires.
  console.log(trReverse('Bonjour'))                  // Hello
})
```

The asynchronous language context is isolated between concurrent requests. A language with no catalog, such as the
English source language above, leaves source strings unchanged.

## API

### `lang()`

```ts
function lang(): string
```

Returns the language of the current asynchronous context, or the default language set by `trInit()`.

### `tr()`

```ts
function tr(text: string, options: Options): string
function tr(text: string, parts?: string[], options?: Options): string
```

Translates `text` with the current language catalog. It supports `$1`, `$2`, … placeholders, preserves surrounding
spaces and can match catalog sources containing placeholders. If no translation exists, it returns the source text.

When `ucFirst` is enabled, an uppercase source initial also produces an uppercase translated initial:

```ts
export type Options = {
  ucFirst?: boolean
}

export const DefaultOptions: Options = {
  ucFirst: true
}
```

### `trInit()`

```ts
function trInit(language: string): void
```

Sets the default language and clears all previously loaded catalogs. Call it once before loading catalogs.

### `trLoad()`

```ts
function trLoad(file: string, language?: string): Promise<void | unknown>
```

Loads a UTF-8, semicolon-separated `source;translation` file into `language`. The language defaults to the one passed
to `trInit()`. A missing file is ignored so applications can look for catalogs in several module directories.

### `trReverse()`

```ts
function trReverse(text: string): string
```

Looks for a translated value in the current language catalog and returns its English source, accepting an initial
capital added by `tr()`. If none matches, it returns `text` unchanged. This is intended for occasional input
normalization, such as converting a translated code entered in a search field back to the code stored in English. It
reads the current catalog backwards on demand; no reverse catalog is loaded or retained.

### `trWithLanguage()`

```ts
function trWithLanguage<T>(language: string, callback: () => T): T
```

Runs `callback` in an asynchronous language context used by `lang()`, `tr()` and `trReverse()`. The context is preserved
through promises without affecting concurrent callbacks.

## Scope

The package deliberately does not manage locale negotiation, plural rules or fallback chains. Applications and
higher-level frameworks remain responsible for those policies.
