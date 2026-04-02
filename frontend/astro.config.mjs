// @ts-check
import { defineConfig } from 'astro/config';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pfxPath = resolve(__dirname, 'certs', 'biblio-dev.pfx');
const httpsConfig = existsSync(pfxPath)
	? {
			pfx: readFileSync(pfxPath),
			passphrase: 'biblio-dev',
		}
	: undefined;

// https://astro.build/config
export default defineConfig({
	vite: {
		server: {
			https: httpsConfig,
			proxy: {
				'/api': 'http://127.0.0.1:8000',
			},
		},
	},
});
