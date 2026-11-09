// Helpers WebCrypto: roda em Node 24, Deno e navegador (sem imports de plataforma).

const codificador = new TextEncoder();
const decodificador = new TextDecoder();

const paraB64 = (bytes: Uint8Array): string => {
    let s = '';
    for (const b of bytes) s += String.fromCharCode(b);
    return btoa(s);
};

const deB64 = (b64: string): Uint8Array<ArrayBuffer> => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

/** SHA-256 do segredo, em hexadecimal minúsculo (64 caracteres). */
export const hashToken = async (segredo: string): Promise<string> => {
    const digest = await globalThis.crypto.subtle.digest('SHA-256', codificador.encode(segredo));
    return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
};

/** 32 bytes aleatórios em base64url (43 caracteres, sem padding). */
export const novoSegredo = (): string =>
    paraB64(globalThis.crypto.getRandomValues(new Uint8Array(32)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

const importarChave = async (chaveB64: string): Promise<CryptoKey> => {
    const bruta = deB64(chaveB64);
    if (bruta.length !== 32) throw new Error('Chave de cifra inválida: esperados 32 bytes em base64.');
    return await globalThis.crypto.subtle.importKey('raw', bruta, 'AES-GCM', false, ['encrypt', 'decrypt']);
};

/** AES-256-GCM. Formato: "<iv base64>:<dados base64>" com IV aleatório de 12 bytes. */
export const cifrar = async (texto: string, chaveB64: string): Promise<string> => {
    const chave = await importarChave(chaveB64);
    const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
    const dados = await globalThis.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, chave, codificador.encode(texto));
    return `${paraB64(iv)}:${paraB64(new Uint8Array(dados))}`;
};

/** Inverso de `cifrar`. Rejeita formato malformado, chave errada ou dado adulterado. */
export const decifrar = async (cifrado: string, chaveB64: string): Promise<string> => {
    const partes = cifrado.split(':');
    if (partes.length !== 2 || !partes[0] || !partes[1]) throw new Error('Texto cifrado em formato inválido.');
    const iv = deB64(partes[0]);
    if (iv.length !== 12) throw new Error('Texto cifrado em formato inválido.');
    const chave = await importarChave(chaveB64);
    const claro = await globalThis.crypto.subtle.decrypt({ name: 'AES-GCM', iv }, chave, deB64(partes[1]));
    return decodificador.decode(claro);
};
