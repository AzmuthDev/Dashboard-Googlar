import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { unzipSync, strFromU8 } from 'fflate';
import { zipSkill } from './zip-skill.mjs';

test('zipSkill: zipa a pasta inteira sob pocket-google-ads/ com o mesmo conteúdo', async () => {
    const raiz = mkdtempSync(join(tmpdir(), 'zip-skill-'));
    try {
        const origem = join(raiz, 'skill');
        mkdirSync(join(origem, 'a'), { recursive: true });
        writeFileSync(join(origem, 'SKILL.md'), '---\nname: x\n---\nOlá, ação ✅\n');
        writeFileSync(join(origem, 'a', 'b.md'), 'conteúdo b\n');
        const destino = join(raiz, 'saida', 'pocket-google-ads.zip');

        const caminhos = await zipSkill(origem, destino);

        assert.deepEqual([...caminhos].sort(), ['pocket-google-ads/SKILL.md', 'pocket-google-ads/a/b.md']);
        const arquivos = unzipSync(readFileSync(destino));
        assert.deepEqual(Object.keys(arquivos).sort(), ['pocket-google-ads/SKILL.md', 'pocket-google-ads/a/b.md']);
        assert.equal(strFromU8(arquivos['pocket-google-ads/SKILL.md']), '---\nname: x\n---\nOlá, ação ✅\n');
        assert.equal(strFromU8(arquivos['pocket-google-ads/a/b.md']), 'conteúdo b\n');
    } finally {
        rmSync(raiz, { recursive: true, force: true });
    }
});
