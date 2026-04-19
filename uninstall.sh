#!/usr/bin/env bash
set -e

INSTALL_DIR="${ARCHON_UI_INSTALL_DIR:-$HOME/.archon/tools/archon-task-ui}"
BIN_DIR="$HOME/.archon/bin"
BIN_FILE="$BIN_DIR/archon-ui"
FISH_CONF="$HOME/.config/fish/conf.d/archon-ui.fish"

echo "Uninstalling Archon Task UI..."

# Remove install dir
if [ -d "$INSTALL_DIR" ]; then
  rm -rf "$INSTALL_DIR"
  echo "  Removed $INSTALL_DIR"
else
  echo "  Install dir not found: $INSTALL_DIR"
fi

# Remove bin file
if [ -f "$BIN_FILE" ]; then
  rm -f "$BIN_FILE"
  echo "  Removed $BIN_FILE"
fi

# Remove fish config
if [ -f "$FISH_CONF" ]; then
  rm -f "$FISH_CONF"
  echo "  Removed $FISH_CONF"
fi

# Remove PATH line from POSIX shell configs
remove_from_rc() {
  local rc="$1"
  if [ -f "$rc" ] && grep -qF '.archon/bin' "$rc"; then
    # Remove the comment and export line
    sed -i '/# archon-task-ui/d; /\.archon\/bin/d' "$rc"
    echo "  Cleaned $rc"
  fi
}

echo "Cleaning shell configs..."
remove_from_rc "$HOME/.bashrc"
remove_from_rc "$HOME/.zshrc"
remove_from_rc "$HOME/.bash_profile"
remove_from_rc "$HOME/.zprofile"
remove_from_rc "$HOME/.profile"

# Remove bin dir if empty
if [ -d "$BIN_DIR" ] && [ -z "$(ls -A "$BIN_DIR")" ]; then
  rmdir "$BIN_DIR"
  echo "  Removed empty $BIN_DIR"
fi

echo ""
echo "Done! Archon Task UI uninstalled."
echo "Restart your terminal to apply PATH changes."
