const assert                               = require('node:assert/strict')
const { mkdtemp, writeFile }               = require('node:fs/promises')
const { rm }                                = require('node:fs/promises')
const { tmpdir }                            = require('node:os')
const { join }                              = require('node:path')
const test                                  = require('node:test')
const { tr, trInit, trLoad, trWithLanguage } = require('../cjs/translate')

test('isolates concurrent language contexts and supports reverse catalogs', async () => {
	const directory = await mkdtemp(join(tmpdir(), 'itrocks-translate-'))
	const file      = join(directory, 'fr-FR.csv')
	await writeFile(file, [
		'Hello;Bonjour',
		'Private: $1 recipients.;Privée : $1 destinataires.',
		'$1 invited $2 ($3).;$1 a invité $2 ($3).'
	].join('\n'))

	trInit('en-US')
	await trLoad(file, { language: 'fr-FR' })
	await trLoad(file, { language: 'en-US', reverse: true })

	const [french, english] = await Promise.all([
		trWithLanguage('fr-FR', async () => {
			await new Promise(resolve => setImmediate(resolve))
			return [tr('Hello'), tr('Private: $1 recipients.', ['2'])]
		}),
		trWithLanguage('en-US', async () => {
			await new Promise(resolve => setImmediate(resolve))
			return [tr('Bonjour'), tr('Privée : $1 destinataires.', ['2'])]
		})
	])

	assert.deepEqual(french, ['Bonjour', 'Privée : 2 destinataires.'])
	assert.deepEqual(english, ['Hello', 'Private: 2 recipients.'])
	assert.equal(
		trWithLanguage('en-US', () => tr('Alice a invité Bob (ami).')),
		'Alice invited Bob (ami).'
	)
	await rm(directory, { force: true, recursive: true })
})
