import { createFileRoute } from '@tanstack/react-router'
import { CaseDetailScreen } from '../../screens/genomics/case-detail-screen'

export const Route = createFileRoute('/genomics/cases_/$caseId')({
  component: CaseDetailScreen,
})
