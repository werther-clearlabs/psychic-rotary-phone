import { createFileRoute } from '@tanstack/react-router'
import { RunListScreen } from '../../screens/genomics/run-list-screen'
export const Route = createFileRoute('/genomics/runs')({
  component: RunListScreen,
})
