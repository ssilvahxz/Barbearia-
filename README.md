# 🏆 Luigue Barbeiro — Sistema Completo de Barbearia

Website profissional e funcional para a barbearia **Luigue Barbeiro**, com sistema de agendamento online, autenticação de clientes e administrador, galeria de fotos, avaliações, integração WhatsApp e painel administrativo completo.

---

## 🚀 Como Executar

### 1. Instalar dependências
```bash
npm install
```

### 2. Iniciar o servidor
```bash
npm start
```
O servidor inicia na porta **3000** → acesse `http://localhost:3000`

### 3. Acessar o painel administrativo
- **E-mail:** `admin@barbearia.com`
- **Senha:** `Barb3ria@2024`

---

## 📋 Funcionalidades

### 👤 Cliente
- **Cadastro** com nome, e-mail, telefone e senha
- **Login** com autenticação segura (bcrypt + sessão)
- **Agendamento online** — selecione serviço, data e horário
- **Visualização de horários disponíveis** em tempo real
- **Cancelamento** de agendamentos (com 2h de antecedência)
- **Avaliação** de atendimentos concluídos (1–5 estrelas + comentário)
- **Perfil** — editar nome e telefone
- **Alterar senha**
- **WhatsApp** — botão flutuante para contato direto

### 🛡️ Administrador
- **Dashboard** com métricas: agendamentos do dia, total de clientes, receita, avaliações
- **Gerenciar agendamentos** — confirmar, concluir, cancelar, reagendar
- **Gerenciar serviços** — criar, editar, ativar/desativar, excluir
- **Gerenciar clientes** — buscar, bloquear/desbloquear, ver histórico
- **Gerenciar avaliações** — ocultar/exibir, responder, excluir
- **Galeria de fotos** — adicionar, editar ordem, destaque, excluir
- **Horários de funcionamento** — configurar por dia da semana
- **Configurações gerais** — nome, descrição, telefone, WhatsApp, Instagram, cores
- **Upload de logo**

### 🎨 Design
- **Tema escuro premium** com acentos dourados (#c8a45c)
- **Fontes:** Playfair Display (títulos) + Inter (corpo)
- **100% responsivo** — mobile-first
- **Modais elegantes** para todas as interações
- **Notificações toast** para feedback instantâneo
- **Animações suaves** e transições

---

## 🗂️ Estrutura de Arquivos

```
barbearia/
├── .env                    # Configurações (admin, session secret, porta)
├── .gitignore
├── package.json
├── server.js               # Servidor Express.js (todas as rotas API)
├── database.js             # Banco SQLite via sql.js (compatível com Node v16+)
├── middleware.js            # Autenticação, sanitização, validação
├── database/
│   └── barbearia.db        # Banco de dados SQLite (auto-criado)
├── public/
│   ├── index.html          # SPA completa (todas as seções e modais)
│   ├── css/
│   │   └── styles.css      # Tema escuro premium (950+ linhas)
│   ├── js/
│   │   └── app.js          # Frontend JS (navegação, API, modais)
│   └── uploads/            # Imagens de galeria e logo
```

---

## 🔧 Tecnologias

| Camada | Tecnologia |
|--------|------------|
| Backend | Express.js 4, express-session, bcrypt |
| Banco de Dados | sql.js (SQLite em memória + persistência em disco) |
| Frontend | HTML5, CSS3, JavaScript vanilla |
| Upload | Multer (5MB máx, jpg/png/webp/gif) |
| Segurança | Helmet, rate limiting, XSS sanitization, bcrypt |

---

## ⚙️ Variáveis de Ambiente (.env)

```
ADMIN_EMAIL=admin@barbearia.com
ADMIN_PASSWORD=Barb3ria@2024
SESSION_SECRET=chave_secreta_super_segura_2024_barbearia
PORT=3000
DB_PATH=./database/barbearia.db
UPLOAD_DIR=./public/uploads
MAX_FILE_SIZE=5242880
```

---

## 📱 Contatos da Barbearia

- **WhatsApp:** (99) 98122-6993 → [wa.me/5599981226993](https://wa.me/5599981226993)
- **Instagram:** [@luigue_barbeiro](https://www.instagram.com/luigue_barbeiro/)
- **Horário:** Seg–Sáb 09:00–19:30 | Domingo: Fechado

---

## 📊 Serviços Pré-configurados (21)

Coloração, Alisamento, Apara da barba, Barba, Barba com navalha, Barbear com toalha quente, Barberia vintage, Bar e barbearia, Cabelos cacheados, Condicionamento de barba, Corte com navalha, Corte com tesoura, Corte de cabelo, Corte em degradê, Corte militar, Corte militar reto, Corte personalizado, Cortes infantis, Manutenção de barba, Raspar a cabeça, Tingimento de barba

---

*Desenvolvido para Luigue Barbeiro* ✂️
