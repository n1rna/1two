// Package skills provides embedded markdown skill files for the Kim agent.
// Each .md file contains the prompt/instructions for a single agent skill.
// Files are embedded at build time and loaded by the kim package at startup.
package skills

import "embed"

//go:embed *.md
var FS embed.FS
