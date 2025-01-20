import { readdir, readFile, stat, writeFile } from 'fs/promises'
import { join } from 'path'

async function addJsExtensions(dir: string)
{
	for (const file of await readdir(dir)) {
		if (file === 'esm.js') continue
		const filePath = join(dir, file)
		if ((await stat(filePath)).isFile() && filePath.endsWith('.js')) {
			let content = (await readFile(filePath, 'utf-8')).toString()
			if (content.includes('require(')) {
				content =
					"import { createRequire } from 'module'\n"
					+ "const require = createRequire(import.meta.url)\n"
					+ content
			}
			await writeFile(filePath, content, 'utf-8')
		}
	}
}
addJsExtensions('esm').catch(error => { throw error }).then()
