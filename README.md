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

### 4. CareerLens Evidence Contract
- Exposes structured telemetry (`GET /api/v1/analyses/:id/career-evidence`) formatted for integration with a separate CareerLens application without database access.
- Validated against JSON Schema `draft/2020-12`.

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

1. Start the application with `npm run dev`.
2. Open `http://localhost:3000`.
3. In the repository bar, the input defaults to `sample-repo` (or click **Use Sample Repo**).
4. Click **Analyze Repository**.
5. Observe **RepoAtlas** rendering:
   - Metric cards: Total Source Files, Code Dependencies, Automated Tests, Primary Language, and Circular Cycles.
   - Cytoscape.js interactive graph with zoom, pan, layout toggles (Dagre, Cose, Concentric), and live search.
6. Test **ChangeScope**:
   - Click on `src/utils/crypto.ts` in the graph or select it in the panel dropdown.
   - The graph highlights `crypto.ts` in amber, its direct dependents in orange, and its transitive dependents in red, while dimming unaffected nodes.
   - Inspect the **ChangeScope Risk Card**: Score, qualitative level, plain-English factor breakdown, and heuristic disclaimer.
   - Check the **Candidate Tests to Run** list (`test/crypto.test.ts`).
7. Test **CareerLens Evidence**:
   - Click **CareerLens Evidence** in the top navigation bar.
   - Inspect the structured JSON artifact. Copy or download it.
8. Test **Security Containment**:
   - Try entering `../../Windows` or `../` in the repository input.
   - Notice the immediate HTTP 403 `PATH_TRAVERSAL_DENIED` error banner.

---

## Limitations & Future Work

- **Static Resolution Only**: Dynamic runtime path calculations (e.g. `require(computedPath)`) are recognized as dynamic imports but cannot resolve target local files statically.
- **In-Memory Store**: Analysis sessions are stored in-memory during this MVP demo. Production scaling would benefit from Redis or persistent storage.
- **Pre-bundler Path Aliases**: Custom `tsconfig.json` `compilerOptions.paths` aliases can be added in subsequent milestones.
