import { createFileRoute, Outlet } from '@tanstack/react-router'
import tokensCss from '../styles/genomics/tokens.css?url'

export const Route = createFileRoute('/genomics')({
  head: () => ({
    links: [{ rel: 'stylesheet', href: tokensCss }],
  }),
  component: function GenomicsLayout() {
    return (
      <div className="cl-page">
        <Outlet />
      </div>
    )
  },
})
