import { access }   from 'node:fs/promises'
import { readFile } from 'node:fs/promises'

const parseCsv = require('papaparse').parse

export const DefaultOptions: Options = {
	ucFirst: true
}

export const expressions  = new Set<RegExp>
export const translations = new Map<string, string>

let language = 'en-US'

export function lang()
{
	return language
}

export type Options = {
	ucFirst?: boolean
}

export function tr(text: string, options: Options): string
export function tr(text: string, parts?: string[], options?: Options): string
export function tr(text: string, parts?: string[] | Options, options?: Options): string
{
	if (!parts) {
		parts = []
	}
	else if (parts && !Array.isArray(parts)) {
		options = parts
		parts   = []
	}
	const [firstSpaces, lastSpaces] = (text.match(/^(\s*).*(\s*)$/) ?? ['', '', '']).slice(1)
	text = text.trim()
	let   partsCount = parts.length
	const firstChar  = text[0]
	const ucFirst    = (options?.ucFirst ?? DefaultOptions.ucFirst) && (firstChar >= 'A') && (firstChar <= 'Z')
	let   translated = translations.get(text)
		?? (ucFirst ? translations.get(firstChar.toLocaleLowerCase() + text.slice(1)) : undefined)
		?? translations.get(text.toLocaleLowerCase())
		?? trMatch(text, parts)
	if (!translated) {
		const separator = (text.length > 1) ? text.match(/[.?!;:,()]/)?.[0] : undefined
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

export function trInit(lang: string)
{
	language = lang
	expressions.clear()
	translations.clear()
}

export async function trLoad(file: string)
{
	try { await access(file) }
	catch { return }
	return readFile(file, 'utf-8')
		.then((data): [string, string][] => parseCsv(data, { delimiter: ';' }).data)
		.then(data => data.forEach(row => {
			translations.set(row[0], row[1])
			if (row[0].includes('$')) {
				expressions.add(new RegExp('^' + row[0].replace(/(\$[0-9]+)/, '(.*)') + '$'))
			}
		}))
}

function trMatch(text: string, parts: string[]): string | undefined
{
	for (const expression of expressions) {
		const match = text.match(expression)
		if (!match) continue
		let   counter      = parts.length
		const replacements = []
		const trParts      = [...parts]
		for (const part of match.slice(1)) {
			const translatedPart = tr(part)
			trParts.push(translatedPart[0].toLocaleLowerCase() + translatedPart.slice(1))
			replacements.push('$' + trParts.length)
		}
		const trText = expression.source.slice(1, -1).replaceAll('(.*)', () => '$' + ++counter)
		return tr(trText, trParts)
	}
}
