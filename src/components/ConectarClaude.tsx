import { useCallback, useEffect, useRef, useState } from 'react'
import { Button, Input, Modal } from 'antd'
import { Bot, Check, Copy, Download, ExternalLink, Link2, Plug } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { novoSegredo, hashToken } from '../../supabase/functions/_shared/pocket-ads/cifra.ts'
import { limparIdConta, urlConector, type RetornoGoogle } from '../utils/conexaoClaude'

const CHAVE_ESTADO = 'pocket_google_ads_estado'

interface Conexao {
    id: string
    rotulo: string | null
    criado_em: string | null
    ultimo_uso: string | null
}

interface ContaGoogle {
    modo: 'pocket' | 'proprio'
    google_email: string | null
    criado_em: string | null
    revogado_em: string | null
}

const MOTIVOS: Record<string, string> = {
    recusado: 'Você não permitiu o acesso no Google. Tente de novo e clique em Permitir.',
    erro_google: 'O Google devolveu um erro. Tente de novo em instantes.',
    expirou: 'O pedido expirou. Clique em Conectar com Google para começar de novo.',
    sem_refresh: 'O Google não liberou o acesso contínuo. Remova o Pocket em myaccount.google.com/permissions e conecte de novo.',
    erro_interno: 'Erro interno do Pocket ao conectar. Tente de novo ou avise o administrador.',
    configuracao: 'Pocket sem configuração do Google Ads. Avise o administrador.',
}

const fmtData = (iso: string | null) => (iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : null)

/** Chama a Edge Function e devolve o corpo; em erro HTTP lê o `erro` do JSON (supabase-js expõe a Response em `error.context`). */
async function chamarGoogleAds<T>(rota: string, body: Record<string, unknown> = {}): Promise<T> {
    const { data, error } = await supabase.functions.invoke(`google-ads-oauth/${rota}`, { body })
    if (error) {
        let msg = 'Não foi possível concluir. Tente de novo.'
        try {
            const corpo = await (error as { context?: Response }).context?.json()
            if (corpo && typeof corpo.erro === 'string') msg = corpo.erro
        } catch { /* sem corpo legível: mensagem genérica */ }
        throw new Error(msg)
    }
    return data as T
}

function Cartao({ icon: Icon, titulo, subtitulo, children }: { icon: typeof Bot; titulo: string; subtitulo: string; children: React.ReactNode }) {
    return (
        <section className="pk-card p-5 md:p-6">
            <div className="mb-5 flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-brand-soft text-brand-strong">
                    <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                    <h2 className="text-[15px] font-semibold tracking-tight text-foreground">{titulo}</h2>
                    <p className="mt-0.5 text-xs text-muted-foreground">{subtitulo}</p>
                </div>
            </div>
            {children}
        </section>
    )
}

interface Props {
    /** Volta do fluxo do Google (lida da URL pelo App). */
    retorno?: RetornoGoogle | null
    onRetornoUsado?: () => void
}

export function ConectarClaude({ retorno, onRetornoUsado }: Props) {
    const { user } = useAuth()

    // Cartão 1: conector do Claude
    const [rotulo, setRotulo] = useState('')
    const [gerando, setGerando] = useState(false)
    const [linkNovo, setLinkNovo] = useState<string | null>(null)
    const [copiado, setCopiado] = useState(false)
    const [links, setLinks] = useState<Conexao[]>([])

    const carregarLinks = useCallback(async () => {
        const { data, error } = await supabase
            .from('claude_conexoes')
            .select('id, rotulo, criado_em, ultimo_uso')
            .is('revogado_em', null)
            .order('criado_em', { ascending: false })
        if (error) { toast.error('Não consegui carregar seus links.'); return }
        setLinks((data ?? []) as Conexao[])
    }, [])

    const gerarLink = async () => {
        if (!user) return
        setGerando(true)
        try {
            const segredo = novoSegredo()
            const token_hash = await hashToken(segredo)
            const { error } = await supabase.from('claude_conexoes').insert({
                profile_id: user.id, token_hash, rotulo: rotulo.trim() || null,
            })
            if (error) throw error
            setLinkNovo(urlConector(import.meta.env.VITE_SUPABASE_URL as string, segredo))
            setCopiado(false)
            setRotulo('')
            await carregarLinks()
        } catch {
            toast.error('Não foi possível gerar o link. Tente de novo.')
        } finally {
            setGerando(false)
        }
    }

    const copiar = async () => {
        if (!linkNovo) return
        try {
            await navigator.clipboard.writeText(linkNovo)
            setCopiado(true)
            toast.success('Link copiado.')
        } catch {
            toast.error('Não consegui copiar. Selecione o link e copie manualmente.')
        }
    }

    const revogar = (c: Conexao) => {
        Modal.confirm({
            title: 'Revogar este link?',
            content: 'O Claude que usa este link perde o acesso ao Pocket. Você pode gerar outro quando quiser.',
            okText: 'Revogar',
            okType: 'danger',
            cancelText: 'Cancelar',
            onOk: async () => {
                const { error } = await supabase.from('claude_conexoes').update({ revogado_em: new Date().toISOString() }).eq('id', c.id)
                if (error) { toast.error('Não foi possível revogar.'); return }
                toast.success('Link revogado.')
                await carregarLinks()
            },
        })
    }

    // Cartão 2: Google Ads
    const [conta, setConta] = useState<ContaGoogle | null>(null)
    const [carregandoConta, setCarregandoConta] = useState(true)
    const [ocupado, setOcupado] = useState(false)
    const [avancado, setAvancado] = useState({ developer_token: '', client_id: '', client_secret: '', refresh_token: '', login_customer_id: '' })
    const [contasAcessiveis, setContasAcessiveis] = useState<string[] | null>(null)

    const carregarConta = useCallback(async () => {
        const { data } = await supabase.from('minha_conexao_google_ads').select('modo, google_email, criado_em, revogado_em').maybeSingle()
        const c = data as ContaGoogle | null
        setConta(c && !c.revogado_em ? c : null)
        setCarregandoConta(false)
    }, [])

    useEffect(() => { void carregarLinks(); void carregarConta() }, [carregarLinks, carregarConta])

    // Volta do Google: confirma uma vez (a URL ja foi limpa pelo App; o codigo nunca vai para log).
    const retornoTratado = useRef(false)
    useEffect(() => {
        if (!retorno?.googleAds || retornoTratado.current) return
        retornoTratado.current = true
        const { googleAds, motivo, confirmacao } = retorno
        onRetornoUsado?.()
        if (googleAds === 'ok') { toast.success('Google Ads conectado.'); void carregarConta(); return }
        if (googleAds === 'erro') { toast.error(MOTIVOS[motivo ?? ''] ?? 'Não foi possível conectar o Google Ads.'); return }
        const estado = (() => { try { return sessionStorage.getItem(CHAVE_ESTADO) } catch { return null } })()
        try { sessionStorage.removeItem(CHAVE_ESTADO) } catch { /* sem storage */ }
        if (!estado || !confirmacao) {
            toast.error('Esta confirmação não vale neste navegador. Clique em Conectar com Google de novo.')
            return
        }
        void (async () => {
            try {
                const r = await chamarGoogleAds<{ google_email?: string }>('confirmar', { estado, confirmacao })
                toast.success(r.google_email ? `Google Ads conectado como ${r.google_email}.` : 'Google Ads conectado.')
                await carregarConta()
            } catch (e) {
                toast.error((e as Error).message)
            }
        })()
    }, [retorno, onRetornoUsado, carregarConta])

    const conectarGoogle = async () => {
        setOcupado(true)
        try {
            const { url, estado } = await chamarGoogleAds<{ url: string; estado: string }>('iniciar')
            try { sessionStorage.setItem(CHAVE_ESTADO, estado) } catch { /* sem storage: a confirmação vai falhar com aviso */ }
            location.assign(url)
        } catch (e) {
            toast.error((e as Error).message)
            setOcupado(false)
        }
    }

    const desconectar = () => {
        const proprio = conta?.modo === 'proprio'
        Modal.confirm({
            title: 'Desconectar o Google Ads?',
            content: proprio
                ? 'Seu refresh token também será revogado no Google. Se você o usa em outro lugar, ele deixará de funcionar lá.'
                : 'O Pocket deixa de enviar termos ao Google Ads com a sua conta.',
            okText: 'Desconectar',
            okType: 'danger',
            cancelText: 'Cancelar',
            onOk: async () => {
                try {
                    await chamarGoogleAds('desconectar')
                    toast.success('Google Ads desconectado.')
                    setConta(null)
                } catch (e) {
                    toast.error((e as Error).message)
                }
            },
        })
    }

    const salvarAvancado = async () => {
        const { developer_token, client_id, client_secret, refresh_token, login_customer_id } = avancado
        if (!client_id.trim() || !client_secret.trim() || !refresh_token.trim()) {
            toast.error('Preencha client ID, client secret e refresh token.')
            return
        }
        let mcc: string | null = null
        if (login_customer_id.trim()) {
            mcc = limparIdConta(login_customer_id)
            if (!mcc) { toast.error('O ID do MCC deve ter 10 dígitos.'); return }
        }
        setOcupado(true)
        try {
            const r = await chamarGoogleAds<{ ok: boolean; contas: string[] }>('proprio', {
                ...(developer_token.trim() ? { developer_token: developer_token.trim() } : {}),
                client_id: client_id.trim(),
                client_secret: client_secret.trim(), refresh_token: refresh_token.trim(),
                ...(mcc ? { login_customer_id: mcc } : {}),
            })
            setContasAcessiveis(r.contas ?? [])
            setAvancado({ developer_token: '', client_id: '', client_secret: '', refresh_token: '', login_customer_id: '' })
            toast.success('Google Ads conectado com os seus tokens.')
            await carregarConta()
        } catch (e) {
            toast.error((e as Error).message)
        } finally {
            setOcupado(false)
        }
    }

    const campo = (k: keyof typeof avancado) => ({
        value: avancado[k],
        onChange: (e: React.ChangeEvent<HTMLInputElement>) => setAvancado(a => ({ ...a, [k]: e.target.value })),
        autoComplete: 'off',
    })

    return (
        <div className="mx-auto max-w-3xl space-y-6">
            <div>
                <h1 className="font-display text-xl font-semibold tracking-tight text-foreground">Conectar ao Claude</h1>
                <p className="mt-1 text-sm text-muted-foreground">Use o Claude para subir termos respondidos ao Google Ads, com a sua conta.</p>
            </div>

            <Cartao icon={Link2} titulo="Conectar o Claude" subtitulo="Gere o seu link pessoal e adicione o Pocket como conector no Claude.">
                <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                        placeholder="Rótulo (opcional), ex.: Notebook do trabalho"
                        value={rotulo}
                        maxLength={60}
                        onChange={e => setRotulo(e.target.value)}
                        onPressEnter={gerarLink}
                    />
                    <Button type="primary" loading={gerando} onClick={gerarLink} className="sm:shrink-0">Gerar link</Button>
                </div>

                {linkNovo && (
                    <div className="mt-4 rounded-xl border border-border bg-surface-2 p-3">
                        <p className="mb-2 text-xs font-medium text-status-duv">Copie agora: este link aparece só uma vez.</p>
                        <div className="flex items-center gap-2">
                            <code className="min-w-0 flex-1 break-all rounded-lg bg-background px-2.5 py-2 text-[12px] text-foreground">{linkNovo}</code>
                            <Button icon={copiado ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} onClick={copiar}>
                                {copiado ? 'Copiado' : 'Copiar'}
                            </Button>
                        </div>
                    </div>
                )}

                <ol className="mt-5 space-y-2 text-sm text-muted-foreground">
                    <li><span className="font-medium text-foreground">1.</span> Gere o link acima.</li>
                    <li>
                        <span className="font-medium text-foreground">2.</span> No Claude: Customize › Connectors › Add custom connector › cole o link.
                        {' '}No Claude Code: <code className="rounded bg-surface-2 px-1.5 py-0.5 text-[12px] text-foreground">claude mcp add --transport http pocket &lt;link&gt;</code>
                    </li>
                    <li><span className="font-medium text-foreground">3.</span> Baixe a skill abaixo e envie em Customize › Skills.</li>
                    <li><span className="font-medium text-foreground">4.</span> Peça ao Claude, por exemplo: &ldquo;Quais termos da Endomarcas estão prontos para subir?&rdquo;</li>
                </ol>

                <div className="mt-4">
                    <Button href="/downloads/pocket-google-ads.zip" download icon={<Download className="h-4 w-4" />}>Baixar skill (.zip)</Button>
                </div>

                <div className="mt-6 border-t border-border pt-4">
                    <h3 className="mb-2 text-[13px] font-semibold text-foreground">Seus links ativos</h3>
                    {links.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Nenhum link ativo.</p>
                    ) : (
                        <ul className="divide-y divide-border">
                            {links.map(l => (
                                <li key={l.id} className="flex items-center justify-between gap-3 py-2.5">
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-medium text-foreground">{l.rotulo || 'Sem rótulo'}</p>
                                        <p className="text-xs text-muted-foreground">
                                            Criado em {fmtData(l.criado_em) ?? '—'} · {l.ultimo_uso ? `último uso ${fmtData(l.ultimo_uso)}` : 'nunca usado'}
                                        </p>
                                    </div>
                                    <Button size="small" danger onClick={() => revogar(l)}>Revogar</Button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </Cartao>

            <Cartao icon={Plug} titulo="Conectar o Google Ads" subtitulo="O Pocket envia os termos com a sua conta do Google Ads.">
                {carregandoConta ? (
                    <p className="text-sm text-muted-foreground">Carregando…</p>
                ) : conta ? (
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <p className="text-sm font-medium text-status-seg">
                                Conectado{conta.google_email ? ` como ${conta.google_email}` : ''}
                            </p>
                            <p className="text-xs text-muted-foreground">
                                {conta.modo === 'proprio' ? 'Modo avançado (seus tokens)' : 'Login com Google'}
                                {conta.criado_em ? ` · desde ${fmtData(conta.criado_em)}` : ''}
                            </p>
                        </div>
                        <Button danger onClick={desconectar}>Desconectar</Button>
                    </div>
                ) : (
                    <Button type="primary" loading={ocupado} onClick={conectarGoogle}>Conectar com Google</Button>
                )}

                <details className="mt-5 rounded-xl border border-border bg-surface-2 p-3">
                    <summary className="cursor-pointer text-sm font-medium text-foreground">Modo avançado</summary>
                    <p className="mt-2 text-xs text-muted-foreground">Use seus próprios tokens do Google Ads (sem passar pela tela de login do Google).</p>
                    <div className="mt-3 grid gap-2.5">
                        <Input.Password placeholder="Token de desenvolvedor (opcional — o Google não exige mais desde 09/09/2026)" {...campo('developer_token')} />
                        <Input placeholder="Client ID" {...campo('client_id')} />
                        <Input.Password placeholder="Client secret" {...campo('client_secret')} />
                        <Input.Password placeholder="Refresh token" {...campo('refresh_token')} />
                        <Input placeholder="ID do MCC (opcional), ex.: 123-456-7890" {...campo('login_customer_id')} />
                        <div className="flex flex-wrap items-center gap-3">
                            <Button type="primary" loading={ocupado} onClick={salvarAvancado}>Conectar com meus tokens</Button>
                            <a href="/downloads/TUTORIAL_GOOGLE_ADS.md" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-brand-strong hover:underline">
                                Tutorial passo a passo <ExternalLink className="h-3 w-3" />
                            </a>
                        </div>
                    </div>
                    {contasAcessiveis && (
                        <div className="mt-3 rounded-lg bg-background p-3 text-xs text-muted-foreground">
                            <p className="mb-1 font-medium text-foreground">Contas acessíveis ({contasAcessiveis.length})</p>
                            {contasAcessiveis.length === 0 ? 'Nenhuma conta encontrada.' : contasAcessiveis.join(', ')}
                        </div>
                    )}
                </details>
            </Cartao>
        </div>
    )
}
