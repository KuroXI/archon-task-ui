#!/usr/bin/env bash
set -e

INSTALL_DIR="${ARCHON_UI_INSTALL_DIR:-$HOME/.archon/tools/archon-task-ui}"
BIN_DIR="$HOME/.archon/bin"
BIN_FILE="$BIN_DIR/archon-ui"
REPO_URL="https://github.com/KuroXI/archon-task-ui"

NO_MODIFY_PATH="${ARCHON_UI_NO_MODIFY_PATH:-0}"

for arg in "$@"; do
  case "$arg" in
    --no-modify-path) NO_MODIFY_PATH=1 ;;
  esac
done

echo "Installing Archon Task UI..."

# Clone or update
if [ -d "$INSTALL_DIR/.git" ]; then
  echo "Updating existing install at $INSTALL_DIR"
  git -C "$INSTALL_DIR" pull --ff-only
else
  echo "Cloning to $INSTALL_DIR"
  git clone "$REPO_URL" "$INSTALL_DIR"
fi

# Install dependencies
echo "Installing dependencies..."
cd "$INSTALL_DIR"
bun install --frozen-lockfile

# Write bin script
mkdir -p "$BIN_DIR"
cat > "$BIN_FILE" << EOF
#!/usr/bin/env bash
exec bun run "$INSTALL_DIR/src/index.tsx" "\$@"
EOF
chmod +x "$BIN_FILE"

if [ "$NO_MODIFY_PATH" = "1" ]; then
  echo ""
  echo "Skipping shell config (--no-modify-path). Add manually:"
  echo "  export PATH=\"\$HOME/.archon/bin:\$PATH\""
  echo ""
  echo "Done! Run: archon-ui"
  exit 0
fi

PATH_LINE='export PATH="$HOME/.archon/bin:$PATH"'

# POSIX shells: bash, zsh
add_to_posix_rc() {
  local rc="$1"
  if [ -f "$rc" ] && grep -qF '.archon/bin' "$rc"; then
    return
  fi
  if [ -f "$rc" ]; then
    printf '\n# archon-task-ui\n%s\n' "$PATH_LINE" >> "$rc"
    echo "  Updated $rc"
  fi
}

echo "Updating shell configs..."
add_to_posix_rc "$HOME/.bashrc"
add_to_posix_rc "$HOME/.zshrc"
add_to_posix_rc "$HOME/.bash_profile"
add_to_posix_rc "$HOME/.zprofile"
add_to_posix_rc "$HOME/.profile"

# Fish shell
FISH_CONF_DIR="$HOME/.config/fish/conf.d"
FISH_CONF="$FISH_CONF_DIR/archon-ui.fish"
if command -v fish >/dev/null 2>&1; then
  mkdir -p "$FISH_CONF_DIR"
  if [ ! -f "$FISH_CONF" ] || ! grep -qF '.archon/bin' "$FISH_CONF"; then
    echo 'fish_add_path "$HOME/.archon/bin"' > "$FISH_CONF"
    echo "  Updated $FISH_CONF"
  fi
fi

echo ""
echo "Done! Restart your terminal, then run: archon-ui"
echo ""
echo "If 'archon-ui' is not found, run:"
echo "  export PATH=\"\$HOME/.archon/bin:\$PATH\""
echo ""
echo "To update later: run install.sh again"
