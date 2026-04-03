# Git Commit Visualizer — TypeScript 구현 완전 명세서

> **목적:** GitHub 레포지토리의 커밋 히스토리(브랜치 생성, 커밋, 머지 등)를 파싱하여  
> 트리(DAG) 형태로 애니메이션 영상(mp4)을 자동 생성하는 CLI 도구  
> **언어:** TypeScript (Node.js)  
> **대상:** 이 문서를 읽는 모든 AI 또는 개발자가 전체를 구현 가능한 수준으로 작성됨

---

## 목차

1. [프로젝트 구조](#1-프로젝트-구조)
2. [기술 스택 & 의존성](#2-기술-스택--의존성)
3. [데이터 타입 정의](#3-데이터-타입-정의)
4. [Phase 1 — Git 데이터 수집 & 파싱](#4-phase-1--git-데이터-수집--파싱)
5. [Phase 2 — DAG 그래프 구성](#5-phase-2--dag-그래프-구성)
6. [Phase 3 — 레이아웃 계산 (레인 배정)](#6-phase-3--레이아웃-계산-레인-배정)
7. [Phase 4 — Canvas 프레임 렌더링](#7-phase-4--canvas-프레임-렌더링)
8. [Phase 5 — FFmpeg 영상 인코딩](#8-phase-5--ffmpeg-영상-인코딩)
9. [Phase 6 — CLI 인터페이스](#9-phase-6--cli-인터페이스)
10. [전체 실행 흐름](#10-전체-실행-흐름)
11. [설정 파일 스펙](#11-설정-파일-스펙)
12. [테스트 전략](#12-테스트-전략)
13. [구현 순서 & 체크리스트](#13-구현-순서--체크리스트)

---

## 1. 프로젝트 구조

```
git-visualizer/
├── src/
│   ├── index.ts                  # 진입점 (CLI)
│   ├── cli.ts                    # CLI 파서 (commander)
│   ├── config.ts                 # 설정 로더
│   │
│   ├── git/
│   │   ├── parser.ts             # git log 파싱
│   │   ├── githubApi.ts          # GitHub REST API 연동
│   │   └── types.ts              # Git 관련 타입
│   │
│   ├── graph/
│   │   ├── dag.ts                # DAG 구성 로직
│   │   ├── layout.ts             # 레인 배정 & 좌표 계산
│   │   └── types.ts              # 그래프 관련 타입
│   │
│   ├── renderer/
│   │   ├── frameRenderer.ts      # 단일 프레임 렌더링
│   │   ├── animator.ts           # 프레임 시퀀스 생성
│   │   ├── theme.ts              # 색상/폰트 테마
│   │   └── types.ts              # 렌더링 관련 타입
│   │
│   ├── encoder/
│   │   └── ffmpeg.ts             # FFmpeg 래퍼
│   │
│   └── utils/
│       ├── logger.ts             # 로거
│       └── fileUtils.ts          # 파일 유틸
│
├── tests/
│   ├── git/
│   ├── graph/
│   └── renderer/
│
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

---

## 2. 기술 스택 & 의존성

### package.json

```json
{
  "name": "git-visualizer",
  "version": "1.0.0",
  "description": "GitHub commit history to video generator",
  "main": "dist/index.js",
  "bin": {
    "git-viz": "dist/index.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "ts-node src/index.ts",
    "test": "vitest",
    "lint": "eslint src --ext .ts"
  },
  "dependencies": {
    "@octokit/rest": "^20.0.0",
    "canvas": "^2.11.2",
    "commander": "^11.0.0",
    "simple-git": "^3.20.0",
    "chalk": "^5.3.0",
    "ora": "^7.0.0",
    "dotenv": "^16.3.0",
    "zod": "^3.22.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/canvas": "^2.11.0",
    "typescript": "^5.2.0",
    "ts-node": "^10.9.0",
    "vitest": "^0.34.0"
  }
}
```

### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "declaration": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

### 외부 시스템 요구사항

- **Node.js** >= 18.0.0
- **FFmpeg** 설치 필수 (`brew install ffmpeg` / `apt install ffmpeg`)
- **Git** CLI 설치 필수

---

## 3. 데이터 타입 정의

### src/git/types.ts

```typescript
/** git log에서 파싱된 원시 커밋 데이터 */
export interface RawCommit {
  sha: string;           // 40자 full SHA
  parentShas: string[];  // 부모 SHA 배열 (머지 커밋은 2개)
  refs: string[];        // HEAD, origin/main, feature/login 등
  message: string;       // 커밋 메시지 첫 줄
  timestamp: number;     // Unix timestamp (초)
  authorName: string;
  authorEmail: string;
}

/** 정규화된 브랜치 정보 */
export interface BranchInfo {
  name: string;
  headSha: string;
  isRemote: boolean;
  isActive: boolean;
}
```

### src/graph/types.ts

```typescript
/** DAG의 노드 (커밋 1개) */
export interface CommitNode {
  sha: string;
  shortSha: string;      // sha 앞 7자
  parentShas: string[];
  childShas: string[];
  branchNames: string[]; // 이 커밋에 붙은 브랜치 레이블
  message: string;
  timestamp: number;
  authorName: string;
  authorEmail: string;
  isMerge: boolean;      // parentShas.length >= 2
  laneIndex: number;     // 배정된 레인 번호 (0-based)
  x: number;            // 픽셀 X 좌표
  y: number;            // 픽셀 Y 좌표
}

/** 커밋 간 연결선 */
export interface CommitEdge {
  fromSha: string;
  toSha: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  isMerge: boolean;
  laneColor: string;    // 레인 고유 색상
}

/** 전체 그래프 */
export interface CommitGraph {
  nodes: Map<string, CommitNode>;
  edges: CommitEdge[];
  orderedShas: string[]; // 시간순 정렬된 SHA 배열
  laneCount: number;
  totalWidth: number;
  totalHeight: number;
}
```

### src/renderer/types.ts

```typescript
export interface RenderConfig {
  width: number;          // 영상 너비 (기본 1920)
  height: number;         // 영상 높이 (기본 1080)
  fps: number;            // 프레임레이트 (기본 30)
  framesPerCommit: number; // 커밋 1개당 프레임 수 (기본 15)
  theme: Theme;
}

export interface Theme {
  background: string;
  nodeColors: string[];   // 레인별 순환 색상 배열
  nodeRadius: number;
  edgeWidth: number;
  mergeNodeColor: string;
  textColor: string;
  labelFontSize: number;
  shaFontSize: number;
  fontFamily: string;
}

export interface AnimationFrame {
  frameIndex: number;
  visibleNodeShas: Set<string>;
  visibleEdges: CommitEdge[];
  highlightSha: string | null; // 현재 등장 중인 커밋
  progress: number;           // 0.0 ~ 1.0 (등장 애니메이션 진행도)
}
```

---

## 4. Phase 1 — Git 데이터 수집 & 파싱

### src/git/parser.ts

**책임:** 로컬 git 레포 또는 GitHub API에서 커밋 목록을 수집하여 `RawCommit[]` 반환

```typescript
import simpleGit, { SimpleGit } from 'simple-git';
import { RawCommit } from './types';

const LOG_FORMAT = [
  '%H',   // 0: full sha
  '%P',   // 1: parent shas (공백 구분)
  '%D',   // 2: refs (HEAD -> main, origin/main 등)
  '%s',   // 3: subject (첫 줄 메시지)
  '%at',  // 4: author timestamp (unix)
  '%an',  // 5: author name
  '%ae',  // 6: author email
].join('%x00'); // null byte 구분자 사용 (메시지에 | 포함될 수 있으므로)

export class GitParser {
  private git: SimpleGit;

  constructor(repoPath: string) {
    this.git = simpleGit(repoPath);
  }

  async parseAll(): Promise<RawCommit[]> {
    // --all: 모든 브랜치, --topo-order: 위상 정렬
    const rawLog = await this.git.raw([
      'log',
      '--all',
      '--topo-order',
      `--pretty=format:${LOG_FORMAT}`,
    ]);

    return rawLog
      .split('\n')
      .filter(line => line.trim().length > 0)
      .map(line => this.parseLine(line));
  }

  private parseLine(line: string): RawCommit {
    const parts = line.split('\x00');
    const [sha, parentsRaw, refsRaw, message, timestampStr, authorName, authorEmail] = parts;

    const parentShas = parentsRaw
      .split(' ')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    // refs 파싱: "HEAD -> main, origin/main, tag: v1.0" 형태
    const refs = refsRaw
      .split(',')
      .map(r => r.trim())
      .filter(r => r.length > 0)
      .map(r => {
        if (r.startsWith('HEAD -> ')) return r.replace('HEAD -> ', '');
        if (r.startsWith('tag: ')) return r.replace('tag: ', 'tag/');
        return r;
      });

    return {
      sha: sha.trim(),
      parentShas,
      refs,
      message: message.trim(),
      timestamp: parseInt(timestampStr.trim(), 10),
      authorName: authorName.trim(),
      authorEmail: authorEmail.trim(),
    };
  }
}
```

### src/git/githubApi.ts

**책임:** GitHub REST API를 통해 원격 레포의 커밋 수집 (토큰 필요)

```typescript
import { Octokit } from '@octokit/rest';
import { RawCommit } from './types';

export class GitHubApiParser {
  private octokit: Octokit;

  constructor(token: string) {
    this.octokit = new Octokit({ auth: token });
  }

  async parseAll(owner: string, repo: string): Promise<RawCommit[]> {
    // 1) 모든 브랜치 목록 수집
    const branches = await this.octokit.paginate(
      this.octokit.repos.listBranches,
      { owner, repo, per_page: 100 }
    );

    const commitMap = new Map<string, RawCommit>();

    // 2) 브랜치별 커밋 수집 (중복 제거)
    for (const branch of branches) {
      const commits = await this.octokit.paginate(
        this.octokit.repos.listCommits,
        { owner, repo, sha: branch.name, per_page: 100 }
      );

      for (const c of commits) {
        if (commitMap.has(c.sha)) continue;

        commitMap.set(c.sha, {
          sha: c.sha,
          parentShas: c.parents.map((p: { sha: string }) => p.sha),
          refs: [],
          message: c.commit.message.split('\n')[0],
          timestamp: Math.floor(
            new Date(c.commit.author?.date ?? '').getTime() / 1000
          ),
          authorName: c.commit.author?.name ?? '',
          authorEmail: c.commit.author?.email ?? '',
        });
      }
    }

    // 3) refs 보정: branch head SHA에 브랜치명 부착
    for (const branch of branches) {
      const node = commitMap.get(branch.commit.sha);
      if (node) node.refs.push(branch.name);
    }

    // 4) 시간 역순 정렬 (최신 → 과거)
    return Array.from(commitMap.values()).sort(
      (a, b) => b.timestamp - a.timestamp
    );
  }
}
```

---

## 5. Phase 2 — DAG 그래프 구성

### src/graph/dag.ts

**책임:** `RawCommit[]` → `CommitGraph` 변환  
각 노드의 자식 관계, 머지 여부, 브랜치 레이블을 설정

```typescript
import { RawCommit } from '../git/types';
import { CommitGraph, CommitNode, CommitEdge } from './types';

export class DAGBuilder {
  build(rawCommits: RawCommit[]): CommitGraph {
    const nodes = new Map<string, CommitNode>();

    // 1) 노드 초기화
    for (const raw of rawCommits) {
      nodes.set(raw.sha, {
        sha: raw.sha,
        shortSha: raw.sha.substring(0, 7),
        parentShas: raw.parentShas,
        childShas: [],
        branchNames: raw.refs,
        message: raw.message,
        timestamp: raw.timestamp,
        authorName: raw.authorName,
        authorEmail: raw.authorEmail,
        isMerge: raw.parentShas.length >= 2,
        laneIndex: 0,
        x: 0,
        y: 0,
      });
    }

    // 2) 자식 관계 역추적
    for (const node of nodes.values()) {
      for (const parentSha of node.parentShas) {
        const parent = nodes.get(parentSha);
        if (parent && !parent.childShas.includes(node.sha)) {
          parent.childShas.push(node.sha);
        }
      }
    }

    // 3) 위상 정렬 (Kahn's algorithm) — 시간순 보조 정렬
    const orderedShas = this.topologicalSort(nodes);

    return {
      nodes,
      edges: [], // Phase 3 이후에 채워짐
      orderedShas,
      laneCount: 0,
      totalWidth: 0,
      totalHeight: 0,
    };
  }

  private topologicalSort(nodes: Map<string, CommitNode>): string[] {
    const inDegree = new Map<string, number>();
    for (const node of nodes.values()) {
      if (!inDegree.has(node.sha)) inDegree.set(node.sha, 0);
      for (const child of node.childShas) {
        inDegree.set(child, (inDegree.get(child) ?? 0) + 1);
      }
    }

    // 진입 차수 0인 노드(가장 최신 커밋)부터 시작
    const queue: string[] = [];
    for (const [sha, deg] of inDegree.entries()) {
      if (deg === 0) queue.push(sha);
    }
    // 동일 레벨은 timestamp 기준 정렬
    queue.sort((a, b) => {
      const ta = nodes.get(a)!.timestamp;
      const tb = nodes.get(b)!.timestamp;
      return tb - ta;
    });

    const result: string[] = [];
    while (queue.length > 0) {
      const sha = queue.shift()!;
      result.push(sha);
      const node = nodes.get(sha)!;
      for (const parentSha of node.parentShas) {
        const newDeg = (inDegree.get(parentSha) ?? 1) - 1;
        inDegree.set(parentSha, newDeg);
        if (newDeg === 0) {
          const insertIdx = queue.findIndex(
            s => (nodes.get(s)?.timestamp ?? 0) < (nodes.get(parentSha)?.timestamp ?? 0)
          );
          if (insertIdx === -1) queue.push(parentSha);
          else queue.splice(insertIdx, 0, parentSha);
        }
      }
    }

    return result;
  }
}
```

---

## 6. Phase 3 — 레이아웃 계산 (레인 배정)

### src/graph/layout.ts

**책임:** 각 커밋에 레인(X축 컬럼)과 픽셀 좌표를 배정하고, 엣지(연결선) 좌표 계산

```typescript
import { CommitGraph, CommitNode, CommitEdge } from './types';
import { Theme } from '../renderer/types';

const LANE_WIDTH = 40;    // 레인 간격 (px)
const ROW_HEIGHT = 60;    // 커밋 간 세로 간격 (px)
const PADDING_TOP = 80;
const PADDING_LEFT = 60;

export class LayoutCalculator {
  calculate(graph: CommitGraph, theme: Theme): CommitGraph {
    const { nodes, orderedShas } = graph;
    
    // --- 레인 배정 ---
    // 활성 레인: 현재 진행 중인 브랜치들이 점유 중인 레인 인덱스
    const activeLanes: (string | null)[] = []; // 인덱스 = 레인, 값 = 점유 SHA
    
    // 위상 정렬 역순(과거→최신)으로 레인 배정
    const reversedShas = [...orderedShas].reverse();

    for (let rowIndex = 0; rowIndex < reversedShas.length; rowIndex++) {
      const sha = reversedShas[rowIndex];
      const node = nodes.get(sha)!;

      // 이미 자식에 의해 레인이 예약된 경우
      let lane = activeLanes.indexOf(sha);
      if (lane === -1) {
        // 빈 레인 찾기
        lane = activeLanes.indexOf(null);
        if (lane === -1) {
          lane = activeLanes.length;
          activeLanes.push(sha);
        } else {
          activeLanes[lane] = sha;
        }
      }

      node.laneIndex = lane;
      node.x = PADDING_LEFT + lane * LANE_WIDTH;
      node.y = PADDING_TOP + rowIndex * ROW_HEIGHT;

      // 현재 레인 해제
      activeLanes[lane] = null;

      // 부모 레인 예약 (첫 번째 부모는 현재 레인 유지)
      if (node.parentShas.length > 0) {
        activeLanes[lane] = node.parentShas[0];
      }
      // 머지의 두 번째 부모는 새 레인 예약
      if (node.parentShas.length >= 2) {
        let newLane = activeLanes.indexOf(null);
        if (newLane === -1) {
          newLane = activeLanes.length;
          activeLanes.push(node.parentShas[1]);
        } else {
          activeLanes[newLane] = node.parentShas[1];
        }
      }
    }

    // --- 엣지 생성 ---
    const edges: CommitEdge[] = [];
    const laneColors = theme.nodeColors;

    for (const sha of orderedShas) {
      const node = nodes.get(sha)!;
      for (const parentSha of node.parentShas) {
        const parent = nodes.get(parentSha);
        if (!parent) continue;

        edges.push({
          fromSha: sha,
          toSha: parentSha,
          fromX: node.x,
          fromY: node.y,
          toX: parent.x,
          toY: parent.y,
          isMerge: node.isMerge,
          laneColor: laneColors[node.laneIndex % laneColors.length],
        });
      }
    }

    const laneCount = Math.max(...Array.from(nodes.values()).map(n => n.laneIndex)) + 1;
    const totalWidth = PADDING_LEFT * 2 + laneCount * LANE_WIDTH;
    const totalHeight = PADDING_TOP * 2 + orderedShas.length * ROW_HEIGHT;

    return { ...graph, edges, laneCount, totalWidth, totalHeight };
  }
}
```

---

## 7. Phase 4 — Canvas 프레임 렌더링

### src/renderer/theme.ts

```typescript
import { Theme } from './types';

export const DARK_THEME: Theme = {
  background: '#0d1117',        // GitHub 다크 배경
  nodeColors: [
    '#58a6ff', // blue
    '#3fb950', // green
    '#f78166', // red
    '#d2a8ff', // purple
    '#ffa657', // orange
    '#79c0ff', // light blue
    '#56d364', // light green
    '#ff7b72', // light red
  ],
  nodeRadius: 8,
  edgeWidth: 2,
  mergeNodeColor: '#e3b341',    // 머지 커밋 = 노란색
  textColor: '#e6edf3',
  labelFontSize: 11,
  shaFontSize: 10,
  fontFamily: 'monospace',
};

export const LIGHT_THEME: Theme = {
  background: '#ffffff',
  nodeColors: [
    '#0969da', '#1a7f37', '#cf222e',
    '#8250df', '#d1242f', '#0550ae',
  ],
  nodeRadius: 8,
  edgeWidth: 2,
  mergeNodeColor: '#9a6700',
  textColor: '#1f2328',
  labelFontSize: 11,
  shaFontSize: 10,
  fontFamily: 'monospace',
};
```

### src/renderer/frameRenderer.ts

**책임:** `AnimationFrame` 1개를 Canvas에 그려 PNG Buffer로 반환

```typescript
import { createCanvas, Canvas, CanvasRenderingContext2D } from 'canvas';
import { CommitGraph, CommitNode, CommitEdge } from '../graph/types';
import { AnimationFrame, RenderConfig } from './types';

export class FrameRenderer {
  private canvas: Canvas;
  private ctx: CanvasRenderingContext2D;
  private config: RenderConfig;
  private graph: CommitGraph;

  constructor(graph: CommitGraph, config: RenderConfig) {
    this.graph = graph;
    this.config = config;
    this.canvas = createCanvas(config.width, config.height);
    this.ctx = this.canvas.getContext('2d');
  }

  renderFrame(frame: AnimationFrame): Buffer {
    const { ctx, config } = this;
    const { theme } = config;

    // --- 배경 ---
    ctx.fillStyle = theme.background;
    ctx.fillRect(0, 0, config.width, config.height);

    // --- 엣지 (선 먼저) ---
    for (const edge of frame.visibleEdges) {
      this.drawEdge(edge, frame.highlightSha);
    }

    // --- 노드 ---
    for (const sha of frame.visibleNodeShas) {
      const node = this.graph.nodes.get(sha)!;
      const isHighlight = sha === frame.highlightSha;
      const progress = isHighlight ? frame.progress : 1.0;
      this.drawNode(node, progress, isHighlight);
    }

    // --- 브랜치 레이블 ---
    for (const sha of frame.visibleNodeShas) {
      const node = this.graph.nodes.get(sha)!;
      if (node.branchNames.length > 0) {
        this.drawBranchLabel(node);
      }
    }

    return this.canvas.toBuffer('image/png');
  }

  private drawEdge(edge: CommitEdge, highlightSha: string | null): void {
    const { ctx } = this;
    const { theme } = this.config;

    ctx.beginPath();
    ctx.strokeStyle = edge.laneColor;
    ctx.lineWidth = theme.edgeWidth;
    ctx.globalAlpha = highlightSha === edge.fromSha ? 1.0 : 0.6;

    // 같은 레인이면 직선, 다른 레인이면 베지어 곡선
    if (edge.fromX === edge.toX) {
      ctx.moveTo(edge.fromX, edge.fromY);
      ctx.lineTo(edge.toX, edge.toY);
    } else {
      const midY = (edge.fromY + edge.toY) / 2;
      ctx.moveTo(edge.fromX, edge.fromY);
      ctx.bezierCurveTo(
        edge.fromX, midY,
        edge.toX,   midY,
        edge.toX,   edge.toY
      );
    }

    ctx.stroke();
    ctx.globalAlpha = 1.0;
  }

  private drawNode(node: CommitNode, progress: number, isHighlight: boolean): void {
    const { ctx } = this;
    const { theme } = this.config;

    const laneColor = theme.nodeColors[node.laneIndex % theme.nodeColors.length];
    const color = node.isMerge ? theme.mergeNodeColor : laneColor;
    const radius = theme.nodeRadius * progress; // 팝인 애니메이션

    // 글로우 효과 (하이라이트 시)
    if (isHighlight && progress > 0.5) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 15;
    }

    ctx.beginPath();
    ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();

    // 테두리
    ctx.strokeStyle = theme.background;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.shadowBlur = 0;

    // SHA + 메시지 텍스트 (progress > 0.7일 때 페이드인)
    if (progress > 0.7) {
      const alpha = (progress - 0.7) / 0.3;
      ctx.globalAlpha = alpha;

      ctx.fillStyle = theme.textColor;
      ctx.font = `${theme.shaFontSize}px ${theme.fontFamily}`;
      ctx.fillText(node.shortSha, node.x + theme.nodeRadius + 6, node.y + 4);

      ctx.font = `${theme.labelFontSize}px ${theme.fontFamily}`;
      const maxLen = 45;
      const msg = node.message.length > maxLen
        ? node.message.substring(0, maxLen) + '…'
        : node.message;
      ctx.fillText(msg, node.x + theme.nodeRadius + 55, node.y + 4);

      ctx.globalAlpha = 1.0;
    }
  }

  private drawBranchLabel(node: CommitNode): void {
    const { ctx } = this;
    const { theme } = this.config;
    const laneColor = theme.nodeColors[node.laneIndex % theme.nodeColors.length];

    let offsetY = -theme.nodeRadius - 6;
    for (const name of node.branchNames.slice(0, 2)) { // 최대 2개
      ctx.fillStyle = laneColor;
      const w = name.length * 7 + 10;
      const h = 16;
      const x = node.x - w / 2;
      const y = node.y + offsetY - h;
      
      // 배지 배경
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, 3);
      ctx.fill();

      // 배지 텍스트
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold 9px ${theme.fontFamily}`;
      ctx.textAlign = 'center';
      ctx.fillText(name, node.x, y + 11);
      ctx.textAlign = 'left';

      offsetY -= (h + 4);
    }
  }
}
```

### src/renderer/animator.ts

**책임:** 커밋 순서대로 프레임 시퀀스를 생성하여 PNG 파일로 저장

```typescript
import * as fs from 'fs';
import * as path from 'path';
import { CommitGraph } from '../graph/types';
import { FrameRenderer } from './frameRenderer';
import { AnimationFrame, RenderConfig } from './types';

export class Animator {
  private renderer: FrameRenderer;
  private graph: CommitGraph;
  private config: RenderConfig;

  constructor(graph: CommitGraph, config: RenderConfig) {
    this.graph = graph;
    this.config = config;
    this.renderer = new FrameRenderer(graph, config);
  }

  async generateFrames(
    outputDir: string,
    onProgress?: (current: number, total: number) => void
  ): Promise<void> {
    fs.mkdirSync(outputDir, { recursive: true });

    // 과거→현재 순으로 애니메이션 (reversedShas = 오래된 것부터)
    const animOrder = [...this.graph.orderedShas].reverse();
    const visibleNodes = new Set<string>();
    const visibleEdges = this.graph.edges;

    let globalFrameIndex = 0;

    for (let commitIdx = 0; commitIdx < animOrder.length; commitIdx++) {
      const sha = animOrder[commitIdx];
      const node = this.graph.nodes.get(sha)!;
      visibleNodes.add(sha);

      // 커밋 등장 애니메이션: framesPerCommit 프레임에 걸쳐 progress 0→1
      for (let f = 0; f < this.config.framesPerCommit; f++) {
        const progress = (f + 1) / this.config.framesPerCommit;

        const frame: AnimationFrame = {
          frameIndex: globalFrameIndex,
          visibleNodeShas: new Set(visibleNodes),
          visibleEdges: visibleEdges.filter(
            e => visibleNodes.has(e.fromSha) && visibleNodes.has(e.toSha)
          ),
          highlightSha: sha,
          progress,
        };

        const buffer = this.renderer.renderFrame(frame);
        const filename = path.join(outputDir, `frame_${String(globalFrameIndex).padStart(6, '0')}.png`);
        fs.writeFileSync(filename, buffer);
        globalFrameIndex++;
      }

      onProgress?.(commitIdx + 1, animOrder.length);
    }

    // 마지막 1초 홀딩
    const holdFrames = this.config.fps;
    const finalFrame: AnimationFrame = {
      frameIndex: globalFrameIndex,
      visibleNodeShas: new Set(visibleNodes),
      visibleEdges: visibleEdges.filter(
        e => visibleNodes.has(e.fromSha) && visibleNodes.has(e.toSha)
      ),
      highlightSha: null,
      progress: 1.0,
    };
    for (let h = 0; h < holdFrames; h++) {
      const buffer = this.renderer.renderFrame(finalFrame);
      const filename = path.join(outputDir, `frame_${String(globalFrameIndex).padStart(6, '0')}.png`);
      fs.writeFileSync(filename, buffer);
      globalFrameIndex++;
    }
  }
}
```

---

## 8. Phase 5 — FFmpeg 영상 인코딩

### src/encoder/ffmpeg.ts

**책임:** 프레임 PNG 시퀀스를 mp4로 인코딩

```typescript
import { spawn } from 'child_process';
import * as path from 'path';

export interface EncodeOptions {
  framesDir: string;
  outputPath: string;
  fps: number;
  audioPath?: string;   // 선택: 배경음악 파일 경로
  crf?: number;         // 품질 (0-51, 낮을수록 고품질, 기본 18)
}

export class FFmpegEncoder {
  async encode(opts: EncodeOptions): Promise<void> {
    const { framesDir, outputPath, fps, audioPath, crf = 18 } = opts;

    const inputPattern = path.join(framesDir, 'frame_%06d.png');

    const args: string[] = [
      '-y',                              // 덮어쓰기
      '-framerate', String(fps),
      '-i', inputPattern,
    ];

    if (audioPath) {
      args.push('-i', audioPath);
      args.push('-shortest');
    }

    args.push(
      '-c:v', 'libx264',
      '-preset', 'slow',
      '-crf', String(crf),
      '-pix_fmt', 'yuv420p',             // 호환성 최대화
      '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', // 짝수 해상도 보장
      outputPath
    );

    return new Promise((resolve, reject) => {
      const proc = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] });

      proc.on('close', code => {
        if (code === 0) resolve();
        else reject(new Error(`FFmpeg exited with code ${code}`));
      });

      proc.on('error', reject);
    });
  }

  /** FFmpeg 설치 여부 확인 */
  async checkInstalled(): Promise<boolean> {
    return new Promise(resolve => {
      const proc = spawn('ffmpeg', ['-version']);
      proc.on('close', code => resolve(code === 0));
      proc.on('error', () => resolve(false));
    });
  }
}
```

---

## 9. Phase 6 — CLI 인터페이스

### src/cli.ts

```typescript
import { Command } from 'commander';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import ora from 'ora';
import chalk from 'chalk';
import { GitParser } from './git/parser';
import { GitHubApiParser } from './git/githubApi';
import { DAGBuilder } from './graph/dag';
import { LayoutCalculator } from './graph/layout';
import { Animator } from './renderer/animator';
import { FFmpegEncoder } from './encoder/ffmpeg';
import { DARK_THEME, LIGHT_THEME } from './renderer/theme';
import { RenderConfig } from './renderer/types';

export function buildCLI(): Command {
  const program = new Command();

  program
    .name('git-viz')
    .description('GitHub 커밋 히스토리를 영상으로 변환')
    .version('1.0.0');

  program
    .command('generate')
    .description('영상 생성')
    .option('-r, --repo <path>', '로컬 git 레포 경로', process.cwd())
    .option('--github <owner/repo>', 'GitHub 레포 (예: torvalds/linux)')
    .option('--token <token>', 'GitHub API 토큰 (--github 사용 시 필요)')
    .option('-o, --output <file>', '출력 파일 경로', 'output.mp4')
    .option('--fps <number>', '프레임레이트', '30')
    .option('--speed <number>', '커밋당 프레임 수 (낮을수록 빠름)', '15')
    .option('--width <number>', '영상 너비', '1920')
    .option('--height <number>', '영상 높이', '1080')
    .option('--theme <name>', '테마 (dark|light)', 'dark')
    .option('--audio <file>', '배경음악 파일')
    .option('--keep-frames', '중간 프레임 PNG 보존')
    .action(async (opts) => {
      const spinner = ora();

      try {
        // 1. FFmpeg 체크
        const encoder = new FFmpegEncoder();
        if (!(await encoder.checkInstalled())) {
          console.error(chalk.red('❌ FFmpeg가 설치되지 않았습니다.'));
          console.error('설치: brew install ffmpeg (macOS) / apt install ffmpeg (Linux)');
          process.exit(1);
        }

        // 2. 커밋 데이터 수집
        spinner.start('커밋 히스토리 수집 중...');
        let rawCommits;

        if (opts.github) {
          const [owner, repo] = opts.github.split('/');
          const apiParser = new GitHubApiParser(opts.token ?? process.env.GITHUB_TOKEN ?? '');
          rawCommits = await apiParser.parseAll(owner, repo);
        } else {
          const parser = new GitParser(path.resolve(opts.repo));
          rawCommits = await parser.parseAll();
        }
        spinner.succeed(`커밋 ${rawCommits.length}개 수집 완료`);

        // 3. DAG 구성
        spinner.start('그래프 구성 중...');
        const dagBuilder = new DAGBuilder();
        let graph = dagBuilder.build(rawCommits);
        spinner.succeed('그래프 구성 완료');

        // 4. 레이아웃 계산
        spinner.start('레이아웃 계산 중...');
        const theme = opts.theme === 'light' ? LIGHT_THEME : DARK_THEME;
        const config: RenderConfig = {
          width: parseInt(opts.width),
          height: parseInt(opts.height),
          fps: parseInt(opts.fps),
          framesPerCommit: parseInt(opts.speed),
          theme,
        };
        const layoutCalc = new LayoutCalculator();
        graph = layoutCalc.calculate(graph, theme);
        spinner.succeed('레이아웃 계산 완료');

        // 5. 프레임 렌더링
        const framesDir = path.join(os.tmpdir(), `git-viz-${Date.now()}`);
        spinner.start('프레임 렌더링 중...');
        const animator = new Animator(graph, config);
        await animator.generateFrames(framesDir, (cur, total) => {
          spinner.text = `프레임 렌더링 중... ${cur}/${total} 커밋`;
        });
        spinner.succeed('프레임 렌더링 완료');

        // 6. 영상 인코딩
        spinner.start('영상 인코딩 중...');
        await encoder.encode({
          framesDir,
          outputPath: path.resolve(opts.output),
          fps: config.fps,
          audioPath: opts.audio,
        });
        spinner.succeed(`영상 생성 완료: ${chalk.green(opts.output)}`);

        // 7. 프레임 정리
        if (!opts.keepFrames) {
          fs.rmSync(framesDir, { recursive: true, force: true });
        }

      } catch (err) {
        spinner.fail('오류 발생');
        console.error(chalk.red(String(err)));
        process.exit(1);
      }
    });

  return program;
}
```

### src/index.ts

```typescript
#!/usr/bin/env node
import 'dotenv/config';
import { buildCLI } from './cli';

const program = buildCLI();
program.parse(process.argv);
```

---

## 10. 전체 실행 흐름

```
git-viz generate --github octocat/Hello-World --token ghp_xxx -o demo.mp4
           │
           ▼
┌─────────────────────┐
│ 1. FFmpeg 설치 확인  │
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│ 2. 커밋 데이터 수집  │  ← GitHubApiParser / GitParser
│    RawCommit[]       │
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│ 3. DAG 구성         │  ← DAGBuilder
│    CommitGraph       │    - 부모/자식 관계
│    (좌표 없음)       │    - 머지 감지
└────────┬────────────┘    - 위상 정렬
         │
         ▼
┌─────────────────────┐
│ 4. 레이아웃 계산    │  ← LayoutCalculator
│    CommitGraph       │    - 레인 배정
│    (좌표 있음)       │    - x, y 픽셀 좌표
│    + edges           │    - 엣지 생성
└────────┬────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│ 5. 프레임 렌더링 (Animator)              │
│    커밋 순서대로 (과거→최신)             │
│    커밋마다 N프레임 생성                 │
│    - 노드 팝인 애니메이션 (progress 0→1) │
│    - 엣지 순차 표시                     │
│    - 브랜치 레이블                      │
│    → /tmp/git-viz-xxx/frame_000001.png  │
└────────┬────────────────────────────────┘
         │
         ▼
┌─────────────────────┐
│ 6. FFmpeg 인코딩    │  ffmpeg -framerate 30 -i frame_%06d.png
│    → output.mp4     │         -c:v libx264 -crf 18 output.mp4
└─────────────────────┘
         │
         ▼
┌─────────────────────┐
│ 7. 임시 프레임 삭제  │
└─────────────────────┘
```

---

## 11. 설정 파일 스펙

### .env.example

```
GITHUB_TOKEN=ghp_your_token_here
```

### git-viz.config.json (선택)

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

---

## 12. 테스트 전략

### tests/git/parser.test.ts

```typescript
import { describe, it, expect } from 'vitest';
import { GitParser } from '../../src/git/parser';

describe('GitParser', () => {
  it('parseLine: 일반 커밋 파싱', () => {
    // 실제 git log 출력 형식으로 모킹 테스트
  });

  it('parseLine: 머지 커밋 (부모 2개) 파싱', () => {
    // parentShas.length === 2 확인
  });
});
```

### tests/graph/dag.test.ts

```typescript
describe('DAGBuilder', () => {
  it('자식 관계 역추적', () => {});
  it('위상 정렬: 최신 커밋이 앞으로', () => {});
  it('머지 커밋 감지: isMerge === true', () => {});
});
```

### tests/graph/layout.test.ts

```typescript
describe('LayoutCalculator', () => {
  it('단일 브랜치: 모든 노드가 레인 0', () => {});
  it('브랜치 분기: 자식 브랜치는 레인 1+', () => {});
  it('머지 후 레인 반환', () => {});
});
```

---

## 13. 구현 순서 & 체크리스트

```
□ Phase 1: 프로젝트 초기화
  □ npm init, tsconfig, 의존성 설치
  □ 디렉터리 구조 생성
  □ .env 설정

□ Phase 2: Git 파싱
  □ src/git/types.ts 타입 정의
  □ src/git/parser.ts (로컬 git log 파싱)
  □ 단위 테스트: 일반/머지/초기 커밋 파싱
  □ src/git/githubApi.ts (GitHub API 파싱)

□ Phase 3: DAG 구성
  □ src/graph/types.ts 타입 정의
  □ src/graph/dag.ts (부모/자식 관계, 위상 정렬)
  □ 단위 테스트: 선형/분기/머지 그래프

□ Phase 4: 레이아웃 계산
  □ src/graph/layout.ts (레인 배정, 좌표 계산, 엣지 생성)
  □ 단위 테스트: 레인 배정 결과 검증

□ Phase 5: 렌더링
  □ src/renderer/theme.ts (다크/라이트 테마)
  □ src/renderer/frameRenderer.ts (Canvas 그리기)
  □ src/renderer/animator.ts (프레임 시퀀스 생성)
  □ 단일 프레임 PNG 출력 검증

□ Phase 6: 인코딩
  □ src/encoder/ffmpeg.ts
  □ FFmpeg CLI 인수 검증
  □ 오디오 믹싱 옵션 테스트

□ Phase 7: CLI
  □ src/cli.ts (commander 설정)
  □ src/index.ts 진입점
  □ 엔드투엔드 테스트: 실제 레포 → mp4 생성

□ Phase 8: 완성도
  □ 진행 상황 스피너 (ora)
  □ 에러 핸들링 (네트워크, FFmpeg, 권한)
  □ maxCommits 제한 처리
  □ README.md 작성
  □ npm publish 준비
```

---

## 사용 예시

```bash
# 설치
npm install -g git-visualizer

# 로컬 레포 → 영상
git-viz generate --repo ./my-project -o my-project.mp4

# GitHub 레포 → 영상 (다크 테마, 1.5배속)
git-viz generate \
  --github torvalds/linux \
  --token ghp_xxxx \
  --theme dark \
  --speed 8 \
  --audio background.mp3 \
  -o linux-history.mp4

# 라이트 테마, 720p
git-viz generate --repo . --theme light --width 1280 --height 720 -o out.mp4
```

---

*이 명세서는 TypeScript + Node.js 환경에서 완전한 구현이 가능하도록 작성되었습니다.  
각 Phase는 독립적으로 구현 및 테스트 가능하며, Phase 순서대로 진행하면 MVP → 완성본으로 점진적으로 빌드됩니다.*
