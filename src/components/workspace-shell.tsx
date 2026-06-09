/**
 * WorkspaceShell — persistent layout wrapper.
 *
 * ┌──────────┬──────────────────────────┐
 * │ Sidebar  │  Content (Outlet)        │
 * │ (nav +   │  (sub-page or chat)      │
 * │ sessions)│                          │
 * └──────────┴──────────────────────────┘
 *
 * The sidebar is always visible. Routes render in the content area.
 * Chat routes get the full ChatScreen treatment.
 * Non-chat routes show the sub-page content.
 */
import {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { useNavigate, useRouterState } from '@tanstack/react-router'
import { fetchClaudeAuthStatus, type AuthStatus } from '@/lib/claude-auth'
import { cn } from '@/lib/utils'
import { ConnectionStartupScreen } from '@/components/connection-startup-screen'
import { ChatSidebar } from '@/screens/chat/components/chat-sidebar'
import { useChatSessions } from '@/screens/chat/hooks/use-chat-sessions'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { SIDEBAR_TOGGLE_EVENT } from '@/hooks/use-global-shortcuts'
import { ChatPanel } from '@/components/chat-panel'
import { ChatPanelToggle } from '@/components/chat-panel-toggle'
import { LoginScreen } from '@/components/auth/login-screen'
import { ClaudeReconnectBanner } from '@/components/claude-reconnect-banner'
import { SystemMetricsFooter } from '@/components/system-metrics-footer'
import { CommandPalette } from '@/components/command-palette'
import { useSettings } from '@/hooks/use-settings'
// ActivityTicker moved to dashboard-only (too noisy for global header)

const TerminalWorkspace = lazy(() =>
  import('@/components/terminal/terminal-workspace').then((m) => ({
    default: m.TerminalWorkspace,
  })),
)

export const DESKTOP_SIDEBAR_BACKDROP_CLASS =
  'fixed left-0 bottom-0 top-[var(--titlebar-h,0px)] w-[300px] z-10 bg-black/10 backdrop-blur-[1px]'

type WorkspaceShellProps = {
  children?: React.ReactNode
}

export function WorkspaceShell({ children }: WorkspaceShellProps) {
  const navigate = useNavigate()
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const search = useRouterState({
    select: (state) => state.location.search,
  })
  const isElectron = useMemo(
    () =>
      typeof navigator !== 'undefined' && /Electron/.test(navigator.userAgent),
    [],
  )

  const { settings } = useSettings()
  const sidebarCollapsed = useWorkspaceStore((s) => s.sidebarCollapsed)
  const chatFocusMode = useWorkspaceStore((s) => s.chatFocusMode)
  const toggleSidebar = useWorkspaceStore((s) => s.toggleSidebar)
  const setSidebarCollapsed = useWorkspaceStore((s) => s.setSidebarCollapsed)
  const [creatingSession, setCreatingSession] = useState(false)

  const isClient = typeof window !== 'undefined'
  // Both SSR and client start with the same value to avoid hydration mismatch.
  // The ConnectionStartupScreen overlay verifies the real status on mount.
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null)
  const [connectionVerified, setConnectionVerified] = useState(false)

  const authState = {
    checked: !isClient || connectionVerified,
    authenticated: authStatus?.authenticated ?? true,
    authRequired: authStatus?.authRequired ?? false,
  }

  const handleStartupConnected = useCallback((status: AuthStatus) => {
    setAuthStatus(status)
    setConnectionVerified(true)
  }, [])

  // Fallback startup verification in the shell itself.
  // This prevents a bad loading loop if the splash component gets stuck even
  // though /api/auth-check or /api/connection-status are already healthy.
  useEffect(() => {
    if (typeof window === 'undefined' || connectionVerified) return
    let cancelled = false

    const verify = async () => {
      try {
        const status = await fetchClaudeAuthStatus(3000)
        if (cancelled) return
        setAuthStatus(status)
        setConnectionVerified(true)
        return
      } catch {
        // Fall through to connection-status as a looser readiness signal.
      }

      try {
        const res = await fetch('/api/connection-status', { cache: 'no-store' })
        if (!res.ok || cancelled) return
        const data = (await res.json()) as {
          ok?: boolean
          chatReady?: boolean
          modelConfigured?: boolean
        }
        if (data?.ok || (data?.chatReady && data?.modelConfigured)) {
          setAuthStatus({ authenticated: true, authRequired: false })
          setConnectionVerified(true)
        }
      } catch {
        // Keep the startup screen if both checks fail.
      }
    }

    void verify()
    return () => {
      cancelled = true
    }
  }, [connectionVerified])

  const chatMatch = pathname.match(/^\/chat\/(.+)$/)
  const activeFriendlyId = chatMatch ? chatMatch[1] : 'main'
  const isOnChatRoute = Boolean(chatMatch) || pathname === '/new'
  const isOnTerminalRoute = pathname.startsWith('/terminal')
  const isOnPlaygroundRoute = pathname === '/playground' || pathname.startsWith('/playground/')
  const isOnHermesWorldLandingRoute = pathname === '/hermes-world' || pathname.startsWith('/hermes-world/') || pathname === '/world' || pathname.startsWith('/world/')
  const isEmbeddedSurface =
    search?.embed === '1' || search?.embed === 'true' || search?.mode === 'embed'
  const isChromeFreeSurface = isEmbeddedSurface || isOnHermesWorldLandingRoute
  const hideChatSidebar = isOnChatRoute && chatFocusMode
  const showDesktopSidebarBackdrop =
    !isChromeFreeSurface && !isOnChatRoute && !sidebarCollapsed

  const isNewChat = activeFriendlyId === 'new'

  // Sessions state — shared semantic source for sidebar and chat header
  const {
    sessions,
    sessionsLoading,
    sessionsFetching,
    sessionsError,
    refetchSessions,
  } = useChatSessions({
    activeFriendlyId,
    isNewChat,
  })

  const startNewChat = useCallback(() => {
    setCreatingSession(true)
    navigate({ to: '/chat/$sessionKey', params: { sessionKey: 'new' } }).then(
      () => {
        setCreatingSession(false)
      },
    )
  }, [navigate])

  const handleSelectSession = useCallback(() => {}, [])

  const handleActiveSessionDelete = useCallback(() => {
    navigate({ to: '/chat/$sessionKey', params: { sessionKey: 'main' } })
  }, [navigate])

  useEffect(() => {
    if (typeof document === 'undefined') return
    const titlebarHeight = isElectron ? '40px' : '0px'
    document.documentElement.style.setProperty('--titlebar-h', titlebarHeight)
    return () => {
      document.documentElement.style.removeProperty('--titlebar-h')
    }
  }, [isElectron])

  useEffect(() => {
    function handleToggleEvent() {
      toggleSidebar()
    }
    window.addEventListener(SIDEBAR_TOGGLE_EVENT, handleToggleEvent)
    return () =>
      window.removeEventListener(SIDEBAR_TOGGLE_EVENT, handleToggleEvent)
  }, [toggleSidebar])

  // Public/launch surfaces should behave like normal web pages, not app-shell panes.
  // This keeps /hermes-world and /world scrollable at the document level and avoids
  // local-only workspace chrome for X/GitHub traffic.
  if (isChromeFreeSurface) {
    return <>{children}</>
  }

  // Show login screen if auth is required and not authenticated
  if (authState.authRequired && !authState.authenticated) {
    return <LoginScreen />
  }

  const shellStyle: React.CSSProperties & Record<'--titlebar-h', string> = {
    height: 'var(--vvh, 100dvh)',
    paddingTop: isElectron ? 40 : 0,
    '--titlebar-h': isElectron ? '40px' : '0px',
  }

  return (
    <>
      <div
        className="relative overflow-hidden theme-bg theme-text"
        style={shellStyle}
      >
        <ClaudeReconnectBanner enabled={authState.checked} />
        {/* Electron: native-style title bar (absolute over the padding) */}
        {isElectron && (
          <div
            className="absolute inset-x-0 top-0 flex h-10 items-center border-b border-primary-200 z-40"
            style={
              {
                WebkitAppRegion: 'drag',
                background: 'var(--theme-sidebar)',
              } as React.CSSProperties
            }
          >
            {/* Traffic light spacer (left ~78px for macOS buttons) */}
            <div className="w-[78px] shrink-0" />
            {/* Centered title */}
            <div className="flex-1 text-center">
              <span
                className="text-[13px] font-medium select-none"
                style={{ color: 'var(--theme-accent, #B98A44)' }}
              >
                Hermes
              </span>
            </div>
            {/* Right spacer to balance */}
            <div className="w-[78px] shrink-0" />
          </div>
        )}
        <div
          className={cn(
            'grid h-full grid-rows-[minmax(0,1fr)] overflow-hidden',
            hideChatSidebar ? 'grid-cols-1' : 'grid-cols-[auto_1fr]',
          )}
        >
          {!hideChatSidebar && (
            <div className="relative z-30">
              <ChatSidebar
                sessions={sessions}
                activeFriendlyId={activeFriendlyId}
                creatingSession={creatingSession}
                onCreateSession={startNewChat}
                isCollapsed={sidebarCollapsed}
                onToggleCollapse={toggleSidebar}
                onSelectSession={handleSelectSession}
                onActiveSessionDelete={handleActiveSessionDelete}
                sessionsLoading={sessionsLoading}
                sessionsFetching={sessionsFetching}
                sessionsError={sessionsError}
                onRetrySessions={refetchSessions}
              />
            </div>
          )}

          <main
            className={[
              'h-full min-h-0 min-w-0 overflow-x-hidden bg-(--theme-bg) relative',
              isOnChatRoute ? 'overflow-hidden' : 'overflow-y-auto',
              !isOnChatRoute && settings.showSystemMetricsFooter ? 'pb-7' : '',
            ].join(' ')}
            data-tour="chat-area"
          >
            <div
              className="flex flex-col"
              style={{
                position: 'absolute',
                inset: 0,
                visibility: isOnTerminalRoute ? 'visible' : 'hidden',
                pointerEvents: isOnTerminalRoute ? 'auto' : 'none',
                zIndex: isOnTerminalRoute ? 1 : -1,
              }}
            >
              <div className="flex-1 min-h-0 overflow-hidden">
                <Suspense fallback={null}>
                  <TerminalWorkspace
                    mode="fullscreen"
                    panelVisible={isOnTerminalRoute}
                  />
                </Suspense>
              </div>
            </div>

            <div
              className={[
                'page-transition flex flex-col',
                isChromeFreeSurface ? 'min-h-full' : 'h-full',
                isOnTerminalRoute ? 'hidden' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {children}
            </div>
          </main>

          {!isOnChatRoute && !isOnPlaygroundRoute && !isChromeFreeSurface && <ChatPanel />}
        </div>

        {!isChromeFreeSurface && !isOnChatRoute && !isOnPlaygroundRoute && <ChatPanelToggle />}

        {showDesktopSidebarBackdrop ? (
          <button
            type="button"
            aria-label="Collapse navigation sidebar"
            onClick={() => setSidebarCollapsed(true)}
            className={DESKTOP_SIDEBAR_BACKDROP_CLASS}
          />
        ) : null}

        {!authState.checked ? (
          <ConnectionStartupScreen onConnected={handleStartupConnected} />
        ) : null}
      </div>

      {!isChromeFreeSurface && !isOnChatRoute && settings.showSystemMetricsFooter ? (
        <SystemMetricsFooter leftOffsetPx={sidebarCollapsed ? 48 : 300} />
      ) : null}
      {!isChromeFreeSurface ? <CommandPalette pathname={pathname} sessions={sessions} /> : null}
    </>
  )
}
