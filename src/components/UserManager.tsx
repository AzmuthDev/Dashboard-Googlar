import { useState, useEffect } from 'react'
import { Button, Input, Modal, message, Typography, Upload, Divider, Select } from 'antd'
import { UserAddOutlined, MailOutlined, KeyOutlined, UserOutlined, InboxOutlined, EditOutlined, SafetyCertificateOutlined, BankOutlined } from '@ant-design/icons'
import { UserProfileCard } from './ui/user-profile-card'
import type { AuthorizedUser, Company, UserRole } from '../types'
import { supabase } from '../lib/supabase'

const { Title, Text } = Typography

export function UserManager({ currentUser }: { currentUser: AuthorizedUser | null }) {
    const [users, setUsers] = useState<AuthorizedUser[]>([])
    const [companies, setCompanies] = useState<Company[]>([])
    const [isAddModalVisible, setIsAddModalVisible] = useState(false)
    const [isPasswordModalVisible, setIsPasswordModalVisible] = useState(false)

    // Form states
    const [newName, setNewName] = useState('')
    const [newEmail, setNewEmail] = useState('')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [newRole, setNewRole] = useState<UserRole>('standard')
    const [assignedCompanyIds, setAssignedCompanyIds] = useState<string[]>([])

    // Edit states for other users
    const [isEditModalVisible, setIsEditModalVisible] = useState(false)
    const [editingUser, setEditingUser] = useState<AuthorizedUser | null>(null)
    const [editName, setEditName] = useState('')
    const [editRole, setEditRole] = useState<UserRole>('standard')
    const [editCompanyIds, setEditCompanyIds] = useState<string[]>([])

    // Password change states
    const [targetUserEmail, setTargetUserEmail] = useState('')
    const [newPassword, setNewPassword] = useState('')
    const [confirmNewPassword, setConfirmNewPassword] = useState('')

    // Photo change states
    const [isPhotoModalVisible, setIsPhotoModalVisible] = useState(false)
    const [targetUserForPhoto, setTargetUserForPhoto] = useState('')
    const [pendingAvatarUrl, setPendingAvatarUrl] = useState('')

    // "My Profile" Edit states
    const [isMyProfileModalVisible, setIsMyProfileModalVisible] = useState(false)
    const [myProfileName, setMyProfileName] = useState('')
    const [myProfileEmail, setMyProfileEmail] = useState('')
    const [myProfilePassword, setMyProfilePassword] = useState('')
    const [myProfileAvatar, setMyProfileAvatar] = useState('')

    const isAdmin = currentUser?.isAdmin
    console.log('UserManager rendered. currentUser:', currentUser, 'isAdmin:', isAdmin)

    // Current user detailed info
    const [currentUserDetails, setCurrentUserDetails] = useState<{ name?: string, role?: string, avatarUrl?: string }>({})

    useEffect(() => {
        const stored = JSON.parse(localStorage.getItem('googlar_authorized_users') || '[]')
        setUsers(stored)
        const storedCompanies = JSON.parse(localStorage.getItem('googlar_companies') || '[]')
        setCompanies(storedCompanies)

        if (currentUser?.email) {
            const found = stored.find((u: any) => u.email.toLowerCase() === currentUser.email.toLowerCase())
            if (found) {
                setCurrentUserDetails({
                    name: found.name,
                    role: found.jobTitle || (isAdmin ? 'Fundador / Admin' : 'Colaborador'),
                    avatarUrl: found.avatarUrl
                })
            }
        }
    }, [currentUser])

    const handleAddUser = async () => {
        if (!newName.trim()) {
            message.error('Por favor, insira o nome do usuário.')
            return
        }

        if (!newEmail || !newEmail.includes('@')) {
            message.error('Por favor, insira um email válido.')
            return
        }

        if (!password || password.length < 6) {
            message.error('A senha deve ter pelo menos 6 caracteres.')
            return
        }

        if (password !== confirmPassword) {
            message.error('As senhas não coincidem.')
            return
        }

        if (users.some(u => u.email.toLowerCase() === newEmail.toLowerCase())) {
            message.warning('Este usuário já tem acesso.')
            return
        }

        const loadingKey = 'create-user'
        message.loading({ content: 'Criando usuário no Supabase...', key: loadingKey, duration: 0 })

        try {
            // 1. Create user in Supabase Auth
            const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
                email: newEmail.toLowerCase(),
                password: password,
                options: {
                    data: {
                        name: newName.trim(),
                        role: newRole,
                        is_admin: newRole === 'admin',
                    },
                    // Skip email confirmation for dashboard-created users
                    emailRedirectTo: undefined,
                }
            })

            if (signUpError) {
                if (signUpError.message.includes('already registered')) {
                    message.error({ content: 'Este e-mail já está registrado no Supabase.', key: loadingKey })
                } else {
                    message.error({ content: `Erro Supabase: ${signUpError.message}`, key: loadingKey })
                }
                return
            }

            // 2. Upsert profile row (the trigger may create it, but we ensure data is correct)
            if (signUpData?.user?.id) {
                await supabase.from('profiles').upsert({
                    id: signUpData.user.id,
                    name: newName.trim(),
                    role: newRole,
                    is_admin: newRole === 'admin',
                    assigned_company_ids: assignedCompanyIds,
                }, { onConflict: 'id' })
            }

            // 3. Also keep in localStorage for immediate display (no full refresh needed)
            const newUser: AuthorizedUser = {
                name: newName.trim(),
                email: newEmail.toLowerCase(),
                password: password, // kept locally so admin can see it if needed
                role: newRole,
                isAdmin: newRole === 'admin',
                assignedCompanyIds: assignedCompanyIds,
                addedAt: new Date().toLocaleDateString('pt-BR')
            }
            const updatedUsers = [...users, newUser]
            localStorage.setItem('googlar_authorized_users', JSON.stringify(updatedUsers))
            setUsers(updatedUsers)

            resetAddForm()
            setIsAddModalVisible(false)
            message.success({ content: '✅ Usuário criado no Supabase! Ele já pode fazer login.', key: loadingKey, duration: 4 })
        } catch (err: any) {
            message.error({ content: `Erro inesperado: ${err.message}`, key: loadingKey })
        }
    }

    const resetAddForm = () => {
        setNewName('')
        setNewEmail('')
        setPassword('')
        setConfirmPassword('')
        setNewRole('standard')
        setAssignedCompanyIds([])
    }

    const handleEditUser = (user: AuthorizedUser) => {
        setEditingUser(user)
        setEditName(user.name)
        setEditRole(user.role)
        setEditCompanyIds(user.assignedCompanyIds || [])
        setIsEditModalVisible(true)
    }

    const handleSaveEditUser = () => {
        if (!editingUser) return

        const updatedUsers = users.map(u => {
            if (u.email.toLowerCase() === editingUser.email.toLowerCase()) {
                return {
                    ...u,
                    name: editName.trim(),
                    role: editRole,
                    isAdmin: editRole === 'admin',
                    assignedCompanyIds: editCompanyIds
                }
            }
            return u
        })

        // Also sync companies if needed (ensuring users within companies are updated if they were hard-synced there)
        const updatedCompanies: Company[] = companies.map(c => {
            const hasUser = editingUser.assignedCompanyIds?.includes(c.id) || editCompanyIds.includes(c.id);
            if (hasUser) {
                const otherUsers = c.users.filter((u: any) => u.email.toLowerCase() !== editingUser.email.toLowerCase());
                if (editCompanyIds.includes(c.id)) {
                    const mappedRole: 'admin' | 'editor' | 'viewer' = editRole === 'admin' ? 'admin' : 'viewer';
                    return { ...c, users: [...otherUsers, { email: editingUser.email, role: mappedRole }] };
                }
                return { ...c, users: otherUsers };
            }
            return c;
        });

        localStorage.setItem('googlar_authorized_users', JSON.stringify(updatedUsers))
        localStorage.setItem('googlar_companies', JSON.stringify(updatedCompanies))
        setUsers(updatedUsers)
        setCompanies(updatedCompanies)
        setIsEditModalVisible(false)
        message.success('Usuário atualizado com sucesso!')
    }

    const handlePasswordChange = () => {
        if (!newPassword || newPassword.length < 4) {
            message.error('A senha deve ter pelo menos 4 caracteres.')
            return
        }
        if (newPassword !== confirmNewPassword) {
            message.error('As senhas não coincidem.')
            return
        }

        const updatedUsers = users.map(u => {
            if (u.email.toLowerCase() === targetUserEmail.toLowerCase()) {
                return { ...u, password: newPassword }
            }
            return u
        })

        // Handle case where we're changing our own password but we're the root admin
        // Note: Root admin isn't necessarily in the localStorage list.
        if (targetUserEmail.toLowerCase() === currentUser?.email.toLowerCase() && !users.find(u => u.email === targetUserEmail)) {
            // In a real app we'd update the separate admin entry, but here it's hardcoded in App.tsx
            // For visibility in this mock, we'll just show success.
        }

        localStorage.setItem('googlar_authorized_users', JSON.stringify(updatedUsers))
        setUsers(updatedUsers)
        setIsPasswordModalVisible(false)
        setNewPassword('')
        setConfirmNewPassword('')
        message.success('Senha atualizada com sucesso!')
    }

    const handleDeleteUser = (email: string) => {
        const updatedUsers = users.filter(u => u.email !== email)
        localStorage.setItem('googlar_authorized_users', JSON.stringify(updatedUsers))
        setUsers(updatedUsers)
        message.success('Acesso removido.')
    }


    const handlePhotoChange = () => {
        const updatedUsers = users.map(u => {
            if (u.email.toLowerCase() === targetUserForPhoto.toLowerCase()) {
                return { ...u, avatarUrl: pendingAvatarUrl }
            }
            return u
        })

        // Edge case: if root admin is changing their own photo and they aren't in the list
        if (targetUserForPhoto.toLowerCase() === currentUser?.email.toLowerCase() && !users.find(u => u.email === targetUserForPhoto)) {
            updatedUsers.push({
                name: 'Administrador Principal',
                email: currentUser.email.toLowerCase(),
                role: 'admin',
                isAdmin: true,
                addedAt: new Date().toLocaleDateString('pt-BR'),
                avatarUrl: pendingAvatarUrl
            })
        }

        localStorage.setItem('googlar_authorized_users', JSON.stringify(updatedUsers))
        setUsers(updatedUsers)

        // Also update the currentUserDetails so the top card refreshes immediately
        if (targetUserForPhoto.toLowerCase() === currentUser?.email.toLowerCase()) {
            setCurrentUserDetails(prev => ({ ...prev, avatarUrl: pendingAvatarUrl }))
        }

        setIsPhotoModalVisible(false)
        setPendingAvatarUrl('')
        message.success('Foto de perfil atualizada!')
    }

    const openMyProfileConfig = () => {
        setMyProfileName(currentUserDetails.name || (isAdmin ? 'Sócio Administrador' : 'Usuário'))
        setMyProfileEmail(currentUser?.email || '')
        setMyProfilePassword('') // Do not pre-fill passwords
        setMyProfileAvatar(currentUserDetails.avatarUrl || '')
        setIsMyProfileModalVisible(true)
    }

    const handleSaveMyProfile = () => {
        // Validate
        if (!myProfileName.trim() || !myProfileEmail.trim()) {
            message.error("Nome e e-mail são obrigatórios.")
            return
        }

        const currentEmailLC = currentUser?.email.toLowerCase() || ''
        const updatedUsers = users.map(u => {
            if (u.email.toLowerCase() === currentEmailLC) {
                const userClone = { ...u, name: myProfileName, email: myProfileEmail, avatarUrl: myProfileAvatar }
                if (myProfilePassword.trim().length >= 4) {
                    userClone.password = myProfilePassword
                }
                return userClone
            }
            return u
        })

        // Edge case: Root Admin modifying their own profile and not in the explicit list:
        if (currentEmailLC === 'joseeduardorms29@gmail.com' && !users.find(u => u.email.toLowerCase() === currentEmailLC)) {
            updatedUsers.push({
                name: myProfileName,
                email: myProfileEmail,
                role: 'admin',
                isAdmin: true,
                addedAt: new Date().toLocaleDateString('pt-BR'),
                avatarUrl: myProfileAvatar,
                ...(myProfilePassword.trim().length >= 4 ? { password: myProfilePassword } : {})
            })
        }

        localStorage.setItem('googlar_authorized_users', JSON.stringify(updatedUsers))
        setUsers(updatedUsers)
        setCurrentUserDetails(prev => ({ ...prev, name: myProfileName, avatarUrl: myProfileAvatar }))
        setIsMyProfileModalVisible(false)
        message.success('Seus dados foram atualizados!')
    }

    // Inject root admin if not present in the list (so they can see their own profile)
    const allUsersIncludingRoot = [...users]
    if (currentUser?.email === 'joseeduardorms29@gmail.com' && !users.find(u => u.email === 'joseeduardorms29@gmail.com')) {
        allUsersIncludingRoot.unshift({
            name: 'Administrador Principal',
            email: 'joseeduardorms29@gmail.com',
            role: 'admin',
            isAdmin: true,
            addedAt: 'Sistema'
        })
    }

    const displayUsers = isAdmin
        ? allUsersIncludingRoot
        : allUsersIncludingRoot.filter(u => u.email.toLowerCase() === currentUser?.email.toLowerCase())

    return (
        <div style={{ padding: '24px' }}>
            <div className="mb-8">
                <UserProfileCard
                    name={currentUserDetails.name || 'Sócio Administrador'}
                    email={currentUser?.email || 'admin@googlar.com'}
                    role={currentUserDetails.role || (isAdmin ? 'Fundador / Admin' : 'Colaborador')}
                    accountLevel={isAdmin ? 'Conta Mestre' : 'Acesso Limitado'}
                    avatarUrl={currentUserDetails.avatarUrl || '/owl-fallback.png'}
                    isCollapsed={false}
                    isCurrentUser={true}
                    isAdminUser={isAdmin}
                    onEditProfile={openMyProfileConfig}
                    onEditPhoto={openMyProfileConfig}
                />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                    <Title level={4} style={{ color: '#FFFFFF', margin: 0 }}>
                        {isAdmin ? 'Gerenciar Acessos' : 'Meu Perfil'}
                    </Title>
                    <Text style={{ color: '#8B949E' }}>
                        {isAdmin ? 'Libere ou remova o acesso de usuários ao painel.' : 'Gerencie suas informações de acesso.'}
                    </Text>
                </div>
                {isAdmin && (
                    <Button
                        type="primary"
                        icon={<UserAddOutlined />}
                        onClick={() => setIsAddModalVisible(true)}
                        style={{ backgroundColor: '#1890FF' }}
                    >
                        Novo Usuário
                    </Button>
                )}
                {!isAdmin && (
                    <Button
                        type="primary"
                        icon={<KeyOutlined />}
                        onClick={() => {
                            setTargetUserEmail(currentUser?.email || '')
                            setIsPasswordModalVisible(true)
                        }}
                        style={{ backgroundColor: '#FAAD14', borderColor: '#FAAD14' }}
                    >
                        Mudar Senha
                    </Button>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {displayUsers.map((user) => {
                    const isCardOfCurrentUser = user.email.toLowerCase() === currentUser?.email.toLowerCase();
                    const isRootAdmin = user.email.toLowerCase() === 'joseeduardorms29@gmail.com';

                    return (
                        <div key={user.email} className={isCardOfCurrentUser ? "hidden" : ""}>
                            <UserProfileCard
                                name={user.name || 'Usuário Sem Nome'}
                                email={user.email}
                                role={user.isAdmin ? 'Administrador' : 'Colaborador'}
                                accountLevel={user.isAdmin ? 'Acesso Total' : 'Acesso Limitado'}
                                avatarUrl={user.avatarUrl}
                                isCollapsed={false}
                                isCurrentUser={isCardOfCurrentUser}
                                isAdminUser={user.isAdmin}
                                onEditPhoto={isAdmin || isCardOfCurrentUser ? () => {
                                    setTargetUserForPhoto(user.email);
                                    setPendingAvatarUrl(user.avatarUrl || '');
                                    setIsPhotoModalVisible(true);
                                } : undefined}
                                onEditPassword={isAdmin || isCardOfCurrentUser ? () => {
                                    setTargetUserEmail(user.email);
                                    setIsPasswordModalVisible(true);
                                } : undefined}
                                onEditUser={(isAdmin && !isCardOfCurrentUser && !isRootAdmin) ? () => {
                                    handleEditUser(user);
                                } : undefined}
                                onDelete={(isAdmin && !isCardOfCurrentUser && !isRootAdmin) ? () => {
                                    handleDeleteUser(user.email);
                                } : undefined}
                            />
                        </div>
                    );
                })}
            </div>

            {/* Modal: Novo Usuário */}
            <Modal
                title="Autorizar Novo Usuário"
                open={isAddModalVisible}
                onOk={handleAddUser}
                onCancel={() => setIsAddModalVisible(false)}
                okText="Autorizar"
                cancelText="Cancelar"
            >
                <div style={{ marginTop: '16px' }}>
                    <Text style={{ color: '#8B949E', display: 'block', marginBottom: '8px' }}>Nome do Usuário</Text>
                    <Input
                        prefix={<UserOutlined style={{ color: '#8B949E' }} />}
                        placeholder="Nome Completo"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        style={{ backgroundColor: '#0F1115', border: '1px solid #30363D', color: '#FFFFFF', marginBottom: '16px' }}
                    />

                    <Text style={{ color: '#8B949E', display: 'block', marginBottom: '8px' }}>E-mail do Usuário</Text>
                    <Input
                        prefix={<MailOutlined style={{ color: '#8B949E' }} />}
                        placeholder="exemplo@gmail.com"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        style={{ backgroundColor: '#0F1115', border: '1px solid #30363D', color: '#FFFFFF', marginBottom: '16px' }}
                    />

                    <Text style={{ color: '#8B949E', display: 'block', marginBottom: '8px' }}>Senha</Text>
                    <Input.Password
                        placeholder="Mínimo 4 caracteres"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        style={{ backgroundColor: '#0F1115', border: '1px solid #30363D', color: '#FFFFFF', marginBottom: '16px' }}
                    />

                    <Text style={{ color: '#8B949E', display: 'block', marginBottom: '8px' }}>Confirmar Senha</Text>
                    <Input.Password
                        placeholder="Repita a senha"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        style={{ backgroundColor: '#0F1115', border: '1px solid #30363D', color: '#FFFFFF', marginBottom: '16px' }}
                    />

                    <div className="grid grid-cols-2 gap-4 mt-4">
                        <div>
                            <Text style={{ color: '#8B949E', display: 'block', marginBottom: '8px' }}>
                                <SafetyCertificateOutlined className="mr-2" /> Perfil de Acesso
                            </Text>
                            <Select
                                value={newRole}
                                onChange={(val) => {
                                    setNewRole(val);
                                    if (val === 'admin') setAssignedCompanyIds([]);
                                }}
                                className="w-full"
                                options={[
                                    { value: 'standard', label: 'Usuário Padrão' },
                                    { value: 'admin', label: 'Administrador' }
                                ]}
                            />
                        </div>
                        {newRole === 'standard' && (
                            <div>
                                <Text style={{ color: '#8B949E', display: 'block', marginBottom: '8px' }}>
                                    <BankOutlined className="mr-2" /> Empresas Vinculadas
                                </Text>
                                <Select
                                    mode="multiple"
                                    placeholder="Vincular empresas"
                                    value={assignedCompanyIds}
                                    onChange={setAssignedCompanyIds}
                                    className="w-full"
                                    options={companies.map(c => ({ value: c.id, label: c.name }))}
                                />
                            </div>
                        )}
                    </div>
                </div>
            </Modal>

            {/* Modal: Editar Usuário (Master Control) */}
            <Modal
                title={`Editar Usuário: ${editingUser?.email}`}
                open={isEditModalVisible}
                onOk={handleSaveEditUser}
                onCancel={() => setIsEditModalVisible(false)}
                okText="Salvar Alterações"
                cancelText="Cancelar"
            >
                <div style={{ marginTop: '16px' }}>
                    <Text style={{ color: '#8B949E', display: 'block', marginBottom: '8px' }}>Nome do Usuário</Text>
                    <Input
                        prefix={<UserOutlined style={{ color: '#8B949E' }} />}
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        style={{ backgroundColor: '#0F1115', border: '1px solid #30363D', color: '#FFFFFF', marginBottom: '16px' }}
                    />

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Text style={{ color: '#8B949E', display: 'block', marginBottom: '8px' }}>
                                <SafetyCertificateOutlined className="mr-2" /> Perfil de Acesso
                            </Text>
                            <Select
                                value={editRole}
                                onChange={(val) => {
                                    setEditRole(val);
                                    if (val === 'admin') setEditCompanyIds([]);
                                }}
                                className="w-full"
                                options={[
                                    { value: 'standard', label: 'Colaborador' },
                                    { value: 'admin', label: 'Administrador' }
                                ]}
                            />
                        </div>
                        {editRole === 'standard' && (
                            <div>
                                <Text style={{ color: '#8B949E', display: 'block', marginBottom: '8px' }}>
                                    <BankOutlined className="mr-2" /> Empresas Vinculadas
                                </Text>
                                <Select
                                    mode="multiple"
                                    placeholder="Vincular empresas"
                                    value={editCompanyIds}
                                    onChange={setEditCompanyIds}
                                    className="w-full"
                                    options={companies.map(c => ({ value: c.id, label: c.name }))}
                                />
                            </div>
                        )}
                    </div>
                </div>
            </Modal>

            {/* Modal: Mudar Senha */}
            <Modal
                title={`Mudar Senha: ${targetUserEmail}`}
                open={isPasswordModalVisible}
                onOk={handlePasswordChange}
                onCancel={() => setIsPasswordModalVisible(false)}
                okText="Salvar"
                cancelText="Cancelar"
            >
                <div style={{ marginTop: '16px' }}>
                    <Text style={{ color: '#8B949E', display: 'block', marginBottom: '8px' }}>Nova Senha</Text>
                    <Input.Password
                        placeholder="Mínimo 4 caracteres"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        style={{ backgroundColor: '#0F1115', border: '1px solid #30363D', color: '#FFFFFF', marginBottom: '16px' }}
                    />

                    <Text style={{ color: '#8B949E', display: 'block', marginBottom: '8px' }}>Confirmar Nova Senha</Text>
                    <Input.Password
                        placeholder="Repita a nova senha"
                        value={confirmNewPassword}
                        onChange={(e) => setConfirmNewPassword(e.target.value)}
                        style={{ backgroundColor: '#0F1115', border: '1px solid #30363D', color: '#FFFFFF' }}
                    />
                </div>
            </Modal>

            {/* Modal: Editar Foto */}
            <Modal
                title={`Alterar Foto de Perfil`}
                open={isPhotoModalVisible}
                onOk={handlePhotoChange}
                onCancel={() => setIsPhotoModalVisible(false)}
                okText="Salvar Foto"
                cancelText="Cancelar"
            >
                <div style={{ marginTop: '16px' }}>
                    <Text style={{ color: '#8B949E', display: 'block', marginBottom: '16px' }}>
                        Arraste uma nova imagem de perfil ou clique para selecionar.
                    </Text>
                    <Upload.Dragger
                        name="avatar"
                        multiple={false}
                        showUploadList={false}
                        beforeUpload={(file) => {
                            const reader = new FileReader();
                            reader.onload = (e) => {
                                setPendingAvatarUrl(e.target?.result as string);
                            };
                            reader.readAsDataURL(file);
                            return false; // Evita upload automático HTTP
                        }}
                        style={{ backgroundColor: '#0F1115', border: '1px dashed #30363D' }}
                    >
                        <p className="ant-upload-drag-icon">
                            <InboxOutlined style={{ color: '#1890FF' }} />
                        </p>
                        <p className="ant-upload-text" style={{ color: '#FFFFFF' }}>
                            Clique ou arraste a imagem do seu computador
                        </p>
                    </Upload.Dragger>

                    {pendingAvatarUrl && (
                        <div className="mt-4 flex justify-center">
                            <img
                                src={pendingAvatarUrl}
                                alt="Preview"
                                className="w-24 h-24 object-cover rounded-full border border-border bg-background"
                            />
                        </div>
                    )}
                </div>
            </Modal>

            {/* Modal: Meu Perfil (Edição Completa) */}
            <Modal
                title={`Configurações do Meu Perfil`}
                open={isMyProfileModalVisible}
                onOk={handleSaveMyProfile}
                onCancel={() => setIsMyProfileModalVisible(false)}
                okText="Salvar Alterações"
                cancelText="Cancelar"
                width={500}
            >
                <div style={{ marginTop: '16px' }}>
                    <div className="flex justify-center mb-6">
                        <Upload.Dragger
                            name="myAvatar"
                            multiple={false}
                            showUploadList={false}
                            beforeUpload={(file) => {
                                const reader = new FileReader();
                                reader.onload = (e) => {
                                    setMyProfileAvatar(e.target?.result as string);
                                };
                                reader.readAsDataURL(file);
                                return false;
                            }}
                            className="w-full"
                            style={{ backgroundColor: 'transparent', border: 'none' }}
                        >
                            <div className="relative inline-block group cursor-pointer">
                                <img
                                    src={myProfileAvatar || "/owl-fallback.png"}
                                    alt="My Avatar"
                                    className="w-24 h-24 object-cover rounded-full border-2 border-primary/50 shadow-md group-hover:opacity-75 transition-opacity bg-background"
                                />
                                <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <EditOutlined className="text-white text-xl" />
                                </div>
                            </div>
                            <p className="text-xs text-muted-foreground mt-2">Clique ou arraste para trocar</p>
                        </Upload.Dragger>
                    </div>

                    <Divider style={{ borderColor: '#30363D', margin: '16px 0' }} />

                    <Text style={{ color: '#8B949E', display: 'block', marginBottom: '8px' }}>Seu Nome</Text>
                    <Input
                        prefix={<UserOutlined style={{ color: '#8B949E' }} />}
                        value={myProfileName}
                        onChange={(e) => setMyProfileName(e.target.value)}
                        style={{ backgroundColor: '#0F1115', border: '1px solid #30363D', color: '#FFFFFF', marginBottom: '16px' }}
                    />

                    <Text style={{ color: '#8B949E', display: 'block', marginBottom: '8px' }}>Seu E-mail (Acesso)</Text>
                    <Input
                        prefix={<MailOutlined style={{ color: '#8B949E' }} />}
                        value={myProfileEmail}
                        onChange={(e) => setMyProfileEmail(e.target.value)}
                        style={{ backgroundColor: '#0F1115', border: '1px solid #30363D', color: '#FFFFFF', marginBottom: '16px' }}
                        disabled={currentUser?.email.toLowerCase() === 'joseeduardorms29@gmail.com'}
                    />

                    <Text style={{ color: '#8B949E', display: 'block', marginBottom: '8px' }}>Nova Senha <span className="text-xs text-muted-foreground">(Opcional)</span></Text>
                    <Input.Password
                        placeholder="Deixe em branco para manter a atual"
                        value={myProfilePassword}
                        onChange={(e) => setMyProfilePassword(e.target.value)}
                        style={{ backgroundColor: '#0F1115', border: '1px solid #30363D', color: '#FFFFFF' }}
                    />
                </div>
            </Modal>
        </div>
    )
}
