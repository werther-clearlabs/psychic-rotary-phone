import { create } from 'zustand'
import type { Case, Run, Report } from '../server/genomics/types'

interface GenomicsState {
  // Active entities (set when detail screens mount)
  activeCase: Case | null
  activeRun: Run | null
  activeReport: Report | null

  // Live run log lines keyed by runId
  runLogs: Record<string, string[]>

  // Report section currently being edited (section key e.g. "8")
  editingSection: string | null

  // Generate report modal state
  generateModalOpen: boolean
  generateProtocolId: string | null
  generateVariableOverrides: Record<string, string>

  // Cases where report generation has been dispatched and is in progress
  reportGeneratingCases: Record<string, boolean>

  // Actions
  setActiveCase: (c: Case | null) => void
  setActiveRun: (r: Run | null) => void
  setActiveReport: (r: Report | null) => void
  appendRunLog: (runId: string, line: string) => void
  clearRunLog: (runId: string) => void
  setEditingSection: (key: string | null) => void
  openGenerateModal: (protocolId?: string) => void
  closeGenerateModal: () => void
  setGenerateProtocolId: (id: string) => void
  setVariableOverride: (name: string, value: string) => void
  resetVariableOverrides: () => void
  markReportGenerating: (caseId: string) => void
  clearReportGenerating: (caseId: string) => void
}

export const useGenomicsStore = create<GenomicsState>()((set) => ({
  activeCase: null,
  activeRun: null,
  activeReport: null,
  runLogs: {},
  editingSection: null,
  generateModalOpen: false,
  generateProtocolId: null,
  generateVariableOverrides: {},
  reportGeneratingCases: {},

  setActiveCase: (c) => set({ activeCase: c }),
  setActiveRun: (r) => set({ activeRun: r }),
  setActiveReport: (r) => set({ activeReport: r }),
  appendRunLog: (runId, line) =>
    set((s) => ({
      runLogs: { ...s.runLogs, [runId]: [...(s.runLogs[runId] ?? []), line] },
    })),
  clearRunLog: (runId) =>
    set((s) => ({ runLogs: { ...s.runLogs, [runId]: [] } })),
  setEditingSection: (key) => set({ editingSection: key }),
  openGenerateModal: (protocolId) =>
    set({
      generateModalOpen: true,
      generateProtocolId: protocolId ?? null,
      generateVariableOverrides: {},
    }),
  closeGenerateModal: () =>
    set({
      generateModalOpen: false,
      generateProtocolId: null,
      generateVariableOverrides: {},
    }),
  setGenerateProtocolId: (id) => set({ generateProtocolId: id }),
  setVariableOverride: (name, value) =>
    set((s) => ({
      generateVariableOverrides: {
        ...s.generateVariableOverrides,
        [name]: value,
      },
    })),
  resetVariableOverrides: () => set({ generateVariableOverrides: {} }),
  markReportGenerating: (caseId) =>
    set((s) => ({ reportGeneratingCases: { ...s.reportGeneratingCases, [caseId]: true } })),
  clearReportGenerating: (caseId) =>
    set((s) => {
      const next = { ...s.reportGeneratingCases }
      delete next[caseId]
      return { reportGeneratingCases: next }
    }),
}))
