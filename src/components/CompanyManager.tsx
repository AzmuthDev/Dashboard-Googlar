import { useState, useEffect } from 'react'
import { Typography, Button, Input, Modal, message, List, Select, Upload } from 'antd'
import { PlusOutlined, InboxOutlined } from '@ant-design/icons'
import type { Company } from '../types'
import { CompanyCards } from './ui/company-list-cards'
import type { CompanyData } from './ui/company-list-cards'
import { LinkDataModal } from './ui/link-data-modal'

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

    const isAdmin = currentUser?.isAdmin

    useEffect(() => {
        let storedCompanies = JSON.parse(localStorage.getItem('googlar_companies') || '[]')

        // Migrate legacy string array users to object array
        storedCompanies = storedCompanies.map((c: any) => {
            if (c.users && c.users.length > 0 && typeof c.users[0] === 'string') {
                return { ...c, users: c.users.map((email: string) => ({ email, role: 'viewer' })) }
            }
            return c
        })

        const storedUsers = JSON.parse(localStorage.getItem('googlar_authorized_users') || '[]')
        setCompanies(storedCompanies)
        setUsers(storedUsers)
    }, [])

    const handleSaveCompany = () => {
        if (!newCompanyName.trim()) {
            message.error("Nome da empresa é obrigatório.")
            return
        }

        if (isEditingCompany && editingCompanyId) {
            // Update existing company
            const updated = companies.map(c => {
                if (c.id === editingCompanyId) {
                    return {
                        ...c,
                        name: newCompanyName.trim(),
                        sheetsUrl: newCompanySheetsUrl.trim() || undefined,
                        logoUrl: newCompanyLogo,
                        coverUrl: newCompanyCover
                    }
                }
                return c
            })
            localStorage.setItem('googlar_companies', JSON.stringify(updated))
            setCompanies(updated)
            message.success("Empresa atualizada com sucesso!")
        } else {
            // Create new company
            const newCompany: Company = {
                id: Date.now().toString(),
                name: newCompanyName.trim(),
                sheetsUrl: newCompanySheetsUrl.trim() || undefined,
                users: [],
                isActive: true,
                logoUrl: newCompanyLogo,
                coverUrl: newCompanyCover
            }

            const updated = [...companies, newCompany]
            localStorage.setItem('googlar_companies', JSON.stringify(updated))
            setCompanies(updated)
            message.success("Empresa criada com sucesso!")
        }
        
        // Reset form
        setNewCompanyName('')
        setNewCompanySheetsUrl('')
        setNewCompanyLogo(undefined)
        setNewCompanyCover(undefined)
        setIsEditingCompany(false)
        setEditingCompanyId(null)
        setIsAddModalVisible(false)
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
            content: 'Você realmente deseja remover esta empresa? Isso não apagará as planilhas do Google, mas desconectará o painel.',
            okText: 'Sim, excluir',
            okType: 'danger',
            cancelText: 'Cancelar',
            onOk: () => {
                const updated = companies.filter(c => c.id !== id)
                localStorage.setItem('googlar_companies', JSON.stringify(updated))
                setCompanies(updated)
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
            c.users.some((u: any) => u.email.toLowerCase() === currentUser?.email?.toLowerCase())
          )

    const mappedCompanies: CompanyData[] = displayCompanies.map(c => {
        const companyUsers = users.filter(u => c.users.some((cu: any) => cu.email.toLowerCase() === u.email.toLowerCase()));
        return {
            id: c.id,
            name: c.name,
            spreadsheetStatus: c.dataSourceType === 'local' ? "Arquivo Vinculado" : (c.sheetsUrl ? "Sheet Vinculado" : "Não vinculada"),
            users: companyUsers.map(u => ({ name: u.name, email: u.email })),
            usersCount: c.users.length,
            isActive: c.isActive !== false,
            logoUrl: c.logoUrl,
            coverUrl: c.coverUrl
        };
    })

    return (
        <div className="p-6">
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
                        className="btn-bw-inverse !border-none shadow-md font-bold"
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
                title={isEditingCompany ? "Editar Empresa" : "Criar Nova Empresa"}
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
            >
                <div className="mt-4 flex flex-col gap-6">
                    <div>
                        <Text strong className="block mb-2 text-zinc-700 dark:text-zinc-300">Nome da Empresa / Cliente</Text>
                        <Input
                            placeholder="Ex: Acme Corp."
                            value={newCompanyName}
                            onChange={(e) => setNewCompanyName(e.target.value)}
                            className="bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800"
                        />
                    </div>
                    <div>
                        <Text strong className="block mb-2 text-zinc-700 dark:text-zinc-300">Público Link do Google Sheets (Opcional)</Text>
                        <Input
                            placeholder="https://docs.google.com/spreadsheets/d/..."
                            value={newCompanySheetsUrl}
                            onChange={(e) => setNewCompanySheetsUrl(e.target.value)}
                            className="bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 font-mono text-xs"
                        />
                        <Text className="text-zinc-400 block mt-1 text-[12px]">
                            A planilha deve estar em acesso "Qualquer pessoa com o link" ou compartilhada.
                        </Text>
                    </div>
                    <div>
                        <Text className="text-zinc-700 dark:text-zinc-300 font-semibold block mb-2">Logo da Empresa (Opcional)</Text>
                        <div className="flex items-center gap-4">
                            {newCompanyLogo && (
                                <img src={newCompanyLogo} alt="Logo Preview" className="w-16 h-16 object-cover rounded-xl border border-zinc-200 dark:border-zinc-800" />
                            )}
                            <div className="flex-1">
                                <Upload.Dragger
                                    name="logo"
                                    multiple={false}
                                    showUploadList={false}
                                    className="bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800"
                                    beforeUpload={(file) => {
                                        const reader = new FileReader();
                                        reader.onloadend = () => {
                                            setNewCompanyLogo(reader.result as string);
                                        };
                                        reader.readAsDataURL(file);
                                        return false;
                                    }}
                                >
                                    <p className="ant-upload-drag-icon !m-0">
                                        <InboxOutlined className="text-zinc-400" />
                                    </p>
                                    <p className="ant-upload-text text-zinc-500 text-xs">
                                        Clique ou arraste um logo
                                    </p>
                                </Upload.Dragger>
                            </div>
                        </div>
                    </div>
                    <div>
                        <Text className="text-zinc-700 dark:text-zinc-300 font-semibold block mb-2">Imagem de Capa (Opcional)</Text>
                        <div className="flex items-center gap-4">
                            {newCompanyCover && (
                                <img src={newCompanyCover} alt="Cover Preview" className="w-[120px] h-16 object-cover rounded-xl border border-zinc-200 dark:border-zinc-800" />
                            )}
                            <div className="flex-1">
                                <Upload.Dragger
                                    name="cover"
                                    multiple={false}
                                    showUploadList={false}
                                    className="bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800"
                                    beforeUpload={(file) => {
                                        const reader = new FileReader();
                                        reader.onloadend = () => {
                                            setNewCompanyCover(reader.result as string);
                                        };
                                        reader.readAsDataURL(file);
                                        return false;
                                    }}
                                >
                                    <p className="ant-upload-drag-icon !m-0">
                                        <InboxOutlined className="text-zinc-400" />
                                    </p>
                                    <p className="ant-upload-text text-zinc-500 text-xs">
                                        Clique ou arraste uma capa
                                    </p>
                                </Upload.Dragger>
                            </div>
                        </div>
                    </div>
                </div>
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
                onSuccess={() => {
                    const stored = JSON.parse(localStorage.getItem('googlar_companies') || '[]');
                    setCompanies(stored);
                }}
            />

        </div>
    )
}
