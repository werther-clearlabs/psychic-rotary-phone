import { createFileRoute } from '@tanstack/react-router'
import { GenomicsDashboard } from '../../screens/genomics/dashboard-screen'

export const Route = createFileRoute('/genomics/')({
  component: GenomicsDashboard,
})
