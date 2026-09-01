import { SavedAnalysis, SavedAIQuestion } from '../types/production';

const STORAGE_KEYS = {
  SESSION: 'daa_app_session_v7',
  SAVED_ANALYSES: 'daa_saved_analyses_v7',
  SAVED_QUESTIONS: 'daa_saved_questions_v7',
  SETTINGS: 'daa_app_settings_v7',
  PIPELINE_STATE: 'daa_pipeline_state_v1'
};

export interface PipelineState {
  currentStage: string;
  completedStages: string[];
  activeDatasetId?: string;
  activeDatasetVersion?: number;
  qualityStatus?: string;
  cleaningStatus?: string;
  edaStatus?: string;
  visualizationStatus?: string;
  dashboardStatus?: string;
}

export interface AppSettings {
  theme: 'dark' | 'light';
  largeDatasetSamplingThreshold: number; // default 50000
  enableIntelligentSampling: boolean;
  maxMemoryThresholdMB: number;
  aiModelPreference: string;
  enableDeterministicCache: boolean;
  maxConcurrentJobs: number;
  autoSaveSession: boolean;
}

export const DEFAULT_PIPELINE_STATE: PipelineState = {
  currentStage: 'dataset_hub',
  completedStages: ['upload']
};

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  largeDatasetSamplingThreshold: 50000,
  enableIntelligentSampling: true,
  maxMemoryThresholdMB: 512,
  aiModelPreference: 'gemini-2.5-flash',
  enableDeterministicCache: true,
  maxConcurrentJobs: 3,
  autoSaveSession: true
};

export class SessionManager {
  public static savePipelineState(state: PipelineState): void {
    try {
      localStorage.setItem(STORAGE_KEYS.PIPELINE_STATE, JSON.stringify(state));
    } catch (e) {
      console.warn('Failed to save pipeline state:', e);
    }
  }

  public static loadPipelineState(): PipelineState {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.PIPELINE_STATE);
      if (stored) {
        return { ...DEFAULT_PIPELINE_STATE, ...JSON.parse(stored) };
      }
    } catch (e) {
      console.warn('Failed to load pipeline state:', e);
    }
    return { ...DEFAULT_PIPELINE_STATE };
  }

  public static saveSettings(settings: AppSettings): void {
    try {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    } catch (e) {
      console.warn('Failed to save settings to localStorage:', e);
    }
  }

  public static loadSettings(): AppSettings {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (stored) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
      }
    } catch (e) {
      console.warn('Failed to load settings:', e);
    }
    return { ...DEFAULT_SETTINGS };
  }

  public static saveAnalyses(analyses: SavedAnalysis[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.SAVED_ANALYSES, JSON.stringify(analyses));
    } catch (e) {
      console.warn('Failed to save analyses:', e);
    }
  }

  public static loadAnalyses(): SavedAnalysis[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.SAVED_ANALYSES);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Failed to load analyses:', e);
    }
    return [
      {
        id: 'analysis-sample-1',
        title: 'Regional Revenue vs Margin Efficiency',
        description: 'Bivariate segment aggregation showing top contributing regions',
        datasetId: 'default',
        datasetName: 'Customer Orders',
        datasetVersion: 'v1.0',
        type: 'chart',
        resultSummary: 'North region leads gross revenue with 38.4% total share and 24.2% operating margin.',
        createdAt: Date.now() - 3600000 * 24,
        tags: ['Revenue', 'Regional', 'Executive']
      },
      {
        id: 'analysis-sample-2',
        title: 'Customer Churn Prediction Model (Random Forest)',
        description: 'Supervised classification achieving 89.2% accuracy and 0.88 AUC-ROC',
        datasetId: 'default',
        datasetName: 'Customer Orders',
        datasetVersion: 'v1.0',
        type: 'ml_model',
        resultSummary: 'Identified contract length and support ticket frequency as top two feature drivers.',
        createdAt: Date.now() - 3600000 * 12,
        tags: ['Machine Learning', 'Classification', 'Retention']
      }
    ];
  }

  public static saveQuestions(questions: SavedAIQuestion[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.SAVED_QUESTIONS, JSON.stringify(questions));
    } catch (e) {
      console.warn('Failed to save AI questions:', e);
    }
  }

  public static loadQuestions(): SavedAIQuestion[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.SAVED_QUESTIONS);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Failed to load AI questions:', e);
    }
    return [
      {
        id: 'q-1',
        question: 'Which region generated the highest revenue and profit margin?',
        datasetId: 'default',
        datasetVersion: 'v1.0',
        category: 'Ranking & Segmentation',
        lastRunAt: Date.now() - 7200000,
        runCount: 5,
        favorite: true
      },
      {
        id: 'q-2',
        question: 'Is there a statistically significant correlation between discount rate and churn?',
        datasetId: 'default',
        datasetVersion: 'v1.0',
        category: 'Statistical Significance',
        lastRunAt: Date.now() - 14400000,
        runCount: 3,
        favorite: true
      },
      {
        id: 'q-3',
        question: 'Train a regression model to forecast delivery time based on shipping distance',
        datasetId: 'default',
        datasetVersion: 'v1.0',
        category: 'Predictive Modeling',
        lastRunAt: Date.now() - 28800000,
        runCount: 2,
        favorite: false
      }
    ];
  }
}
