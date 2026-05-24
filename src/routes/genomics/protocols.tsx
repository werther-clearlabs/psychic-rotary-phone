import { createFileRoute } from '@tanstack/react-router'
import { ProtocolListScreen } from '../../screens/genomics/protocol-list-screen'

export const Route = createFileRoute('/genomics/protocols')({
  component: ProtocolListScreen,
})
