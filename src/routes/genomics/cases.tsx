import { createFileRoute } from '@tanstack/react-router'
import { CaseListScreen } from '../../screens/genomics/case-list-screen'

export const Route = createFileRoute('/genomics/cases')({
  component: CaseListScreen,
})
