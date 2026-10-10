const assert = require('node:assert/strict')
const { mkdtemp, rm, writeFile } = require('node:fs/promises')
const { tmpdir } = require('node:os')
const { join } = require('node:path')
const test = require('node:test')
const { tr, trInit, trLoad, trWithLanguage } = require('../cjs/translate')

test('resolves sentences, inline parts and specific patterns before generic composites', async () => {
	const directory = await mkdtemp(join(tmpdir(), 'itrocks-fragments-'))
	try {
		const file = join(directory, 'fr-FR.csv')
		// Generic entries precede specific patterns to check independence from catalog loading order.
		await writeFile(file, [
			'add $1;ajouter $1',
			'$1 deleted;$1 supprimé',
			'add a date;ajoutez une date',
			'posts were deleted;les publications ont été supprimées',
			'Folks.re never imports your contacts;Folks.re n’importe jamais vos contacts',
			'video with H.264;vidéo avec H.264',
			'current password;mot de passe actuel',
			'private: $1 recipients;privée : $1 destinataires',
			'view $1;consulter $1',
			'view photo albums by $1;voir les albums photo de $1',
			'· modified $1;· modifié le $1',
			'":";" :"',
			'?; ?'
		].join('\n'))
		trInit('en-US')
		await trLoad(file, 'fr-FR')
		trWithLanguage('fr-FR', () => {
			assert.equal(tr('Add a date. Folks.re never imports your contacts.'),
				'Ajoutez une date. Folks.re n’importe jamais vos contacts.')
			assert.equal(tr('Posts were deleted.'), 'Les publications ont été supprimées.')
			assert.equal(tr('Current password?'), 'Mot de passe actuel\u00a0?')
			assert.equal(tr('Video with H.264.'), 'Vidéo avec H.264.')
			assert.equal(tr('Current password $1', ['<input type="password">']),
				'Mot de passe actuel <input type="password">')
			assert.equal(tr('$1 Current password.', ['<strong>Label</strong>']),
				'<strong>Label</strong> Mot de passe actuel.')
			assert.equal(tr('View photo albums by Alice'), 'Voir les albums photo de Alice')
			assert.equal(tr('· Modified Yesterday'), '· modifié le Yesterday')
			assert.equal(tr('Private: $1 recipients.', ['2']), 'Privée : 2 destinataires.')
			assert.equal(tr(' Current password \n'), ' Mot de passe actuel \n')
			assert.equal(tr('Unknown.name 1.5'), 'Unknown.name 1.5')
		})
		assert.equal(trWithLanguage('en-US', () => tr('Add a date.')), 'Add a date.')
	} finally {
		await rm(directory, { force: true, recursive: true })
	}
})
