# Orientações para desenvolvimento do Xamez

## Entrega ao usuário

O usuário testa no **Linux Mint** e não tem familiaridade com programação.

- Ao concluir uma tarefa com alterações, faça commit e push para o GitHub na branch de trabalho. Informe a branch e o hash do commit na resposta final. O usuário pediu esse padrão para poder baixar e testar cada entrega.
- Inclua um passo a passo de teste no Linux Mint; prefira comandos copiáveis e explique o que deve aparecer. Mantenha `docs/12-linux-mint.md` atualizado quando mudar a instalação ou a execução.
- Não considere commit local como entrega no GitHub: confirme que o push foi aceito. Se houver impedimento real, descreva-o sem afirmar que foi enviado.
- Preserve alterações do usuário e não faça merge na main só para entregar uma tarefa. Não crie commits vazios para consultas sem alterações.

## Produto e verificação

- Interface em português, clara, com funcionalidades completas acessíveis por contexto.
- Preserve o núcleo óptico puro e os contratos em `docs/03-fisica.md`, `docs/08-referenciais.md` e `docs/09-sistema-exemplo.md`.
- Separe superfícies reais de exploração por lentes finas. Não atribua às lentes do usuário geometrias ou materiais não medidos.
- Instalar o app ou trocar sua linguagem não demonstra correção física. Use oráculos analíticos, invariantes, comparação e validação experimental.
- Execute verificações proporcionais à mudança e relate o que foi realmente verificado. Não afirme validação no Linux Mint se só houve teste em outro Linux.
