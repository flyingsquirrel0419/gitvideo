# gitvideo

`gitvideo` is a TypeScript terminal app that turns Git commit history into an animated MP4 timeline. Run `gitvideo` anywhere to open the arrow-key TUI; command flags remain available for automation.

## Requirements

- Node.js 18+
- Git
- FFmpeg
- GitHub CLI (`gh`) for login-based GitHub access

## Quick Start

### One-command install

```bash
curl -fsSL https://raw.githubusercontent.com/flyingsquirrel0419/gitvideo/main/scripts/install.sh | bash
```

Then run:

```bash
gitvideo
```

The installer now defaults to `flyingsquirrel0419/gitvideo`, installs dependencies, builds the app, and registers the `gitvideo` command. Do not run it with `sudo`; if your npm global prefix is not writable, it falls back to `~/.local` and prints the PATH entry to add.

### macOS notes

```bash
brew install node@22
export PATH="/opt/homebrew/opt/node@22/bin:$PATH"
```

On macOS, the installer uses Homebrew to install missing FFmpeg, GitHub CLI, and canvas build packages automatically. Homebrew itself still needs to be installed first.

### Install another fork or version

```bash
curl -fsSL https://raw.githubusercontent.com/flyingsquirrel0419/gitvideo/main/scripts/install.sh | bash -s -- flyingsquirrel0419/gitvideo
GITVIDEO_VERSION=v1.0.16 curl -fsSL https://raw.githubusercontent.com/flyingsquirrel0419/gitvideo/main/scripts/install.sh | bash
```

### Update

```bash
curl -fsSL https://raw.githubusercontent.com/flyingsquirrel0419/gitvideo/main/scripts/uninstall.sh | bash
curl -fsSL https://raw.githubusercontent.com/flyingsquirrel0419/gitvideo/main/scripts/install.sh | bash
```

### Remove

```bash
curl -fsSL https://raw.githubusercontent.com/flyingsquirrel0419/gitvideo/main/scripts/uninstall.sh | bash
```

## First Run

```bash
gitvideo
```

The installer creates one executable symlink named `gitvideo` in your npm global bin directory. If your shell cannot find it, add the directory printed by the installer to `PATH`.

## TUI Flow

Running `gitvideo` opens a redesigned terminal studio that adapts to the current terminal size. Use arrow keys to move, Enter to select, number keys for direct actions, and `q` to quit.

```text
┌──────────────────────────────────────────────┐
│ gitvideo studio commit history to motion     │
│ repo → graph → frames → mp4 ●──────────────● │
├──────────────────────────────────────────────┤
│ ACTIONS                                      │
│ ▶ [1] Quick render current directory   ready │
│   [2] Configure local repository       setup │
│   [3] Configure GitHub repository      setup │
│   [4] GitHub login                    github │
├──────────────────────────────────────────────┤
│ SELECTED                                     │
│ Quick render current directory        ready  │
│ Use this folder with default video settings. │
└──────────────────────────────────────────────┘
```

Quick render uses the current directory and default settings. Configure local or GitHub mode when you want to set the repo path, output directory, theme, speed, commit limit, and render workers. For GitHub repositories, run `GitHub login` from the TUI once first, or pass a token through `GITHUB_TOKEN` when using command mode.

## Command Mode

Command mode is still available for scripts and CI.

### Generate from a local repository

```bash
gitvideo generate --repo ./my-project
```

Default output filename:

- local repo: `<repo>-<branch>.mp4`
- GitHub repo: `<owner>-<repo>.mp4`

### Generate into a specific folder

```bash
gitvideo generate --repo ./my-project --output-dir ~/Downloads
```

### Generate with an explicit filename

```bash
gitvideo generate --repo ./my-project -o ~/Downloads/my-project-history.mp4
```

### Generate from GitHub

```bash
gitvideo auth login
gitvideo generate \
  --github flyingsquirrel0419/layercache \
  --theme dark \
  --speed 8 \
  --render-workers 4 \
  --output-dir ~/Downloads
```

## Options

- `gitvideo`: open the interactive arrow-key TUI
- `auth login`: open GitHub CLI web login
- `auth status`: print current GitHub CLI auth status
- `--config <file>`: optional JSON config file, defaults to `gitvideo.config.json`
- `--github <owner/repo>`: fetch commits from GitHub instead of a local repo
- `--token <token>`: optional explicit token override for CI or non-interactive use
- `--output <file>`: explicit output filename or full path
- `--output-dir <dir>`: directory where the generated video should be written
- `--render-workers <number>`: render frames in multiple Node processes; useful for large histories, defaults to `1`
- `--max-commits <number>`: limit the number of commits included
- `--exclude-branch <pattern>`: exclude branches using glob patterns such as `dependabot/*`
- `--keep-frames`: preserve rendered PNG frames instead of deleting them after encoding

## Config File

Create `gitvideo.config.json` if you want reusable defaults:

```json
{
  "fps": 30,
  "framesPerCommit": 15,
  "renderWorkers": 1,
  "width": 1920,
  "height": 1080,
  "theme": "dark",
  "output": "output.mp4",
  "maxCommits": 500,
  "excludeBranches": ["dependabot/*", "renovate/*"]
}
```

CLI flags override values from the config file.

## Install From Source

```bash
npm install
npm run build
```

## Development

```bash
npm test
npm run build
npm run lint
```

## Notes

- If your shell is still using Node 24, switch to Node 22 LTS before installing.
- If your npm global prefix is not writable, the installer falls back to `~/.local` and prints the PATH entry to add.
