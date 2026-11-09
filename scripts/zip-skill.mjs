// Empacota a skill do Claude para download no Pocket.
// `npm run skill:zip`: claude/skills/pocket-google-ads/ → public/downloads/pocket-google-ads.zip
// e copia o TUTORIAL_GOOGLE_ADS.md para public/downloads/ (a tela "Conectar ao Claude" linka os dois).
import { copyFileSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { zipSync } from 'fflate';

const PASTA_NO_ZIP = 'pocket-google-ads';
// Data fixa: o mesmo conteúdo gera o mesmo zip (sem diff à toa no git).
const MTIME = new Date('2026-01-01T00:00:00Z');

/** Arquivos da pasta, recursivo, ignorando ocultos (.DS_Store, .git…), em ordem estável. */
function listarArquivos(pasta) {
    const saida = [];
    for (const item of readdirSync(pasta, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
        if (item.name.startsWith('.')) continue;
        const caminho = join(pasta, item.name);
        if (item.isDirectory()) saida.push(...listarArquivos(caminho));
        else if (item.isFile()) saida.push(caminho);
    }
    return saida;
}

/**
 * Zipa `origem` em `destino`, com tudo dentro de `pocket-google-ads/`.
 * @param {string} origem pasta da skill
 * @param {string} destino caminho do .zip (as pastas são criadas)
 * @returns {Promise<string[]>} caminhos dentro do zip
 */
export async function zipSkill(origem, destino) {
    const arquivos = listarArquivos(origem);
    if (!arquivos.length) throw new Error(`Nenhum arquivo em ${origem}`);
    const entradas = {};
    for (const arquivo of arquivos) {
        const nome = `${PASTA_NO_ZIP}/${relative(origem, arquivo).split(sep).join('/')}`;
        entradas[nome] = [new Uint8Array(readFileSync(arquivo)), { mtime: MTIME }];
    }
    mkdirSync(dirname(destino), { recursive: true });
    writeFileSync(destino, zipSync(entradas, { level: 9 }));
    return Object.keys(entradas);
}

const ehCli = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (ehCli) {
    const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
    const origem = join(raiz, 'claude', 'skills', 'pocket-google-ads');
    const downloads = join(raiz, 'public', 'downloads');
    const caminhos = await zipSkill(origem, join(downloads, 'pocket-google-ads.zip'));
    copyFileSync(join(origem, 'TUTORIAL_GOOGLE_ADS.md'), join(downloads, 'TUTORIAL_GOOGLE_ADS.md'));
    console.log(`public/downloads/pocket-google-ads.zip (${caminhos.length} arquivos):\n  ${caminhos.join('\n  ')}`);
    console.log('public/downloads/TUTORIAL_GOOGLE_ADS.md copiado.');
}
