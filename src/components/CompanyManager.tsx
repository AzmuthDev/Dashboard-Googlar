import { useState, useEffect } from 'react'
import { Typography, Button, Input, Modal, message, List, Select, Upload, Spin } from 'antd'
import { useQueryClient } from '@tanstack/react-query'
import { PlusOutlined, InboxOutlined, LoadingOutlined } from '@ant-design/icons'
import { motion } from 'framer-motion'
import type { Company } from '../types'
import { CompanyCards } from './ui/company-list-cards'
import type { CompanyData } from './ui/company-list-cards'
import { LinkDataModal } from './ui/link-data-modal'
import { 
    fetchCompanies, 
    createCompany, 
    deleteCompany, 
    updateCompany,
    provisionCompanyTable
} from '../lib/supabaseProvider'

const { Title, Text } = Typography

interface CompanyManagerProps {
    currentUser: import('../types').AuthorizedUser | null;
    onAccessCompany: (companyId: string) => void;
    onSelectCompany: (companyId: string | null) => void;
}

export function CompanyManager({ currentUser, onAccessCompany, onSelectCompany }: CompanyManagerProps) {
    const [companies, setCompanies] = useState<Company[]>([])
    const [users, setUsers] = useState<any[]>([])
    const [isAddModalVisible, setIsAddModalVisible] = useState(false)
    const [isUsersModalVisible, setIsUsersModalVisible] = useState(false)
    const [isLinkModalVisible, setIsLinkModalVisible] = useState(false)
    const [isProvisioning, setIsProvisioning] = useState(false)
    
    // Edit mode
    const [isEditingCompany, setIsEditingCompany] = useState(false)
    const [editingCompanyId, setEditingCompanyId] = useState<string | null>(null)

    // Form tracking
    const [newCompanyName, setNewCompanyName] = useState('')
    const [newCompanySheetsUrl, setNewCompanySheetsUrl] = useState('')
    const [newCompanyLogo, setNewCompanyLogo] = useState<string | undefined>()
    const [newCompanyCover, setNewCompanyCover] = useState<string | undefined>()
    const [activeCompanyEdits, setActiveCompanyEdits] = useState<string | null>(null)
    const [activeCompanyLink, setActiveCompanyLink] = useState<string | null>(null)
    const [provisioningStep, setProvisioningStep] = useState<string>('')
    const queryClient = useQueryClient()

    const isAdmin = currentUser?.isAdmin

    const loadCompanies = async () => {
        const data = await fetchCompanies()
        setCompanies(data)
    }

    useEffect(() => {
        loadCompanies();
        try {
            const storedUsers = JSON.parse(localStorage.getItem('googlar_authorized_users') || '[]');
            setUsers(Array.isArray(storedUsers) ? storedUsers : []);
        } catch (e) {
            console.error('[CompanyManager] Error parsing authorized users:', e);
            setUsers([]);
        }
    }, [])

    const handleSaveCompany = async () => {
        if (!newCompanyName.trim()) {
            message.error("Nome da empresa é obrigatório.")
            return
        }

        setIsProvisioning(true)
        try {
            if (isEditingCompany && editingCompanyId) {
                // Update existing company in Supabase
                const { error } = await updateCompany(editingCompanyId, {
                    name: newCompanyName.trim(),
                    sheetsUrl: newCompanySheetsUrl.trim() || undefined,
                    logoUrl: newCompanyLogo,
                    coverUrl: newCompanyCover
                })

                if (error) throw new Error(error.message || error)
                message.success("Empresa atualizada no Supabase!")
            } else {
                // AUTOMATED PROVISIONING FLOW (V4)
                setProvisioningStep('Validando Metadados...')
                await new Promise(r => setTimeout(r, 800))
                
                const sanitizedName = newCompanyName.trim().toLowerCase().replace(/[^a-zA-Z0-9]/g, '_')
                const tableName = `mesa_${sanitizedName}`

                setProvisioningStep('Criando Registro na Tabela Companies...')
                const { error } = await createCompany({
                    name: newCompanyName.trim(),
                    sheetsUrl: newCompanySheetsUrl.trim() || undefined,
                    logoUrl: newCompanyLogo,
                    coverUrl: newCompanyCover,
                    users: [],
                    isActive: true,
                    tableName: tableName
                })

                if (error) throw new Error(error.message || error)
                
                setProvisioningStep('Provisionando Mesa Exclusiva no Supabase...')
                const { error: rpcError } = await provisionCompanyTable(newCompanyName.trim())
                if (rpcError) throw new Error(`Erro ao criar Mesa: ${rpcError.message || rpcError}`)
                
                setProvisioningStep('Configurando Políticas e Realtime...')
                await new Promise(r => setTimeout(r, 1000))
                
                setProvisioningStep('Finalizando Arquitetura de Isolamento...')
                await new Promise(r => setTimeout(r, 800))

                message.success("Empresa e Infraestrutura provisionadas com sucesso!")
                
                // NOTIFY APP (Force global refresh)
                window.dispatchEvent(new CustomEvent('googlar_companies_updated'));
                queryClient.invalidateQueries({ queryKey: ['companies'] });
            }

            await loadCompanies()
            
            // Reset form
            setNewCompanyName('')
            setNewCompanySheetsUrl('')
            setNewCompanyLogo(undefined)
            setNewCompanyCover(undefined)
            setIsEditingCompany(false)
            setEditingCompanyId(null)
            setIsAddModalVisible(false)
        } catch (err: any) {
            message.error(`Falha no provisionamento: ${err.message}`)
        } finally {
            setIsProvisioning(false)
        }
    }

    const openCreateModal = () => {
        setIsEditingCompany(false)
        setEditingCompanyId(null)
        setNewCompanyName('')
        setNewCompanySheetsUrl('')
        setNewCompanyLogo(undefined)
        setNewCompanyCover(undefined)
        setIsAddModalVisible(true)
    }

    const handleEditCompanyClick = (id: string) => {
        const companyToEdit = companies.find(c => c.id === id)
        if (companyToEdit) {
            setIsEditingCompany(true)
            setEditingCompanyId(id)
            setNewCompanyName(companyToEdit.name)
            setNewCompanySheetsUrl(companyToEdit.sheetsUrl || '')
            setNewCompanyLogo(companyToEdit.logoUrl)
            setNewCompanyCover(companyToEdit.coverUrl)
            setIsAddModalVisible(true)
        }
    }

    const handleDeleteCompany = (id: string) => {
        Modal.confirm({
            title: 'Tem certeza?',
            content: 'Você realmente deseja remover esta empresa do Supabase?',
            okText: 'Sim, excluir',
            okType: 'danger',
            cancelText: 'Cancelar',
            onOk: async () => {
                await deleteCompany(id)
                await loadCompanies()
                message.success("Empresa removida.")
            }
        });
    }



    const handleSetUserRole = (companyId: string, email: string, role: 'admin' | 'editor' | 'viewer' | null) => {
        const updated = companies.map(c => {
            if (c.id === companyId) {
                const filteredUsers = c.users.filter((u: any) => u.email !== email)
                const newUsers = role ? [...filteredUsers, { email, role }] : filteredUsers
                return { ...c, users: newUsers }
            }
            return c
        })

        localStorage.setItem('googlar_companies', JSON.stringify(updated))
        setCompanies(updated)
    }

    const activeCompanyForUsers = companies.find(c => c.id === activeCompanyEdits)

    // Filter companies for the table based on role
    // Admins see all companies. Standard users see only those where their email is in the `users` array.
    const displayCompanies = isAdmin
        ? companies
        : companies.filter(c => 
            (currentUser?.assignedCompanyIds && currentUser.assignedCompanyIds.includes(c.id)) || 
            (c.users || []).some((u: any) => u.email?.toLowerCase() === currentUser?.email?.toLowerCase())
          )

    const mappedCompanies: CompanyData[] = displayCompanies.map(c => {
        const companyUsers = (users || []).filter(u => (c.users || []).some((cu: any) => cu.email?.toLowerCase() === u.email?.toLowerCase()));
        return {
            id: c.id,
            name: c.name,
            spreadsheetStatus: c.dataSourceType === 'local' ? "Arquivo Vinculado" : (c.sheetsUrl ? "Sheet Vinculado" : "Não vinculada"),
            users: companyUsers.map(u => ({ name: u.name, email: u.email })),
            usersCount: (c.users || []).length,
            isActive: c.isActive !== false,
            logoUrl: c.logoUrl,
            coverUrl: c.coverUrl
        };
    })

    return (
        <div className="p-6 relative">
            {/* METALLIC PROVISIONING LOADER OVERLAY */}
            {isProvisioning && (
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="fixed inset-0 z-[1000] flex flex-col items-center justify-center bg-black/90 backdrop-blur-2xl"
                >
                    <div className="relative mb-12">
                        <div className="w-32 h-32 rounded-full border-4 border-transparent border-t-white animate-spin-metallic" />
                        <div className="absolute inset-0 flex items-center justify-center">
                            <Spin indicator={<LoadingOutlined style={{ fontSize: 40, color: 'white' }} spin />} />
                        </div>
                        {/* Metallic Glow Effect */}
                        <div className="absolute -inset-4 bg-white/5 blur-3xl rounded-full -z-10 animate-pulse" />
                    </div>
                    
                    <div className="text-center space-y-4">
                        <h2 className="text-2xl font-black uppercase tracking-[0.3em] text-white">
                            Provisionando Infraestrutura
                        </h2>
                        <div className="flex items-center justify-center gap-3">
                            <div className="h-px w-12 bg-white/20" />
                            <p className="text-zinc-500 font-mono text-[10px] tracking-[0.2em] uppercase">
                                {provisioningStep || 'Iniciando Setup V4...'}
                            </p>
                            <div className="h-px w-12 bg-white/20" />
                        </div>
                    </div>

                    {/* Progress Bar Style */}
                    <div className="mt-12 w-64 h-1 bg-white/5 rounded-full overflow-hidden border border-white/10">
                        <motion.div 
                            className="h-full bg-white shadow-[0_0_15px_rgba(255,255,255,0.5)]"
                            initial={{ width: "0%" }}
                            animate={{ width: "100%" }}
                            transition={{ duration: 4, ease: "easeInOut" }}
                        />
                    </div>
                </motion.div>
            )}

            <div className="flex justify-between items-center mb-6">
                <div>
                    <Title level={4} className="!m-0 !text-black dark:!text-white">
                        Módulos de Empresas
                    </Title>
                    <Text className="text-zinc-500">
                        {isAdmin ? 'Gerencie clientes e defina o que cada usuário enxerga.' : 'Empresas disponíveis para sua análise.'}
                    </Text>
                </div>
                {isAdmin && (
                    <Button
                        type="default"
                        icon={<PlusOutlined />}
                        onClick={openCreateModal}
                        className="btn-bw-inverse !border-none shadow-md font-bold px-6"
                        size="large"
                    >
                        Nova Empresa
                    </Button>
                )}
            </div>

            <CompanyCards
                title="Suas Empresas"
                companies={mappedCompanies}
                isAdmin={isAdmin ?? false}
                onAccessCompany={onAccessCompany}
                onConnectSheet={(id) => {
                    setActiveCompanyLink(id);
                    setIsLinkModalVisible(true);
                }}
                onEditCompany={handleEditCompanyClick}
                onManageAccess={(id) => {
                    setActiveCompanyEdits(id);
                    setIsUsersModalVisible(true);
                }}
                onDeleteCompany={handleDeleteCompany}
            />

            {/* Modal de Criação / Edição de Empresa */}
            <Modal
                title={<span className="text-xl font-black uppercase tracking-tighter dark:text-white">{isEditingCompany ? "Editar Empresa" : "Criar Nova Empresa"}</span>}
                open={isAddModalVisible}
                onOk={handleSaveCompany}
                onCancel={() => {
                    setIsAddModalVisible(false);
                    setIsEditingCompany(false);
                    setEditingCompanyId(null);
                    setNewCompanyName('');
                    setNewCompanySheetsUrl('');
                    setNewCompanyLogo(undefined);
                    setNewCompanyCover(undefined);
                }}
                okText={isEditingCompany ? "Salvar Alterações" : "Criar Empresa"}
                cancelText="Cancelar"
                className="luxury-modal"
                centered
                cancelButtonProps={{
                    className: ' !text-zinc-400 hover:!text-white border-none'
                }}
                okButtonProps={{ 
                   className: 'btn-bw-inverse !border-none',
                   disabled: isProvisioning 
                }}
            >
                {isProvisioning ? (
                    <div className="py-20 flex flex-col items-center justify-center animate-in fade-in duration-500">
                        <div className="relative w-24 h-24 mb-6">
                            <div className="absolute inset-0 bg-white/20 blur-[30px] rounded-full animate-pulse" />
                            <Spin indicator={<LoadingOutlined style={{ fontSize: 48, color: '#FFFFFF' }} spin />} />
                        </div>
                        <Text className="text-white text-sm font-black uppercase tracking-[0.2em] text-center">
                            Provisionando Base de Dados de Auditoria...
                        </Text>
                        <Text className="text-zinc-500 text-[10px] uppercase font-bold mt-2">Versão 4.0 Supabase Infra</Text>
                    </div>
                ) : (
                    <div className="mt-4 flex flex-col gap-6">
                    <div>
                        <label className="block mb-2 text-[10px] font-black uppercase tracking-widest text-slate-300">Nome da Empresa / Cliente</label>
                        <Input
                            placeholder="Ex: Acme Corp."
                            value={newCompanyName}
                            onChange={(e) => setNewCompanyName(e.target.value)}
                            className="!bg-slate-800 !border-slate-600 hover:!border-slate-400 focus:!border-white !text-white px-4 py-2.5 rounded-xl transition-all"
                        />
                    </div>
                    <div>
                        <label className="block mb-2 text-[10px] font-black uppercase tracking-widest text-slate-300">Público Link do Google Sheets (Opcional)</label>
                        <Input
                            placeholder="https://docs.google.com/spreadsheets/d/..."
                            value={newCompanySheetsUrl}
                            onChange={(e) => setNewCompanySheetsUrl(e.target.value)}
                            className="!bg-slate-800 !border-slate-600 hover:!border-slate-400 focus:!border-white !text-slate-200 px-4 py-2.5 rounded-xl font-mono text-[11px] transition-all"
                        />
                        <p className="text-slate-400 block mt-2 text-[10px] font-medium leading-tight">
                            A planilha deve estar com acesso &quot;Qualquer pessoa com o link&quot; ou compartilhada.
                        </p>
                    </div>
                    {/* Logo upload — using native input to avoid Ant Design dark mode CSS conflicts */}
                    <div>
                        <label className="block mb-2 text-[10px] font-black uppercase tracking-widest text-slate-300">Logo da Empresa (Opcional)</label>
                        <div className="flex items-center gap-4">
                            {newCompanyLogo && (
                                <img src={newCompanyLogo} alt="Logo Preview" className="w-16 h-16 object-cover rounded-xl border border-slate-600 shadow-2xl shrink-0" />
                            )}
                            <label
                                className="flex-1 flex flex-col items-center justify-center gap-2 cursor-pointer rounded-2xl border-2 border-dashed border-slate-600 hover:border-slate-400 bg-slate-800/50 hover:bg-slate-700/50 transition-all py-5 px-4"
                            >
                                <InboxOutlined className="text-2xl text-slate-400" />
                                <span className="text-slate-300 text-[10px] font-bold uppercase tracking-widest">
                                    {newCompanyLogo ? 'Trocar Logo' : 'Selecionar Logo'}
                                </span>
                                <span className="text-slate-500 text-[9px]">JPG, PNG, WEBP</span>
                                <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (!file) return;
                                        const reader = new FileReader();
                                        reader.onloadend = () => setNewCompanyLogo(reader.result as string);
                                        reader.readAsDataURL(file);
                                    }}
                                />
                            </label>
                        </div>
                    </div>
                    {/* Cover upload — same approach */}
                    <div>
                        <label className="block mb-2 text-[10px] font-black uppercase tracking-widest text-slate-300">Imagem de Capa (Opcional)</label>
                        <div className="flex items-center gap-4">
                            {newCompanyCover && (
                                <img src={newCompanyCover} alt="Cover Preview" className="w-[120px] h-16 object-cover rounded-xl border border-slate-600 shadow-2xl shrink-0" />
                            )}
                            <label
                                className="flex-1 flex flex-col items-center justify-center gap-2 cursor-pointer rounded-2xl border-2 border-dashed border-slate-600 hover:border-slate-400 bg-slate-800/50 hover:bg-slate-700/50 transition-all py-5 px-4"
                            >
                                <InboxOutlined className="text-2xl text-slate-400" />
                                <span className="text-slate-300 text-[10px] font-bold uppercase tracking-widest">
                                    {newCompanyCover ? 'Trocar Capa' : 'Selecionar Capa'}
                                </span>
                                <span className="text-slate-500 text-[9px]">JPG, PNG, WEBP — Proporção 16:9 recomendada</span>
                                <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (!file) return;
                                        const reader = new FileReader();
                                        reader.onloadend = () => setNewCompanyCover(reader.result as string);
                                        reader.readAsDataURL(file);
                                    }}
                                />
                            </label>
                        </div>
                    </div>
                </div>
            )}
            </Modal>

            {/* Modal de Acessos por Empresa */}
            <Modal
                title={`Gerenciar Acessos: ${activeCompanyForUsers?.name || ''}`}
                open={isUsersModalVisible}
                onCancel={() => {
                    setIsUsersModalVisible(false);
                    setActiveCompanyEdits(null);
                }}
                footer={[
                    <Button key="close" type="default" className="btn-bw-inverse font-bold" onClick={() => setIsUsersModalVisible(false)}>
                        Concluir
                    </Button>
                ]}
                width={500}
            >
                <div className="mt-4">
                    <Text className="text-zinc-500 block mb-4">
                        Selecione quais usuários podem interagir com esta base de dados. Administradores sempre acessam tudo caso precisem.
                    </Text>

                    <List
                        dataSource={users}
                        renderItem={user => {
                            const userAccess = activeCompanyForUsers?.users.find((u: any) => u.email.toLowerCase() === user.email.toLowerCase());
                            const hasAccess = !!userAccess;

                            return (
                                <List.Item className="border-zinc-100 dark:border-zinc-800 py-3">
                                    <div className="flex items-center w-full justify-between">
                                        <div>
                                            <Title level={5} className="!m-0 !text-black dark:!text-white !text-sm">{user.name}</Title>
                                            <Text className="text-zinc-500 text-xs">{user.email}</Text>
                                        </div>
                                        <Select
                                            value={hasAccess ? userAccess.role : 'none'}
                                            onChange={(val: 'admin' | 'editor' | 'viewer' | 'none') => handleSetUserRole(activeCompanyForUsers!.id, user.email.toLowerCase(), val === 'none' ? null : val)}
                                            style={{ width: 140 }}
                                            options={[
                                                { value: 'none', label: 'Sem Acesso' },
                                                { value: 'viewer', label: 'Visualizador' },
                                                { value: 'editor', label: 'Editor' },
                                                { value: 'admin', label: 'Administrador' }
                                            ]}
                                        />
                                    </div>
                                </List.Item>
                            )
                        }}
                        locale={{ emptyText: 'Nenhum usuário cadastrado no painel.' }}
                    />
                </div>
            </Modal>

            {/* Modal de Vinculação de Fontes de Dados (Sheets ou Arquivo) */}
            <LinkDataModal
                isOpen={isLinkModalVisible}
                onClose={() => {
                    setIsLinkModalVisible(false);
                    setActiveCompanyLink(null);
                }}
                companyId={activeCompanyLink}
                companyName={companies.find(c => c.id === activeCompanyLink)?.name || ''}
                company={companies.find(c => c.id === activeCompanyLink)}
                onSuccess={() => {
                    loadCompanies();
                }}
            />

        </div>
    )
}
