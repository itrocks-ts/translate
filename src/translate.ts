import { AsyncLocalStorage } from 'node:async_hooks'
import { access }            from 'node:fs/promises'
import { readFile }          from 'node:fs/promises'

const parseCsv = require('papaparse').parse

type Catalog = {
	expressions:  Set<RegExp>
	translations: Map<string, string>
}

type Expression = {
	indexes: number[]
	source:  string
}

export type LoadOptions = {
	language?: string
	reverse?:  boolean
}

export type Options = {
	ucFirst?: boolean
}

export const DefaultOptions: Options = {
	ucFirst: true
}

export const expressions  = new Set<RegExp>
export const translations = new Map<string, string>

const catalogs       = new Map<string, Catalog>
const expressionData = new WeakMap<RegExp, Expression>
const languageScope  = new AsyncLocalStorage<string>()

let defaultLanguage = 'en-US'

catalogs.set(defaultLanguage, { expressions, translations })

function catalog(language = lang()): Catalog
{
	let value = catalogs.get(language)
	if (!value) {
		value = { expressions: new Set, translations: new Map }
		catalogs.set(language, value)
	}
	return value
}

function escapeRegExp(text: string)
{
	return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function lang()
{
	return languageScope.getStore() ?? defaultLanguage
}

export function tr(text: string, options: Options): string
export function tr(text: string, parts?: string[], options?: Options): string
export function tr(text: string, parts?: string[] | Options, options?: Options): string
{
	if (!Array.isArray(parts)) {
		options = parts
		parts   = []
	}
	const [firstSpaces, lastSpaces] = (text.match(/^(\s*).*(\s*)$/) ?? ['', '', '']).slice(1)
	text = text.trim()
	let   partsCount = parts.length
	const firstChar  = text[0]
	const ucFirst    = (options?.ucFirst ?? DefaultOptions.ucFirst) && (firstChar >= 'A') && (firstChar <= 'Z')
	const active     = catalog()
	let   translated = active.translations.get(text)
		?? (ucFirst ? active.translations.get(firstChar.toLocaleLowerCase() + text.slice(1)) : undefined)
		?? active.translations.get(text.toLocaleLowerCase())
		?? trMatch(text, parts, active)
	if (!translated) {
			const separator = (text.length > 1)
				? ['.', '?', '!', ';', ':', ',', '(', ')'].find(c => text.includes(c))
				: undefined
		if (separator) {
			translated = text.split(separator).map(text => tr(text, parts)).join(tr(separator).replace(/ /g, '\u00A0'))
			return firstSpaces + translated + lastSpaces
		}
		translated = text
	}
	while (partsCount) {
		translated = translated.replaceAll('$' + partsCount, parts[--partsCount])
	}
	if (ucFirst) {
		translated = translated[0].toLocaleUpperCase() + translated.slice(1)
	}
	return firstSpaces + translated + lastSpaces
}

export function trInit(language: string)
{
	defaultLanguage = language
	catalogs.clear()
	expressions.clear()
	translations.clear()
	catalogs.set(language, { expressions, translations })
}

export async function trLoad(file: string, options: LoadOptions = {})
{
	try { await access(file) }
	catch { return }
	const active = catalog(options.language ?? defaultLanguage)
	return readFile(file, 'utf-8')
		.then((data): [string, string][] => parseCsv(data, { delimiter: ';' }).data)
		.then(data => data.forEach(row => {
			const [source, target] = options.reverse ? [row[1], row[0]] : row
			if ((typeof source !== 'string') || (typeof target !== 'string')) return
			active.translations.set(source, target)
			if (source.includes('$')) {
				const indexes = []
				let   last     = 0
				let   pattern  = '^'
				for (const match of source.matchAll(/\$([1-9][0-9]*)/g)) {
					pattern += escapeRegExp(source.slice(last, match.index)) + '(.*?)'
					indexes.push(Number(match[1]))
					last = match.index + match[0].length
				}
				pattern += escapeRegExp(source.slice(last)) + '$'
				const expression = RegExp(pattern)
				expressionData.set(expression, { indexes, source })
				active.expressions.add(expression)
			}
		}))
}

function trMatch(text: string, parts: string[], active: Catalog): string | undefined
{
	for (const expression of active.expressions) {
		const match = text.match(expression)
		if (!match) continue
		const data = expressionData.get(expression)
		let counter = 0
		const source = data?.source
			?? expression.source.slice(1, -1).replace(/\(\.\*\??\)/g, () => '$' + ++ counter)
		const translated = active.translations.get(source)
		if (!translated) continue
		const trParts = [...parts]
		for (const [offset, part] of match.slice(1).entries()) {
			const translatedPart = tr(part)
			trParts[data?.indexes[offset] ?? (offset + 1)] = (translatedPart && (translatedPart !== part))
				? translatedPart[0].toLocaleLowerCase() + translatedPart.slice(1)
				: translatedPart
		}
		let result = translated
		for (let index = trParts.length - 1; index > 0; index--) {
			result = result.replaceAll('$' + index, trParts[index] ?? '')
		}
		return result
	}
}

export function trWithLanguage<T>(language: string, callback: () => T): T
{
	return languageScope.run(language, callback)
}
