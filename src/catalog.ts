import { access }   from 'node:fs/promises'
import { readFile } from 'node:fs/promises'

const parseCsv = require('papaparse').parse

export type Catalog = Map<string, string>

const catalogs = new Map<string, Catalog>

export const translations = new Map<string, string>

catalogs.set('en-US', translations)

export function catalog(language: string): Catalog
{
	let result = catalogs.get(language)
	if (!result) {
		result = new Map
		catalogs.set(language, result)
	}
	return result
}

export function catalogClear(language: string)
{
	catalogs.clear()
	translations.clear()
	catalogs.set(language, translations)
}

export async function catalogLoad(file: string, language: string)
{
	try { await access(file) }
	catch { return }
	const translations = catalog(language)
	return readFile(file, 'utf-8')
		.then((data): [string, string][] => parseCsv(data, { delimiter: ';' }).data)
		.then(data => data.forEach(([source, target]) => {
			if ((typeof source !== 'string') || (typeof target !== 'string') || (source === target)) return
			translations.set(source, target)
		}))
}
