import { createFileRoute } from '@tanstack/react-router'
import { RunDetailScreen } from '../../screens/genomics/run-detail-screen'
export const Route = createFileRoute('/genomics/runs/$runId')({
  component: RunDetailScreen,
})
