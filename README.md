# DevAtlas Core

**DevAtlas Core** is a developer intelligence platform combining **RepoAtlas** (deep repository AST intelligence & dependency graphing) and **ChangeScope** (change blast-radius analysis with explainable heuristic risk estimation).

Built as a final-year engineering project vertical slice, DevAtlas Core provides repository analysis without executing untrusted code or introducing external graph databases or LLMs.

---

## Key Modules & Logical Separation

```
FINAL_YEAR/
├── server/                     # Backend API & Engine
│   ├── src/
│   │   ├── config.ts           # Allowed root, containment limits, ports
│   │   ├── scanner/
│   │   │   ├── pathValidator.ts# Path containment, traversal & symlink prevention
│   │   │   ├── fileScanner.ts  # Source file discovery, test identification, exclusions
│   │   │   └── types.ts        # Data structures for graph, analysis, and impact
│   │   ├── engine/
│   │   │   ├── astParser.ts    # TypeScript Compiler API AST traversal
│   │   │   ├── moduleResolver.ts# Resolution of .ts, .tsx, .js, .jsx & index files
│   │   │   ├── dependencyEngine.ts # Directed dependency graph & cycle detection
│   │   │   └── impactEngine.ts # Reverse dependency blast radius & heuristic risk
│   │   ├── store/
│   │   │   └── analysisStore.ts# Fast in-memory session cache
│   │   ├── routes/             # REST API endpoints
│   │   └── schemas/
│   │       └── careerEvidenceSchema.json # JSON Schema for CareerLens integration
│   └── tests/                  # Automated tests (Vitest + Supertest)
├── client/                     # Frontend Dashboard
│   ├── src/
│   │   ├── components/         # Cytoscape Graph, Metrics, ChangeScope, CareerModal
│   │   ├── api.ts              # Typed API client
│   │   └── index.css           # Vanilla CSS Dark Theme Design System
│   └── index.html
├── sample-repo/                # Included fixture repository for instant testing
└── .env.example                # Safe environment variable template
```

---

## Features

### 1. Repository Scanner
- Path containment enforcement: all target repositories must reside within `DEVATLAS_ALLOWED_ROOT`. Path traversal sequences (`../`) and escaping symlinks are rejected.
- Exclusions: skips `.git`, `node_modules`, build outputs (`dist`, `build`, `.next`), `.env` files, credentials, lock files, and sourcemaps.
- Strict read-only access: uses static AST analysis. Never executes user code or scripts.

### 2. RepoAtlas (Repository Intelligence)
- Parses JavaScript and TypeScript source files using the **TypeScript Compiler API**.
- Scans HTML documents (`.html`) and statically extracts `<script src="...">` local script loading references.
- Resolves script paths relative to the HTML document's directory (e.g. `public/index.html` loading `public/app.js`).
- Safely ignores external URLs (`https://`, `//`), `data:` URIs, fragments, and missing files without executing code.
- Detects static imports (`import ... from`), re-exports (`export ... from`), dynamic imports (`import(...)`), and CommonJS `require(...)`.
- Resolves file extensions (`.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, `.cjs`) and directory index files (`index.ts`, `index.js`).
- Represents HTML documents as distinct document nodes and script references as explicitly typed `script-load` edges.
- Identifies circular dependency chains.
- Aggregates detected languages, packages, automated test files, code files count, and HTML documents count.

### 3. ChangeScope (Change Impact Analysis)
- Analyzes hypothetical source changes by traversing reverse dependency edges (`reverseAdjacencyList`), including both module imports and HTML script loads.
- Accurately identifies affected HTML documents when a shared or local script changes (e.g. changing `theme.js` identifies all dependent HTML pages).
- Distinguishes **Direct Dependents** (Depth 1) from **Transitive Dependents** (Depth $\ge$ 2) and records the dependency traversal chain.
- Pinpoints candidate test suites that import or cover the affected blast radius.
- Computes an explainable heuristic risk score (0–100) and risk tier (`Low`, `Moderate`, `High`, `Critical`).
- *Important Disclaimer*: Clearly labeled as a heuristic static estimate, not a calibrated failure probability.

### 4. GitHub Repository Import & Analysis
- **Direct Public Import**: Paste any public GitHub repository URL into the DevAtlas UI or send a request to `POST /api/v1/repositories/import-github`. Analyzes repositories directly without manual download or copying into local roots.
- **Supported URL Formats**:
  - Canonical repository: `https://github.com/owner/repository` (or `https://www.github.com/owner/repository`)
  - Optional `.git` suffix: `https://github.com/owner/repository.git`
  - Optional branch/ref: `https://github.com/owner/repository/tree/main` or `https://github.com/owner/repository/tree/feature/v1`
  - *Rejected*: Non-HTTPS schemes (`http://`, `git://`), arbitrary hosts (`gitlab.com`, private hostnames), embedded credentials (`user:token@github.com`), path traversal sequences (`/..`), and extra path segments (`/issues`, `/pulls`).
- **Secure Shallow Fetching**:
  - Uses the system Git binary via process API (`child_process.spawn`) with an explicit argument array (`shell: false`). No shell interpolation.
  - Clone flags: `--depth 1 --single-branch --no-tags --no-recurse-submodules`.
  - Non-interactive: `GIT_TERMINAL_PROMPT=0` and `GIT_ASKPASS=''` prevent interactive prompt hanging on private or missing repos.
  - Strict host verification to prevent Server-Side Request Forgery (SSRF).
  - Never executes scripts, install hooks, or application code contained in imported repositories.
- **Size, Timeout & Resource Limits**:
  - Maximum repository payload size: 50 MB (`DEVATLAS_MAX_REPO_SIZE_BYTES`).
  - Git clone timeout: 45 seconds (`DEVATLAS_GIT_CLONE_TIMEOUT_MS`).
  - File count limit: 2,000 files (`DEVATLAS_MAX_FILE_COUNT`).
  - Individual file size: 2 MB (`DEVATLAS_MAX_FILE_SIZE_BYTES`).
- **Isolated Workspaces & Safe Cleanup**:
  - Checked out into isolated, server-generated temporary workspaces in `.temp-workspaces/gh-<uuid>`.
  - Cleanup runs automatically in a `finally` block on **both success and failure**.
  - `safeRemoveDirectory` verifies strict containment within the temporary workspace root, refusing to delete anything outside.
  - Incomplete imports, oversized repos, and failed clones are immediately purged.
- **In-Memory Retention & Provenance**:
  - Reuses the existing RepoAtlas scanner, TypeScript Compiler API AST parser, and HTML script parser.
  - Captures repository provenance: `sourceType: 'github'`, canonical `gitHubUrl`, resolved `commitSha`, and `repoName`.
  - The parsed dependency graph and CareerLens evidence are retained in-memory for the current session, enabling interactive ChangeScope impact analysis and CareerLens evidence generation even after the temporary source directory is deleted.
  - *Note*: In-memory sessions do not survive backend server restarts.

### 5. CareerLens Evidence Contract
- Exposes structured telemetry (`GET /api/v1/analyses/:id/career-evidence`) formatted for integration with a separate CareerLens application without database access.
- Validated against JSON Schema `draft/2020-12`.
- Tracks repository provenance (`sourceType`, `gitHubUrl`, `commitSha`) alongside graph metrics and change impact telemetry.

---

## Getting Started (Windows PowerShell)

### Prerequisites
- Node.js >= 20.x (tested on v24.21.0)
- npm >= 10.x

### 1. Installation
In the project root (`C:\Users\Mayank\Projects\FINAL_YEAR`):

```powershell
# Install all dependencies (root, backend, and frontend)
npm run install:all
```

Or install individually:
```powershell
npm install
cd server; npm install
cd ../client; npm install
cd ..
```

### 2. Environment Configuration
Copy `.env.example` to `server/.env` (or configure via environment variables):

```powershell
cp .env.example server/.env
```

Default variables:
```ini
DEVATLAS_ALLOWED_ROOT=C:\Users\Mayank\Projects\FINAL_YEAR
PORT=5000
DEVATLAS_MAX_FILE_COUNT=2000
DEVATLAS_MAX_FILE_SIZE_BYTES=2097152
NODE_ENV=development
```

### 3. Running Automated Tests
Run the comprehensive test suite (23 tests across path containment, AST parsing, dependency graph, cycle detection, impact scoring, and HTTP APIs):

```powershell
npm test
```

To run type checks and production builds:
```powershell
npm run typecheck
npm run build
```

### 4. Launching the Application
Start both the backend server (port 5000) and the frontend dashboard (port 3000):

```powershell
npm run dev
```

Open your browser to:
[http://localhost:3000](http://localhost:3000)

---

## API Documentation

### `GET /health`
Returns system status and containment configuration.
```json
{
  "status": "ok",
  "service": "DevAtlas Core API",
  "version": "1.0.0",
  "timestamp": "2026-10-28T11:45:00.000Z",
  "allowedRoot": "C:\\Users\\Mayank\\Projects\\FINAL_YEAR",
  "maxFileCount": 2000
}
```

### `POST /api/v1/analyze`
Scans a repository within the allowed root and constructs the dependency graph.
- **Request Body**:
  ```json
  {
    "repoPath": "sample-repo"
  }
  ```
- **Response**:
  ```json
  {
    "analysisId": "e1f13b1a-8c90-410a-9d22-19e4871034dc",
    "repoPath": "sample-repo",
    "scannedAt": "2026-10-28T11:45:00.000Z",
    "summary": {
      "totalFiles": 10,
      "totalDependencies": 12,
      "testFilesCount": 2,
      "languages": { "TypeScript": 7, "TSX": 2, "JavaScript": 1 },
      "packagesCount": 6,
      "circularDependencyChainsCount": 0
    },
    "graph": {
      "nodes": [ ... ],
      "edges": [ ... ]
    },
    "languages": [ ... ],
    "packages": [ ... ],
    "testFiles": [ ... ],
    "circularDependencies": []
  }
  ```

### `POST /api/v1/repositories/import-github`
Imports, shallow clones, and analyzes a public GitHub repository. Retains the analysis in-memory and safely cleans up temporary files.
- **Request Body**:
  ```json
  {
    "repositoryUrl": "https://github.com/kayaNK2125/devatlas-core"
  }
  ```
- **Response**:
  ```json
  {
    "analysisId": "fa809cb8-b2e7-494d-b6a6-0f4f9f7dcbe0",
    "repoPath": "kayaNK2125/devatlas-core",
    "repoName": "devatlas-core",
    "sourceType": "github",
    "gitHubUrl": "https://github.com/kayaNK2125/devatlas-core",
    "commitSha": "4b12d79047b744d084742a7da93ce4e0d9959f63",
    "scannedAt": "2026-10-28T12:00:00.000Z",
    "summary": {
      "totalFiles": 35,
      "totalDependencies": 48,
      "testFilesCount": 7,
      "languages": { "TypeScript": 28, "TSX": 6, "JavaScript": 1 },
      "packagesCount": 18,
      "circularDependencyChainsCount": 0
    },
    "graph": {
      "nodes": [ ... ],
      "edges": [ ... ]
    },
    "languages": [ ... ],
    "packages": [ ... ],
    "testFiles": [ ... ],
    "circularDependencies": []
  }
  ```
- **Error Responses**:
  - `400 INVALID_GITHUB_URL` / `UNSUPPORTED_HOST` / `CREDENTIALS_NOT_ALLOWED`: Invalid or non-github.com URL format.
  - `404 REPOSITORY_NOT_FOUND`: Repository not found or private (DevAtlas Core imports public repositories without PAT).
  - `413 REPO_TOO_LARGE`: Repository source exceeds 50 MB limit.
  - `422 NO_SOURCE_FILES_FOUND`: Repository contains no supported JavaScript/TypeScript/HTML source files.
  - `504 CLONE_TIMEOUT`: Git shallow clone timed out (> 45s).

### `POST /api/v1/impact`
Computes the blast radius and heuristic risk for a target source file.
- **Request Body**:
  ```json
  {
    "analysisId": "e1f13b1a-8c90-410a-9d22-19e4871034dc",
    "targetFile": "src/utils/crypto.ts"
  }
  ```
- **Response**:
  ```json
  {
    "targetFile": "src/utils/crypto.ts",
    "analysisId": "e1f13b1a-8c90-410a-9d22-19e4871034dc",
    "heuristicRisk": {
      "score": 45,
      "level": "Moderate",
      "explanation": "Hypothetical modification impacts 3 file(s) (2 direct, 1 transitive) across depth 2 (~33.3% of repository). 1 candidate test file(s) available to verify impacts. Heuristic risk level: Moderate (45/100).",
      "disclaimer": "Heuristic Assessment: This score is a static dependency-based heuristic estimation to prioritize review and testing, not a formal guarantee or calibrated probability of runtime failure.",
      "factors": {
        "directDependentsCount": 2,
        "transitiveDependentsCount": 1,
        "totalAffected": 3,
        "maxDepth": 2,
        "codebaseAffectedPercent": 33.3,
        "candidateTestsCount": 1,
        "hasCoveringTests": true
      }
    },
    "affectedFiles": [
      {
        "path": "src/services/token.service.ts",
        "depth": 1,
        "isDirect": true,
        "isTest": false,
        "dependencyChain": ["src/utils/crypto.ts", "src/services/token.service.ts"]
      },
      {
        "path": "src/services/auth.service.ts",
        "depth": 1,
        "isDirect": true,
        "isTest": false,
        "dependencyChain": ["src/utils/crypto.ts", "src/services/auth.service.ts"]
      },
      {
        "path": "src/index.ts",
        "depth": 2,
        "isDirect": false,
        "isTest": false,
        "dependencyChain": ["src/utils/crypto.ts", "src/services/auth.service.ts", "src/index.ts"]
      }
    ],
    "candidateTests": [
      {
        "path": "test/crypto.test.ts",
        "depth": 1,
        "isDirect": true,
        "reason": "name_match"
      }
    ],
    "totalCodebaseFiles": 10
  }
  ```

### `GET /api/v1/analyses/:id/career-evidence`
Returns verified telemetry compliant with `careerEvidenceSchema.json` for external portfolio verification.

### `GET /api/v1/career-evidence/schema`
Returns the JSON Schema specification for CareerLens.

---

## Demo Walkthrough

### Option A: Analyze a Public GitHub Repository
1. Start the application with `npm run dev`.
2. Open [http://localhost:3000](http://localhost:3000).
3. Switch to the **Public GitHub Repository** tab.
4. Paste a GitHub repository URL (e.g. `https://github.com/kayaNK2125/devatlas-core` or click **Use devatlas-core**).
5. Click **Analyze GitHub Repository**:
   - The backend shallow-clones the repo into an isolated temporary workspace with `--depth 1 --single-branch --no-tags --no-recurse-submodules`.
   - The AST scanner and dependency graph engine analyze the repository without executing any untrusted code.
   - The temporary checkout is immediately cleaned up.
6. Observe the results:
   - Provenance banner displaying the repository badge, clickable GitHub repository link, and resolved Git commit SHA.
   - Scanned file counts, detected languages, external packages, and interactive Cytoscape dependency graph.
7. Run **ChangeScope**: Select any file in the graph or dropdown to evaluate its change blast radius and heuristic risk tier.
8. Inspect **CareerLens Evidence**: Click the **CareerLens Evidence** button to view structured telemetry containing both repository provenance (`sourceType: 'github'`, `gitHubUrl`, `commitSha`) and graph analysis metrics.

### Option B: Local Repository Scanner
1. Switch to the **Local Repository** tab.
2. Enter `sample-repo` (or click **Use Sample Repo** / **Use demo-shop-easy**).
3. Click **Analyze Local Repository**.
4. Test **Security Containment**: Try entering `../../Windows` or `../` in the repository path. Notice the immediate HTTP 403 `PATH_TRAVERSAL_DENIED` error banner.

---

## Limitations & Future Scope

- **Supported Languages & File Types**: Static analysis currently supports JavaScript (`.js`, `.jsx`, `.mjs`, `.cjs`), TypeScript (`.ts`, `.tsx`), and HTML script dependencies (`.html`). Python, Go, Java, or Rust are not supported in this version.
- **Repository Scope**: Only public repositories hosted on `github.com` are supported. Private repository authentication (Personal Access Tokens / OAuth) is excluded by design for this milestone.
- **Static Resolution Only**: Dynamic runtime path calculations (e.g. `require(computedVar)`) are marked as dynamic imports but cannot resolve target local files statically.
- **Pre-bundler Path Aliases**: Custom `tsconfig.json` `compilerOptions.paths` aliases can be added in subsequent milestones.
- **In-Memory Store Lifecycle**: Analysis sessions are cached in-memory during the server runtime. In-memory analyses do not survive backend server restarts.
- **Resource Limits**: Configured limits apply: max repository payload size 50 MB, clone timeout 45 seconds, max file count 2,000 files, and max individual file size 2 MB.
