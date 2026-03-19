#!/bin/sh

# 1tt CLI installer
# Usage:
#   curl -sSfL https://1tt.dev/cli/install.sh | sh                           # install latest
#   curl -sSfL https://1tt.dev/cli/install.sh | sh -s -- tunnel --token ...  # install + run
#   curl -sSfL https://1tt.dev/cli/install.sh | sh -s -- --version v0.1.5    # specific version

set -e

REPO="n1rna/1tt"
BINARY_NAME="1tt"
VERSION=""
RUN_ARGS=""
INSTALL_ONLY=true

# Colors (disabled if not a terminal)
if [ -t 1 ] 2>/dev/null; then
  RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BOLD='\033[1m'; NC='\033[0m'
else
  RED=''; GREEN=''; YELLOW=''; BOLD=''; NC=''
fi

log()   { printf "${GREEN}[1tt]${NC} %s\n" "$1"; }
warn()  { printf "${YELLOW}[1tt]${NC} %s\n" "$1"; }
error() { printf "${RED}[1tt]${NC} %s\n" "$1" >&2; }

# ── Detect platform ──────────────────────────────────────────────────────────

detect_platform() {
  OS="$(uname -s)"
  case "$OS" in
    Linux*)  OS="linux" ;;
    Darwin*) OS="darwin" ;;
    CYGWIN*|MINGW*|MSYS*) OS="windows" ;;
    *) error "Unsupported OS: $OS"; exit 1 ;;
  esac
  ARCH="$(uname -m)"
  case "$ARCH" in
    x86_64|amd64)  ARCH="amd64" ;;
    arm64|aarch64) ARCH="arm64" ;;
    *) error "Unsupported architecture: $ARCH"; exit 1 ;;
  esac
  EXT=""
  if [ "$OS" = "windows" ]; then EXT=".exe"; fi
}

# ── Fetch latest version from GitHub ─────────────────────────────────────────

get_latest_version() {
  if [ -n "$VERSION" ]; then return 0; fi

  log "Fetching latest version..."

  # Fetch releases JSON and extract the latest cli/* tag
  RELEASES_JSON="$(curl -sL "https://api.github.com/repos/$REPO/releases" 2>/dev/null || true)"
  if [ -z "$RELEASES_JSON" ]; then
    error "Failed to fetch releases from GitHub"
    exit 1
  fi

  VERSION="$(echo "$RELEASES_JSON" | grep '"tag_name"' | grep 'cli/v' | head -1 | sed -E 's/.*"cli\/(v[^"]+)".*/\1/' || true)"

  if [ -z "$VERSION" ]; then
    error "No CLI releases found at github.com/$REPO/releases"
    exit 1
  fi

  log "Latest version: $VERSION"
}

# ── Check if the installed version matches ───────────────────────────────────

check_installed() {
  if command -v "$BINARY_NAME" >/dev/null 2>&1; then
    INSTALLED_VERSION="$("$BINARY_NAME" --version 2>/dev/null | awk '{print $NF}' || true)"
    if [ "$INSTALLED_VERSION" = "$VERSION" ]; then
      log "$BINARY_NAME $VERSION is already installed"
      return 0
    fi
    if [ -n "$INSTALLED_VERSION" ]; then
      log "Updating $BINARY_NAME from $INSTALLED_VERSION to $VERSION"
    fi
    return 1
  fi
  return 1
}

# ── Find a writable install directory ────────────────────────────────────────

find_install_dir() {
  # Check common user directories already in PATH
  for dir in "$HOME/.local/bin" "$HOME/bin" "$HOME/.cargo/bin" "$HOME/go/bin"; do
    case ":$PATH:" in
      *":$dir:"*)
        if [ -d "$dir" ] && [ -w "$dir" ]; then
          echo "$dir"
          return
        fi
        ;;
    esac
  done

  # Check /usr/local/bin
  if [ -d "/usr/local/bin" ] && [ -w "/usr/local/bin" ]; then
    echo "/usr/local/bin"
    return
  fi

  # Fallback: create ~/.local/bin
  mkdir -p "$HOME/.local/bin"
  echo "$HOME/.local/bin"
}

# ── Download + install ───────────────────────────────────────────────────────

install_binary() {
  ASSET="1tt-${OS}-${ARCH}${EXT}"
  TAG="cli/${VERSION}"
  URL="https://github.com/$REPO/releases/download/${TAG}/${ASSET}"
  TMP_DIR="/tmp/1tt-install-$$"

  mkdir -p "$TMP_DIR"
  trap 'rm -rf "$TMP_DIR"' EXIT

  log "Downloading $BINARY_NAME $VERSION for ${OS}/${ARCH}..."

  HTTP_CODE="$(curl -sL -w '%{http_code}' -o "$TMP_DIR/$ASSET" "$URL" 2>/dev/null || true)"
  if [ "$HTTP_CODE" != "200" ] || [ ! -s "$TMP_DIR/$ASSET" ]; then
    error "Download failed (HTTP $HTTP_CODE)"
    error "URL: $URL"
    error "Check that version $VERSION exists at github.com/$REPO/releases"
    exit 1
  fi

  chmod +x "$TMP_DIR/$ASSET"

  INSTALL_DIR="$(find_install_dir)"

  log "Installing to $INSTALL_DIR/$BINARY_NAME${EXT}..."
  if ! cp "$TMP_DIR/$ASSET" "$INSTALL_DIR/$BINARY_NAME${EXT}" 2>/dev/null; then
    # Try with sudo
    if command -v sudo >/dev/null 2>&1; then
      warn "Need elevated permissions..."
      sudo cp "$TMP_DIR/$ASSET" "$INSTALL_DIR/$BINARY_NAME${EXT}"
    else
      error "Cannot write to $INSTALL_DIR"
      error "Try: sudo cp $TMP_DIR/$ASSET /usr/local/bin/$BINARY_NAME"
      exit 1
    fi
  fi

  # Verify
  if "$INSTALL_DIR/$BINARY_NAME${EXT}" --version >/dev/null 2>&1; then
    log "$BINARY_NAME $VERSION installed successfully!"
    log "Location: $INSTALL_DIR/$BINARY_NAME${EXT}"
  else
    error "Installation verification failed"
    exit 1
  fi

  # PATH check
  if ! command -v "$BINARY_NAME" >/dev/null 2>&1; then
    warn "$INSTALL_DIR is not in your PATH"
    SHELL_NAME="$(basename "${SHELL:-/bin/sh}")"
    PROFILE="$HOME/.profile"
    case "$SHELL_NAME" in
      zsh)  PROFILE="$HOME/.zshrc" ;;
      bash) if [ -f "$HOME/.bashrc" ]; then PROFILE="$HOME/.bashrc"; else PROFILE="$HOME/.bash_profile"; fi ;;
      fish) PROFILE="$HOME/.config/fish/config.fish" ;;
    esac
    warn "Run: echo 'export PATH=\"$INSTALL_DIR:\$PATH\"' >> $PROFILE && source $PROFILE"
  fi
}

# ── Main ─────────────────────────────────────────────────────────────────────

main() {
  # Parse installer flags — everything else is passthrough to 1tt
  while [ $# -gt 0 ]; do
    case "$1" in
      --version)
        VERSION="$2"
        shift 2
        ;;
      --help|-h)
        cat <<'HELP'
1tt CLI Installer

Usage:
  curl -sSfL https://1tt.dev/cli/install.sh | sh                             # install latest
  curl -sSfL https://1tt.dev/cli/install.sh | sh -s -- --version v0.1.5      # specific version
  curl -sSfL https://1tt.dev/cli/install.sh | sh -s -- tunnel --token T --db DB  # install + run

Options:
  --version VERSION    Install a specific version (default: latest)
  --help, -h           Show this help

Any other arguments are passed directly to `1tt` after installation.
HELP
        exit 0
        ;;
      --)
        shift
        RUN_ARGS="$*"
        INSTALL_ONLY=false
        break
        ;;
      *)
        RUN_ARGS="$*"
        INSTALL_ONLY=false
        break
        ;;
    esac
  done

  printf "\n${BOLD}  1tt.dev CLI Installer${NC}\n\n"

  detect_platform
  get_latest_version

  if check_installed; then
    true  # Already up to date — skip install
  else
    install_binary
  fi

  # Run 1tt with passthrough args
  if [ "$INSTALL_ONLY" = false ] && [ -n "$RUN_ARGS" ]; then
    printf "\n"
    log "Running: $BINARY_NAME $RUN_ARGS"
    printf "\n"
    # shellcheck disable=SC2086
    exec "$BINARY_NAME" $RUN_ARGS
  fi

  if [ "$INSTALL_ONLY" = true ]; then
    printf "\n"
    log "Get started: $BINARY_NAME --help"
    log "Connect a database: $BINARY_NAME tunnel --token <TOKEN> --db <CONNECTION_STRING>"
    printf "\n"
  fi
}

main "$@"
