# Smart Data Analysis Assistant — Production Release v1.0.0

**Smart Data Analysis Assistant** is an enterprise-grade, desktop-native and browser-ready exploratory data analysis, statistical computing, machine learning, and executive reporting workbench.

---

## 📦 Release Assets & Distribution Artifacts

| Artifact | File Name | Description | Target Platform |
|---|---|---|---|
| **Windows NSIS Installer** | `Smart Data Analysis Assistant Setup 1.0.0.exe` | Standard Windows executable setup installer with Start Menu & Desktop shortcuts, directory selection, and clean uninstallation. | Windows 10/11 x64 |
| **Windows Portable Build** | `release/win-unpacked/Smart Data Analysis Assistant.exe` | Standalone unpacked portable binary directory. Runs immediately without installation or elevated rights. | Windows 10/11 x64 |
| **Electron Main Process** | `dist-electron/main.cjs` | Bundled background process with secure IPC and local credential vault. | Node.js / Electron Runtime |
| **Electron Preload Bridge** | `dist-electron/preload.cjs` | Hardened, sandboxed IPC bridge with isolated context. | BrowserView / Electron |
| **Web Application Assets** | `dist/` | Production-compiled single-page application bundle. | Browser / WebView |

---

## 🌟 Key Capabilities

### 1. Universal Data Ingestion
- High-throughput client-side parsing for **CSV**, **TSV**, **Excel (XLSX / XLS)**, **JSON**, and raw **Text/Log** datasets.
- Automatic encoding detection (UTF-8, Latin-1, ASCII) and delimiter inference.
- Multi-sheet Excel workbook inspection and individual sheet selection.

### 2. Data Quality & Audit Engine
- 0–100 Data Health Score with automated breakdown across Completeness, Validity, Uniqueness, and Consistency.
- Anomaly detection for duplicate rows, missing fields, schema violations, outlier metrics, and conflicting date formats.

### 3. Non-Destructive Data Cleaning Pipeline
- Step-by-step cleaning workbench with real-time before/after column distributions.
- One-click imputation (mean, median, mode, constant), duplicate elimination, outlier clipping, and type conversions.
- Full transactional rollback and undo support.

### 4. Exploratory Data Analysis (EDA)
- Automated statistical profiling: mean, median, standard deviation, variance, skewness, kurtosis, and IQR.
- Interactive frequency distributions, histograms, and quantile breakdowns.
- Pearson and Spearman correlation matrices with significance indicators.

### 5. Visualization Studio & Executive Dashboard
- 11 enterprise chart types: Column, Bar, Horizontal Bar, Line, Area, Scatter, Pie, Donut, Treemap, KPI Cards, and Summary Tables.
- Live aggregations (Sum, Avg, Count, Min, Max), custom sorting, and date granularity groupings.
- Drag-and-drop customizable executive dashboard with interactive global slicers (date range, category filters).

### 6. Conversational AI Analyst & Autonomous Investigator
- Natural language query execution against dataset context with strict boundary isolation.
- Autonomous business objective investigator that identifies key drivers, segments, and anomalies with executive summaries.

### 7. Statistical Hypothesis Testing & Machine Learning
- **Hypothesis Testing**: Welch's independent $t$-test, One-Way ANOVA, and Pearson Chi-Square test of independence.
- **Machine Learning**: Linear Regression, Logistic Regression classification, and $K$-Means clustering with silhouette scoring and cluster profiling.

### 8. Enterprise Connection Vault & Connectors
- **Connection Vault**: Hardware-backed or AES-256-GCM encrypted credential vault with zero plaintext leakage.
- **Database Drivers**: PostgreSQL, MySQL, and Microsoft SQL Server connection handlers.
- **Web & API Ingestion**: REST API JSON endpoints, OData feed connector, and HTML Web Table scraper.

### 9. Multi-Format Report & Export Studio
- Automated executive brief generation with key findings, data anomalies, and actionable recommendations.
- Multi-format data and chart export: **CSV**, **Excel (.xlsx)**, **HTML**, **SVG**, **PNG**, and **PDF**.

---

## 💻 System Requirements

- **Operating System**: Windows 10 or Windows 11 (64-bit).
- **Processor**: Intel Core i3 / AMD Ryzen 3 or higher (x64 architecture).
- **Memory**: Minimum 4 GB RAM (8 GB RAM recommended for processing 100,000+ rows).
- **Disk Space**: 600 MB free storage.
- **Display**: 1280 × 720 minimum screen resolution (1920 × 1080 recommended).
- **Internet Access**: Optional. All core file ingestion, cleaning, EDA, visualization, machine learning, and exports run 100% offline. Internet required only for external database/REST connectors and Gemini AI queries.

---

## 🚀 Installation & Launch Instructions

### Method A: Standalone Unpacked Portable (Immediate Run)
1. Extract or navigate to the `release/win-unpacked` directory.
2. Double-click `Smart Data Analysis Assistant.exe`.
3. The application will launch immediately without requiring administrator privileges, Node.js, or development servers.

### Method B: Standard Windows Setup Installer
1. Run `Smart Data Analysis Assistant Setup 1.0.0.exe`.
2. Follow the setup wizard to choose an installation directory (optional; defaults to `%LOCALAPPDATA%\Programs\Smart Data Analysis Assistant`).
3. Click **Install**.
4. Launch via the created Desktop shortcut or Start Menu entry.
5. To uninstall, navigate to Windows **Settings > Apps > Installed apps** and select **Uninstall**.

---

## 🔒 Security Architecture

- **Context Isolation**: `contextIsolation: true` is strictly enforced on all Electron windows.
- **Node Integration Disabled**: `nodeIntegration: false` ensures the renderer process cannot access Node.js primitives or native OS APIs.
- **Sandbox Mode**: `sandbox: true` enables Chromium's security sandbox.
- **Encrypted Vault**: Credentials and connection tokens are encrypted using AES-256-GCM with secure key derivation.
- **Prompt Isolation**: Dataset context passed to AI assistants is enclosed within `<UNTRUSTED_DATASET_OBSERVATION_DATA>` boundary tags to prevent prompt injection.

---

## ⚠️ Known Limitations & Deployment Notes

1. **Remote Database Connections**: Connecting to live PostgreSQL, MySQL, or SQL Server instances requires network reachability and valid user credentials (`REQUIRES CONFIGURATION`).
2. **Cloud OAuth Integrations**: Connecting to live Google, Microsoft, or Salesforce cloud tenants requires registering an application ID/Secret in your respective cloud console (`REQUIRES CONFIGURATION`).
3. **NSIS Installer Cross-Compilation**: The standalone unpacked Windows binary (`release/win-unpacked/Smart Data Analysis Assistant.exe`) is completely built and validated in Linux containers. Creating single-file `.exe` NSIS installer bundles directly requires executing `npm run desktop:pack` on a Windows host or CI runner with `wine`.
4. **Massive Datasets (>500,000 rows)**: The in-memory client-side data engine is optimized for datasets up to 100,000–250,000 rows. For datasets exceeding 500,000 rows, database-backed connection queries are recommended.
