const assert                               = require('node:assert/strict')
const { mkdtemp, writeFile }               = require('node:fs/promises')
const { rm }                                = require('node:fs/promises')
const { tmpdir }                            = require('node:os')
const { join }                              = require('node:path')
const test                                  = require('node:test')
const { tr, trInit, trLoad, trReverse, trWithLanguage } = require('../cjs/translate')

test('isolates concurrent language contexts and translates the active catalog in either direction', async () => {
	const directory = await mkdtemp(join(tmpdir(), 'itrocks-translate-'))
	const file      = join(directory, 'fr-FR.csv')
	await writeFile(file, [
		'hello;bonjour',
		'private: $1 recipients;privée : $1 destinataires',
		'$1 invited $2 ($3);$1 a invité $2 ($3)',
		'":";" :"',
		'first;premier',
		'second;second'
	].join('\n'))

	trInit('en-US')
	await trLoad(file, 'fr-FR')

	const [french, english] = await Promise.all([
		trWithLanguage('fr-FR', async () => {
			await new Promise(resolve => setImmediate(resolve))
			return [
				tr('Hello'), tr('Private: $1 recipients.', ['2']), tr('First: second'), trReverse('Bonjour')
			]
		}),
		trWithLanguage('en-US', async () => {
			await new Promise(resolve => setImmediate(resolve))
			return [tr('Hello'), trReverse('Bonjour')]
		})
	])

	assert.deepEqual(french, ['Bonjour', 'Privée : 2 destinataires.', 'Premier\u00a0: second', 'hello'])
	assert.deepEqual(english, ['Hello', 'Bonjour'])
	await rm(directory, { force: true, recursive: true })
})
