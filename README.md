# Smart Data Analysis Assistant — Autonomous Data Analysis & Machine Learning Workbench

**Smart Data Analysis Assistant** is an enterprise-grade, browser-native exploratory data analysis, statistical computing, machine learning, and executive reporting suite powered by server-side Gemini intelligence and deterministic Python/TypeScript numerical engines.

---

## 🌟 Capabilities & Architectural Subsystems

### Phase 1: High-Throughput Ingestion & Semantic Profiling
- Ingests CSV, TSV, JSON, and multi-sheet Excel workbooks with automatic encoding and delimiter detection.
- Computes comprehensive column-level profiles: inferred data types, completeness, distinct cardinality, numerical moments (mean, median, mode, variance, standard deviation, skewness, kurtosis), quartiles ($Q_1, Q_2, Q_3, \text{IQR}$), and date-time chronologies.

### Phase 2: Data Quality Engine & Cleaning Workbench
- **0–100 Data Quality Scoring**: Evaluates completeness, validity, uniqueness, consistency, accuracy, and schema integrity.
- **Interactive Cleaning Pipeline**: One-click imputation (mean, median, mode, forward/backward fill), outlier capping/trimming via IQR fences, duplicate removal, text normalization, and type casting.
- **Non-Destructive Transformation Stack**: Full undo/redo, transformation audit trail, and original raw data isolation.

### Phase 3: Automated EDA & Intelligent Visualizations
- Auto-detects primary business metrics, distribution anomalies, and multidimensional trends.
- Generates correlation heatmaps, box plots with outlier fences, histograms, and time-series decompositions.
- Context-aware chart recommendation engine (bar, grouped bar, line, area, scatter, pie, donut, heatmap, radar).

### Phase 4: AI Principal Data Analyst
- Conversational natural language analytical interface with multi-turn context retention.
- Plan-first execution model: tokenization $\rightarrow$ intent classification $\rightarrow$ schema mapping $\rightarrow$ deterministic aggregation $\rightarrow$ narrative synthesis.
- Natural language query filtering and Python execution sandbox for custom analytical scripts.

### Phase 5: Advanced Statistics & Machine Learning
- **Hypothesis Testing**: Two-sample independent Welch's $t$-test, paired $t$-test, One-Way ANOVA with Tukey HSD post-hoc, and Pearson Chi-Square test of independence.
- **Supervised & Unsupervised ML**: Linear & Polynomial Regression, Logistic Classification, Random Forest estimators, and $K$-Means clustering with elbow curve & silhouette scoring.
- **Diagnostic Rigor**: Normality checks, homoscedasticity verification, ROC/AUC curves, confusion matrices, and feature importance rankings.

### Phase 6: Automated Executive Reporting & Export
- Multi-section report synthesis: Executive Summary, Key Findings, Data Health, Exploratory Analysis, Statistical Tests, Predictive Models, and Strategic Action Items.
- Real-time client-side and server-side exports: PDF documents, standalone interactive HTML briefs, structured Excel spreadsheets (.xlsx), and sanitized CSVs.

### Phase 7: Production Hardening & Operational Observability
- **Dataset Hub & Version Lineage**: Multi-dataset management with automatic version snapshots ($v1.0, v2.0, \dots$) and non-destructive rollback capabilities.
- **Background Processing Center**: Asynchronous task manager with real-time status tracking, cancellation tokens, and retry mechanisms.
- **Multi-Tier Caching Engine**: Version-aware in-memory computation cache preventing redundant model training and aggregation overhead.
- **Enterprise Security Hardening**: Strict separation of user instructions from data tables via `<UNTRUSTED_DATASET_OBSERVATION_DATA>` containment blocks to prevent prompt injection.
- **System Health & Synthetic Benchmarks**: Real-time latency tracking, sub-second responsiveness up to 1,000,000 rows, and an automated regression test suite.
- **Global Command Palette**: Quick keyboard-driven navigation (`Ctrl + K` / `Cmd + K`) and direct AI analyst shortcut (`Ctrl + /`).

---

## ⌨️ Global Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| `Ctrl + K` / `⌘ + K` | Open Universal Command Palette |
| `Ctrl + /` / `⌘ + /` | Jump to Conversational AI Analyst |
| `Ctrl + Enter` | Execute natural language query |
| `Esc` | Dismiss open modals and palettes |

---

## 🔒 Security & Privacy Guarantees

1. **Zero Raw Data Exposure**: Only aggregated statistical summaries, column schemas, and sample representations are sent to AI models. Full datasets remain secure in local memory.
2. **Immutable Original Files**: Original raw ingested data is stored in read-only buffers; all transformations execute on explicit version-tracked working copies.
3. **Deterministic Math Engine**: All $p$-values, confidence intervals, regression coefficients, and quality scores are calculated using deterministic mathematical algorithms.
