import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  ssr: false,
  beforeLoad: function redirectToGenomics() {
    throw redirect({ to: '/genomics', replace: true })
  },
  component: function IndexRoute() {
    return null
  },
})
