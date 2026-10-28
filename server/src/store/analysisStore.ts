import { AnalysisRecord } from '../scanner/types';

class AnalysisStore {
  private analyses = new Map<string, AnalysisRecord>();

  save(record: AnalysisRecord): void {
    this.analyses.set(record.id, record);
  }

  get(id: string): AnalysisRecord | undefined {
    return this.analyses.get(id);
  }

  has(id: string): boolean {
    return this.analyses.has(id);
  }

  getAll(): AnalysisRecord[] {
    return Array.from(this.analyses.values());
  }

  delete(id: string): boolean {
    return this.analyses.delete(id);
  }

  clear(): void {
    this.analyses.clear();
  }
}

export const analysisStore = new AnalysisStore();
