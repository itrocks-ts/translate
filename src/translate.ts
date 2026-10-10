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
	const [firstSpaces, lastSpaces] = (text.match(/^(\s*)[\s\S]*?(\s*)$/) ?? ['', '', '']).slice(1)
	text = text.trim()
	let   partsCount = parts.length
	const firstChar  = text[0]
	const ucFirst    = (options?.ucFirst ?? DefaultOptions.ucFirst) && (firstChar >= 'A') && (firstChar <= 'Z')
	const active     = catalog(lang())
	const sentences  = /[.?!]$|\.(?=\s)/.test(text)
	let   translated = active.get(text)
		?? (ucFirst ? active.get(firstChar.toLocaleLowerCase() + text.slice(1)) : undefined)
		?? active.get(text.toLocaleLowerCase())
		?? (!sentences ? trMatch(text, parts, active) : undefined)
	if (!translated) {
		// Resolve the whole fragment before splitting punctuation inside it (brands, versions).
		const ending = text.length > 1 ? text.match(/[.?!]$/) : null
		if (ending) {
			return firstSpaces + tr(text.slice(0, -1), parts, options) + tr(ending[0]).replace(/ /g, '\u00A0') + lastSpaces
		}
		if (/\$[1-9][0-9]*/.test(text) && !/\.(?=\s)/.test(text)) {
			translated = text.split(/(\$[1-9][0-9]*)/).map(fragment => (
				/^\$[1-9][0-9]*$/.test(fragment) ? fragment : tr(fragment, [], options)
			)).join('')
		}
		const separator = !translated && (text.length > 1)
			? ['.', '?', '!', ';', ':', ',', '(', ')'].find(c => (
				c === '.' ? /\.(?=\s)/.test(text) : text.includes(c)
			))
			: undefined
		if (separator) {
			const fragments = text.split(separator === '.' ? /\.(?=\s)/ : separator)
			translated = fragments.map(text => tr(text, parts, options))
				.join(tr(separator).replace(/ /g, '\u00A0'))
			return firstSpaces + translated + lastSpaces
		}
		translated ??= text
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
	// Prefer the most specific pattern over catch-all fragments such as "add $1".
	for (const [source, translated] of [...active].filter(([source]) => source.includes('$')).sort(([left], [right]) => (
		right.replace(/\$[1-9][0-9]*/g, '').length - left.replace(/\$[1-9][0-9]*/g, '').length
	))) {
		const indexes = []
		let   last    = 0
		let   pattern = '^'
		for (const match of source.matchAll(/\$([1-9][0-9]*)/g)) {
			pattern += escapeRegExp(source.slice(last, match.index)) + '(.*?)'
			indexes.push(Number(match[1]))
			last = match.index + match[0].length
		}
		pattern += escapeRegExp(source.slice(last)) + '$'
		const expression = RegExp(pattern, 'i')
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
