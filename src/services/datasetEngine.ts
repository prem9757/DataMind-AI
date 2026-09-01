import { DatasetState, TransformationAction } from '../types/dataset';
import { ManagedDataset, DatasetVersionEntry, DatasetStatus } from '../types/production';
import { globalCache } from './cacheEngine';
import { applyTransformation } from './cleaner';
import { generateCleaningPlan } from './cleaningPlanEngine';
import { profileDataset } from './profiler';
import { auditDataQuality } from './qualityEngine';
import { generateDatasetInsights } from './insightEngine';

type DatasetListener = (datasets: ManagedDataset[], activeId: string | null) => void;

class DatasetEngine {
  private datasets: Map<string, ManagedDataset> = new Map();
  private activeDatasetId: string | null = null;
  private listeners: Set<DatasetListener> = new Set();

  public subscribe(listener: DatasetListener): () => void {
    this.listeners.add(listener);
    listener(this.getAllDatasets(), this.activeDatasetId);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const list = this.getAllDatasets();
    this.listeners.forEach(l => l(list, this.activeDatasetId));
  }

  public getAllDatasets(): ManagedDataset[] {
    return Array.from(this.datasets.values()).sort((a, b) => b.lastModified - a.lastModified);
  }

  public getActiveDataset(): ManagedDataset | null {
    if (!this.activeDatasetId) return null;
    return this.datasets.get(this.activeDatasetId) || null;
  }

  public getDatasetById(id: string): ManagedDataset | null {
    return this.datasets.get(id) || null;
  }

  public setActiveDatasetId(id: string | null): void {
    this.activeDatasetId = id;
    this.notify();
  }

  /**
   * Register a new dataset into the managed pool with initial Version 1 (v1.0 Original)
   */
  public registerDataset(state: DatasetState, initialDescription?: string): ManagedDataset {
    const now = Date.now();
    const v1: DatasetVersionEntry = {
      version: 1,
      versionTag: 'v1.0',
      name: 'Original Ingestion',
      timestamp: now,
      rowCount: state.workingRows.length,
      columnCount: state.columns.length,
      qualityScore: state.quality?.score || 100,
      changeDescription: initialDescription || 'Initial raw dataset ingestion and profile compilation',
      transformationCount: 0,
      stateSnapshot: JSON.parse(JSON.stringify(state))
    };

    const managed: ManagedDataset = {
      id: state.id,
      name: state.name,
      fileName: state.fileName,
      fileSize: state.fileSize,
      fileType: state.fileType,
      createdTime: now,
      lastModified: now,
      status: 'READY',
      currentVersion: 1,
      versions: [v1],
      activeState: state,
      isArchived: false,
      tags: ['Primary', state.fileType.toLowerCase()]
    };

    this.datasets.set(state.id, managed);
    this.activeDatasetId = state.id;
    this.notify();
    return managed;
  }

  /**
   * Create a new dataset version after a cleaning or transformation step
   */
  public createVersion(
    datasetId: string,
    newState: DatasetState,
    changeDescription: string
  ): DatasetVersionEntry {
    const managed = this.datasets.get(datasetId);
    if (!managed) throw new Error(`Dataset ${datasetId} not found`);

    const nextVersionNum = managed.versions.length + 1;
    const versionTag = `v${nextVersionNum}.0`;

    const newVersion: DatasetVersionEntry = {
      version: nextVersionNum,
      versionTag,
      name: changeDescription,
      timestamp: Date.now(),
      rowCount: newState.workingRows.length,
      columnCount: newState.columns.length,
      qualityScore: newState.quality?.score || 100,
      changeDescription,
      transformationCount: newState.transformations.length,
      stateSnapshot: JSON.parse(JSON.stringify(newState))
    };

    managed.versions.push(newVersion);
    managed.currentVersion = nextVersionNum;
    managed.activeState = newState;
    managed.lastModified = Date.now();
    managed.status = 'READY';

    // Invalidate stale caches for old versions
    globalCache.invalidateDataset(datasetId, nextVersionNum);

    this.notify();
    return newVersion;
  }

  /**
   * Update active working state and create a new version snapshot
   */
  public updateWorkingState(
    datasetId: string,
    newState: DatasetState,
    changeDescription: string = 'Updated working dataset state'
  ): DatasetVersionEntry {
    return this.createVersion(datasetId, newState, changeDescription);
  }

  /**
   * Switch the active dataset to a specific version snapshot
   */
  public restoreVersion(datasetId: string, versionNumber: number): DatasetState {
    const managed = this.datasets.get(datasetId);
    if (!managed) throw new Error(`Dataset ${datasetId} not found`);

    const targetVersion = managed.versions.find(v => v.version === versionNumber);
    if (!targetVersion) throw new Error(`Version v${versionNumber} not found`);

    managed.currentVersion = versionNumber;
    managed.activeState = JSON.parse(JSON.stringify(targetVersion.stateSnapshot));
    managed.lastModified = Date.now();

    this.notify();
    return managed.activeState;
  }

  /**
   * Apply transformation to active dataset and create version snapshot
   */
  public applyTransformationWithVersioning(
    datasetId: string,
    action: TransformationAction,
    description: string
  ): DatasetState {
    const managed = this.datasets.get(datasetId);
    if (!managed) throw new Error(`Dataset ${datasetId} not found`);

    managed.status = 'CLEANING';
    this.notify();

    const updatedState = applyTransformation(managed.activeState, action);
    if (!updatedState.cleaningPlan) {
      updatedState.cleaningPlan = generateCleaningPlan(updatedState);
    }

    this.createVersion(datasetId, updatedState, description);
    return updatedState;
  }

  /**
   * Update dataset status
   */
  public setDatasetStatus(datasetId: string, status: DatasetStatus): void {
    const managed = this.datasets.get(datasetId);
    if (managed) {
      managed.status = status;
      managed.lastModified = Date.now();
      this.notify();
    }
  }

  /**
   * Rename dataset
   */
  public renameDataset(datasetId: string, newName: string): boolean {
    const managed = this.datasets.get(datasetId);
    if (!managed || !newName.trim()) return false;

    managed.name = newName.trim();
    managed.activeState.name = newName.trim();
    managed.lastModified = Date.now();
    this.notify();
    return true;
  }

  /**
   * Archive / Unarchive dataset
   */
  public toggleArchiveDataset(datasetId: string): boolean {
    const managed = this.datasets.get(datasetId);
    if (!managed) return false;

    managed.isArchived = !managed.isArchived;
    managed.status = managed.isArchived ? 'ARCHIVED' : 'READY';
    managed.lastModified = Date.now();
    this.notify();
    return true;
  }

  /**
   * Delete dataset safely
   */
  public deleteDataset(datasetId: string): boolean {
    const managed = this.datasets.get(datasetId);
    if (!managed) return false;

    this.datasets.delete(datasetId);
    globalCache.invalidateDataset(datasetId);

    if (this.activeDatasetId === datasetId) {
      const remaining = this.getAllDatasets().filter(d => !d.isArchived);
      this.activeDatasetId = remaining.length > 0 ? remaining[0].id : null;
    }

    this.notify();
    return true;
  }

  /**
   * Search datasets
   */
  public searchDatasets(query: string): ManagedDataset[] {
    const q = query.toLowerCase().trim();
    if (!q) return this.getAllDatasets();

    return this.getAllDatasets().filter(d =>
      d.name.toLowerCase().includes(q) ||
      d.fileName.toLowerCase().includes(q) ||
      d.fileType.toLowerCase().includes(q) ||
      d.status.toLowerCase().includes(q) ||
      d.tags.some(t => t.toLowerCase().includes(q))
    );
  }
}

export const globalDatasetEngine = new DatasetEngine();
