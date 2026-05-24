import { createFileRoute } from '@tanstack/react-router'
import { ProtocolDetailScreen } from '../../screens/genomics/protocol-detail-screen'

export const Route = createFileRoute('/genomics/protocols/$protocolId')({
  component: ProtocolDetailScreen,
})
