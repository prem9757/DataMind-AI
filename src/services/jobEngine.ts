import { BackgroundJob, JobStatus, JobTaskType } from '../types/production';

type JobListener = (jobs: BackgroundJob[]) => void;

class JobEngine {
  private jobs: Map<string, BackgroundJob> = new Map();
  private listeners: Set<JobListener> = new Set();
  private activeControllers: Map<string, AbortController> = new Map();

  /**
   * Subscribe to job updates
   */
  public subscribe(listener: JobListener): () => void {
    this.listeners.add(listener);
    listener(this.getAllJobs());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const list = this.getAllJobs();
    this.listeners.forEach(l => l(list));
  }

  public getAllJobs(): BackgroundJob[] {
    return Array.from(this.jobs.values()).sort((a, b) => b.startTime - a.startTime);
  }

  public getJob(id: string): BackgroundJob | undefined {
    return this.jobs.get(id);
  }

  /**
   * Create and register a background job
   */
  public createJob(
    title: string,
    taskType: JobTaskType,
    datasetId: string,
    datasetName: string,
    datasetVersion: number | string = 1
  ): BackgroundJob {
    const id = `job-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const job: BackgroundJob = {
      id,
      title,
      taskType,
      datasetId,
      datasetName,
      datasetVersion,
      status: 'QUEUED',
      progress: 0,
      currentStep: 'Job queued in background pipeline',
      startTime: Date.now(),
      retryCount: 0,
      maxRetries: 3
    };

    this.jobs.set(id, job);
    this.notify();
    return job;
  }

  /**
   * Run an asynchronous task with realistic progress steps
   */
  public async executeJob<T>(
    jobId: string,
    steps: {
      stepName: string;
      weightPercent: number;
      action: (signal: AbortSignal) => Promise<any> | any;
    }[]
  ): Promise<T> {
    const job = this.jobs.get(jobId);
    if (!job) throw new Error(`Job ${jobId} not found`);

    const abortController = new AbortController();
    this.activeControllers.set(jobId, abortController);

    job.status = 'RUNNING';
    job.progress = 5;
    job.currentStep = 'Initializing background task runner...';
    this.notify();

    let accumulatedProgress = 5;
    let finalResult: any = null;

    try {
      for (let i = 0; i < steps.length; i++) {
        if (abortController.signal.aborted) {
          throw new Error('Task was cancelled by user.');
        }

        const step = steps[i];
        job.currentStep = `Step ${i + 1}/${steps.length}: ${step.stepName}`;
        this.notify();

        // Small yield so browser UI and state updates render smoothly
        await new Promise(r => setTimeout(r, 60));

        if (abortController.signal.aborted) {
          throw new Error('Task was cancelled by user.');
        }

        finalResult = await step.action(abortController.signal);

        accumulatedProgress += step.weightPercent;
        job.progress = Math.min(98, Math.round(accumulatedProgress));
        this.notify();
      }

      job.status = 'COMPLETED';
      job.progress = 100;
      job.currentStep = 'Operation completed successfully';
      job.endTime = Date.now();
      job.durationMs = job.endTime - job.startTime;
      job.resultPayload = finalResult;
      this.activeControllers.delete(jobId);
      this.notify();

      return finalResult;
    } catch (err: any) {
      this.activeControllers.delete(jobId);

      if (abortController.signal.aborted || err.message?.includes('cancelled')) {
        job.status = 'CANCELLED';
        job.currentStep = 'Task execution cancelled';
        job.endTime = Date.now();
        job.durationMs = job.endTime - job.startTime;
        this.notify();
        throw err;
      } else {
        job.status = 'FAILED';
        job.errorInfo = err.message || 'Unknown task execution failure';
        job.currentStep = `Failed: ${job.errorInfo}`;
        job.endTime = Date.now();
        job.durationMs = job.endTime - job.startTime;
        this.notify();
        throw err;
      }
    }
  }

  /**
   * Request task cancellation
   */
  public cancelJob(jobId: string): boolean {
    const job = this.jobs.get(jobId);
    if (!job || (job.status !== 'RUNNING' && job.status !== 'QUEUED')) {
      return false;
    }

    job.cancelRequested = true;
    const controller = this.activeControllers.get(jobId);
    if (controller) {
      controller.abort();
      this.activeControllers.delete(jobId);
    }

    job.status = 'CANCELLED';
    job.currentStep = 'Job cancelled by user request';
    job.endTime = Date.now();
    job.durationMs = job.endTime - job.startTime;
    this.notify();
    return true;
  }

  /**
   * Retry a failed or cancelled job
   */
  public retryJob(jobId: string): boolean {
    const job = this.jobs.get(jobId);
    if (!job) return false;
    if (job.retryCount >= job.maxRetries) return false;

    job.retryCount++;
    job.status = 'QUEUED';
    job.progress = 0;
    job.currentStep = `Retrying job (Attempt ${job.retryCount}/${job.maxRetries})...`;
    job.startTime = Date.now();
    job.endTime = undefined;
    job.errorInfo = undefined;
    job.cancelRequested = false;
    this.notify();
    return true;
  }

  /**
   * Clear completed and cancelled jobs
   */
  public clearFinishedJobs(): void {
    for (const [id, job] of this.jobs.entries()) {
      if (job.status === 'COMPLETED' || job.status === 'CANCELLED') {
        this.jobs.delete(id);
      }
    }
    this.notify();
  }
}

export const globalJobEngine = new JobEngine();
