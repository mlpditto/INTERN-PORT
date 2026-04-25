#!/bin/bash
# macOS Dev Environment Setup Script
# Run: bash setup_mac_dev.sh

set -e

echo "--- ติดตั้ง Xcode Command Line Tools ---"
xcode-select --install || true

echo "--- ติดตั้ง Homebrew ---"
if ! command -v brew &>/dev/null; then
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
else
    echo "Homebrew ติดตั้งแล้ว"
fi

echo "--- ติดตั้ง Git ---"
brew install git

echo "--- ติดตั้ง nvm และ Node.js LTS ---"
if [ ! -d "$HOME/.nvm" ]; then
    brew install nvm
    mkdir -p ~/.nvm
    echo 'export NVM_DIR="$HOME/.nvm"' >> ~/.zshrc
    echo '[ -s "/opt/homebrew/opt/nvm/nvm.sh" ] && . "/opt/homebrew/opt/nvm/nvm.sh"' >> ~/.zshrc
    export NVM_DIR="$HOME/.nvm"
    . "/opt/homebrew/opt/nvm/nvm.sh"
fi
source ~/.zshrc || true
nvm install --lts


echo "--- ติดตั้ง Python 3 ---"
brew install python

echo "--- ติดตั้ง VS Code ---"
brew install --cask visual-studio-code

echo "--- ติดตั้ง Oh My Zsh ---"
if [ ! -d "$HOME/.oh-my-zsh" ]; then
    sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)" || true
fi

echo "--- ติดตั้ง Powerlevel10k ---"
brew install romkatv/powerlevel10k/powerlevel10k
if ! grep -q 'powerlevel10k' ~/.zshrc; then
    echo 'source $(brew --prefix)/opt/powerlevel10k/powerlevel10k.zsh-theme' >> ~/.zshrc
fi

echo "--- ติดตั้ง Firebase CLI ---"
brew install firebase-cli

echo "--- ติดตั้ง Google Cloud SDK ---"
brew install --cask google-cloud-sdk

echo "--- เสร็จสิ้น! กรุณา restart Terminal หรือรัน 'source ~/.zshrc' ---"
