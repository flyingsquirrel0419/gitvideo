# gitvideo

`gitvideo` is a TypeScript CLI that turns Git commit history into an animated MP4 timeline. It supports local repositories through `git log` and remote GitHub repositories through the GitHub API.

## Requirements

- Node.js 18+
- Git
- FFmpeg
- GitHub CLI (`gh`) for login-based GitHub access

## Install From Source

```bash
npm install
npm run build
```

## Install With `curl`

The installer downloads the latest GitHub release source archive, runs `npm install`, builds the CLI, and finishes with `npm link` so `gitvideo` is available on your shell.

```bash
curl -fsSL https://raw.githubusercontent.com/flyingsquirrel0419/gitvideo/main/scripts/install.sh | bash -s -- flyingsquirrel0419/gitvideo
```

If your npm global prefix is not writable, the installer automatically falls back to `~/.local` and tells you which `PATH` entry to add.

## Usage

### Local repository

```bash
gitvideo generate --repo ./my-project -o my-project.mp4
```

### GitHub repository

```bash
gitvideo auth login
gitvideo generate \
  --github torvalds/linux \
  --theme dark \
  --speed 8 \
  --audio ./background.mp3 \
  -o linux-history.mp4
```

## Options

- `auth login`: open GitHub CLI web login
- `auth status`: print current GitHub CLI auth status
- `--config <file>`: optional JSON config file, defaults to `gitvideo.config.json`
- `--github <owner/repo>`: fetch commits from GitHub instead of a local repo
- `--token <token>`: optional explicit token override for CI or non-interactive use
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

## Development

```bash
npm test
npm run build
npm run lint
```

## Release

Create a public GitHub repository, push this project, and publish a tag:

```bash
git tag v1.0.0
git push origin v1.0.0
```

The GitHub Actions release workflow runs tests, builds the project, and creates a GitHub Release for that tag.
