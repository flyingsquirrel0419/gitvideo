# gitvideo

`gitvideo` is a TypeScript CLI that turns Git commit history into an animated MP4 timeline. It supports local repositories through `git log` and remote GitHub repositories through the GitHub API.

## Requirements

- Node.js 18+
- Git
- FFmpeg
- GitHub CLI (`gh`) for login-based GitHub access

## Quick Start

### macOS prerequisites

```bash
brew install node@22 ffmpeg gh pkg-config cairo pango libpng jpeg giflib librsvg pixman
export PATH="/opt/homebrew/opt/node@22/bin:$PATH"
```

Do not run the installer with `sudo`.

### Install

```bash
curl -fsSL https://raw.githubusercontent.com/flyingsquirrel0419/gitvideo/main/scripts/install.sh | bash -s -- flyingsquirrel0419/gitvideo
```

### Update

```bash
curl -fsSL https://raw.githubusercontent.com/flyingsquirrel0419/gitvideo/main/scripts/uninstall.sh | bash
curl -fsSL https://raw.githubusercontent.com/flyingsquirrel0419/gitvideo/main/scripts/install.sh | bash -s -- flyingsquirrel0419/gitvideo
```

### Remove

```bash
curl -fsSL https://raw.githubusercontent.com/flyingsquirrel0419/gitvideo/main/scripts/uninstall.sh | bash
```

## First Run

```bash
gitvideo auth login
gitvideo --help
```

## Common Usage

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
  --output-dir ~/Downloads
```

## Options

- `auth login`: open GitHub CLI web login
- `auth status`: print current GitHub CLI auth status
- `--config <file>`: optional JSON config file, defaults to `gitvideo.config.json`
- `--github <owner/repo>`: fetch commits from GitHub instead of a local repo
- `--token <token>`: optional explicit token override for CI or non-interactive use
- `--output <file>`: explicit output filename or full path
- `--output-dir <dir>`: directory where the generated video should be written
- `--max-commits <number>`: limit the number of commits included
- `--exclude-branch <pattern>`: exclude branches using glob patterns such as `dependabot/*`
- `--keep-frames`: preserve rendered PNG frames instead of deleting them after encoding

## Config File

Create `gitvideo.config.json` if you want reusable defaults:

```json
{
  "fps": 30,
  "framesPerCommit": 15,
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
