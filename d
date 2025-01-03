#!/bin/bash

# Verifica se foi fornecida uma mensagem de commit
if [ -z "$1" ]; then
    echo "Por favor, forneça uma mensagem de commit."
    echo "Uso: d \"sua mensagem de commit\""
    exit 1
fi

# Mensagem de commit
COMMIT_MESSAGE="$1"

echo "🚀 Iniciando deploy do backend..."

echo "📦 Instalando dependências..."
npm install

echo "🔨 Buildando projeto..."
npm run build

echo "📝 Commitando alterações..."
git add .
git commit -m "$COMMIT_MESSAGE"
git push

echo "✅ Deploy concluído!"
