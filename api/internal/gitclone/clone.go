package gitclone

import (
	"context"
	"fmt"
	"io/fs"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"github.com/n1rna/1two/api/internal/crawl"
)

// GitHubInfo holds the parsed owner and repo name from a GitHub URL.
type GitHubInfo struct {
	Owner string
	Repo  string
	// Subpath is a path within the repo if the URL points deeper (e.g. /tree/main/docs).
	Subpath string
	// Ref is the branch/tag if specified in the URL.
	Ref string
}

// ParseGitHubURL extracts owner/repo/subpath/ref from a GitHub URL.
// Returns nil if the URL is not a GitHub repo URL.
func ParseGitHubURL(rawURL string) *GitHubInfo {
	// Normalize
	u := strings.TrimSpace(rawURL)
	u = strings.TrimSuffix(u, ".git")
	u = strings.TrimSuffix(u, "/")

	// Strip scheme
	for _, prefix := range []string{"https://", "http://"} {
		if strings.HasPrefix(u, prefix) {
			u = u[len(prefix):]
			break
		}
	}

	// Must be github.com
	if !strings.HasPrefix(u, "github.com/") {
		return nil
	}
	u = u[len("github.com/"):]

	parts := strings.Split(u, "/")
	if len(parts) < 2 {
		return nil
	}

	info := &GitHubInfo{
		Owner: parts[0],
		Repo:  parts[1],
	}

	// Parse /tree/<ref>/... or /blob/<ref>/...
	if len(parts) >= 4 && (parts[2] == "tree" || parts[2] == "blob") {
		info.Ref = parts[3]
		if len(parts) > 4 {
			info.Subpath = strings.Join(parts[4:], "/")
		}
	}

	return info
}

// IsGitHubURL returns true if the URL points to a GitHub repository.
func IsGitHubURL(rawURL string) bool {
	return ParseGitHubURL(rawURL) != nil
}

// relevantExtensions are file extensions we care about for llms.txt generation.
var relevantExtensions = map[string]bool{
	".md":       true,
	".mdx":      true,
	".txt":      true,
	".rst":      true,
	".adoc":     true,
	".yaml":     true,
	".yml":      true,
	".toml":     true,
	".json":     true,
	".go":       true,
	".py":       true,
	".js":       true,
	".ts":       true,
	".tsx":      true,
	".jsx":      true,
	".rs":       true,
	".java":     true,
	".c":        true,
	".h":        true,
	".cpp":      true,
	".cs":       true,
	".rb":       true,
	".php":      true,
	".swift":    true,
	".kt":       true,
	".sh":       true,
	".bash":     true,
	".zsh":      true,
	".makefile": true,
	".cmake":    true,
	".dockerfile": true,
}

// relevantNames are specific filenames we always include (case-insensitive).
var relevantNames = map[string]bool{
	"readme":       true,
	"readme.md":    true,
	"readme.rst":   true,
	"changelog":    true,
	"changelog.md": true,
	"contributing": true,
	"contributing.md": true,
	"license":      true,
	"license.md":   true,
	"makefile":     true,
	"dockerfile":   true,
	"docker-compose.yml": true,
	"docker-compose.yaml": true,
	"cargo.toml":   true,
	"go.mod":       true,
	"package.json": true,
	"pyproject.toml": true,
	"setup.py":     true,
	"gemfile":      true,
}

// maxFileSize is the maximum size of a single file we'll read (64KB).
const maxFileSize = 64 * 1024

// maxTotalFiles caps how many files we return to avoid blowing up context.
const maxTotalFiles = 300

// CloneAndExtract clones a GitHub repo (shallow), reads relevant files, and
// returns them as CrawlPage entries compatible with the agent pipeline.
func CloneAndExtract(ctx context.Context, info *GitHubInfo) ([]crawl.CrawlPage, error) {
	// Create a temp directory
	tmpDir, err := os.MkdirTemp("", "llms-clone-*")
	if err != nil {
		return nil, fmt.Errorf("gitclone: create temp dir: %w", err)
	}
	defer os.RemoveAll(tmpDir)

	// Build the clone URL
	cloneURL := fmt.Sprintf("https://github.com/%s/%s.git", info.Owner, info.Repo)

	// Shallow clone (depth 1) — fast, minimal bandwidth
	args := []string{"clone", "--depth", "1", "--single-branch"}
	if info.Ref != "" {
		args = append(args, "--branch", info.Ref)
	}
	args = append(args, cloneURL, tmpDir)

	cmd := exec.CommandContext(ctx, "git", args...)
	cmd.Env = append(os.Environ(),
		"GIT_TERMINAL_PROMPT=0", // Never prompt for credentials
	)
	if output, err := cmd.CombinedOutput(); err != nil {
		return nil, fmt.Errorf("gitclone: git clone failed: %w\n%s", err, string(output))
	}

	// Determine the root to scan
	scanRoot := tmpDir
	if info.Subpath != "" {
		scanRoot = filepath.Join(tmpDir, info.Subpath)
		if _, err := os.Stat(scanRoot); err != nil {
			return nil, fmt.Errorf("gitclone: subpath %q not found in repo", info.Subpath)
		}
	}

	// Walk the directory and collect relevant files
	repoBaseURL := fmt.Sprintf("https://github.com/%s/%s", info.Owner, info.Repo)
	var pages []crawl.CrawlPage

	err = filepath.WalkDir(scanRoot, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return nil // skip errors
		}

		// Skip hidden directories (.git, .github, etc.) except .github itself
		name := d.Name()
		if d.IsDir() {
			if strings.HasPrefix(name, ".") && name != ".github" {
				return filepath.SkipDir
			}
			// Skip common non-doc directories
			lower := strings.ToLower(name)
			if lower == "node_modules" || lower == "vendor" || lower == "__pycache__" ||
				lower == ".next" || lower == "dist" || lower == "build" || lower == "target" {
				return filepath.SkipDir
			}
			return nil
		}

		if len(pages) >= maxTotalFiles {
			return filepath.SkipAll
		}

		if !isRelevantFile(name) {
			return nil
		}

		// Check file size
		info, err := d.Info()
		if err != nil || info.Size() > maxFileSize || info.Size() == 0 {
			return nil
		}

		// Read file content
		content, err := os.ReadFile(path)
		if err != nil {
			return nil
		}

		// Build GitHub URL for this file
		relPath, _ := filepath.Rel(tmpDir, path)
		fileURL := fmt.Sprintf("%s/blob/HEAD/%s", repoBaseURL, relPath)

		// Determine a title
		title := relPath
		if strings.EqualFold(filepath.Base(relPath), "README.md") {
			dir := filepath.Dir(relPath)
			if dir == "." {
				title = "README (root)"
			} else {
				title = fmt.Sprintf("README (%s)", dir)
			}
		}

		pages = append(pages, crawl.CrawlPage{
			URL:        fileURL,
			Title:      title,
			Markdown:   string(content),
			StatusCode: 200,
		})

		return nil
	})
	if err != nil {
		return nil, fmt.Errorf("gitclone: walk repo: %w", err)
	}

	// Sort: READMEs and docs first, then config files, then source
	sortPages(pages)

	return pages, nil
}

// isRelevantFile checks if a file should be included based on name and extension.
func isRelevantFile(name string) bool {
	lower := strings.ToLower(name)

	// Check exact name matches
	if relevantNames[lower] {
		return true
	}

	// Check extension
	ext := strings.ToLower(filepath.Ext(name))
	return relevantExtensions[ext]
}

// sortPages sorts pages by priority: READMEs > docs > config > source.
func sortPages(pages []crawl.CrawlPage) {
	priority := func(p crawl.CrawlPage) int {
		lower := strings.ToLower(p.URL)
		switch {
		case strings.Contains(lower, "readme"):
			return 0
		case strings.Contains(lower, "/docs/") || strings.Contains(lower, "/doc/"):
			return 1
		case strings.HasSuffix(lower, ".md") || strings.HasSuffix(lower, ".mdx") || strings.HasSuffix(lower, ".rst"):
			return 2
		case strings.Contains(lower, "go.mod") || strings.Contains(lower, "package.json") ||
			strings.Contains(lower, "cargo.toml") || strings.Contains(lower, "pyproject.toml"):
			return 3
		case strings.Contains(lower, "makefile") || strings.Contains(lower, "dockerfile"):
			return 4
		default:
			return 5
		}
	}

	// Simple insertion sort is fine for <=300 items
	for i := 1; i < len(pages); i++ {
		key := pages[i]
		keyPri := priority(key)
		j := i - 1
		for j >= 0 && priority(pages[j]) > keyPri {
			pages[j+1] = pages[j]
			j--
		}
		pages[j+1] = key
	}
}
