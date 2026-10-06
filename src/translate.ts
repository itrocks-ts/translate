import { AsyncLocalStorage } from 'node:async_hooks'
import { catalog }           from './catalog'
import { catalogClear }      from './catalog'
import { catalogLoad }       from './catalog'
import { Catalog }           from './catalog'

export type Options = {
	ucFirst?: boolean
}

export const DefaultOptions: Options = {
	ucFirst: true
}

const languageScope = new AsyncLocalStorage<string>()

let defaultLanguage = 'en-US'

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
	const active     = catalog(lang())
	let   translated = active.get(text)
		?? (ucFirst ? active.get(firstChar.toLocaleLowerCase() + text.slice(1)) : undefined)
		?? active.get(text.toLocaleLowerCase())
		?? trMatch(text, parts, active)
		?? (ucFirst ? trMatch(firstChar.toLocaleLowerCase() + text.slice(1), parts, active) : undefined)
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
	catalogClear(language)
}

export function trLoad(file: string, language = defaultLanguage)
{
	return catalogLoad(file, language)
}

function trMatch(text: string, parts: string[], active: Catalog): string | undefined
{
	for (const [source, translated] of active) {
		if (!source.includes('$')) continue
		const indexes = []
		let   last    = 0
		let   pattern = '^'
		for (const match of source.matchAll(/\$([1-9][0-9]*)/g)) {
			pattern += escapeRegExp(source.slice(last, match.index)) + '(.*?)'
			indexes.push(Number(match[1]))
			last = match.index + match[0].length
		}
		pattern += escapeRegExp(source.slice(last)) + '$'
		const expression = RegExp(pattern)
		const match = text.match(expression)
		if (!match) continue
		const trParts = [...parts]
		for (const [offset, part] of match.slice(1).entries()) {
			const translatedPart = tr(part)
			trParts[indexes[offset] ?? (offset + 1)] = (translatedPart && (translatedPart !== part))
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

export function trReverse(text: string): string
{
	for (const [source, translated] of catalog(lang())) {
		if (
			(translated === text)
			|| (translated === text[0].toLocaleLowerCase() + text.slice(1))
		) return source
	}
	return text
}

export function trWithLanguage<T>(language: string, callback: () => T): T
{
	return languageScope.run(language, callback)
}

export { translations } from './catalog'
