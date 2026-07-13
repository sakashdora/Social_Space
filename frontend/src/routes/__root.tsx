import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { AppNav } from "../components/veil/AppNav";
import { ThemeProvider } from "../lib/theme";
import { ThemeToggle } from "../components/veil/ThemeToggle";
import { cn } from "../lib/utils";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-ink px-4">
      <div className="max-w-md text-center">
        <p className="font-serif text-7xl">404</p>
        <h2 className="mt-4 text-lg font-medium">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you&rsquo;re looking for doesn&rsquo;t exist, or was never
          here to begin with.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-full bg-[color:var(--primary)] px-5 py-2 text-sm font-medium text-primary-foreground transition hover:brightness-110"
          >
            Return home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink px-4">
      <div className="max-w-md text-center">
        <h1 className="text-lg font-semibold tracking-tight">
          Something didn&rsquo;t load.
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Nothing was sent anywhere. Try again, or head home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-full bg-[color:var(--veil)] px-5 py-2 text-sm font-medium text-primary-foreground transition hover:brightness-110"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-full px-5 py-2 text-sm font-medium text-foreground transition"
            style={{
              border: "1px solid var(--surface-border)",
              background: "var(--surface-bg)",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.opacity = "0.8";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.opacity = "1";
            }}
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()(
  {
    head: () => ({
      meta: [
        { charSet: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        { name: "theme-color", content: "#212121" },
        { title: "Social Space — Discover, Share, Connect" },
        {
          name: "description",
          content:
            "A premium social space to share news, articles, photos, and videos. Sign up frictionlessly without an email or phone number.",
        },
        { name: "author", content: "Social Space" },
        {
          property: "og:title",
          content: "Social Space — Discover, Share, Connect",
        },
        {
          property: "og:description",
          content:
            "Share your stories, read the latest news, and engage with the community.",
        },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
      links: [
        { rel: "stylesheet", href: appCss },
        { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
      ],
    }),
    shellComponent: RootShell,
    component: RootComponent,
    notFoundComponent: NotFoundComponent,
    errorComponent: ErrorComponent,
  },
);

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <HeadContent />
        <script
          dangerouslySetInnerHTML={{
            __html: `
          (function() {
            try {
              var stored = localStorage.getItem('veil-theme');
              var theme = stored;
              if (!theme) {
                theme = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
              }
              document.documentElement.classList.remove('dark', 'light');
              document.documentElement.classList.add(theme);
              document.documentElement.style.colorScheme = theme;
            } catch (e) {}
          })();
        `,
          }}
        />
      </head>
      <body className="veil-grain bg-ink text-foreground antialiased">
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // Landing page uses full-bleed layout without the app chrome.
  const chrome = pathname !== "/" && pathname !== "/onboarding";

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <div className="relative min-h-screen">
          {/* Ambient background wash — adapts to both themes */}
          <div
            aria-hidden
            className="pointer-events-none fixed inset-0 -z-10"
            style={{
              background:
                "radial-gradient(1400px 900px at 12% -10%, color-mix(in oklab, var(--veil) 12%, transparent), transparent 65%), radial-gradient(900px 700px at 108% 108%, color-mix(in oklab, var(--veil-glow) 6%, transparent), transparent 60%), var(--ink)",
            }}
          />

          {chrome && <AppNav />}
          {chrome && (
            <header
              className="fixed top-0 inset-x-0 z-40 flex h-14 sm:h-16 items-center justify-between border-b px-4 sm:px-6 backdrop-blur-xl lg:hidden"
              style={{
                background: "var(--nav-bg)",
                borderColor: "var(--nav-border)",
              }}
            >
              <Link to="/" className="flex items-center gap-2.5">
                <span className="font-serif text-xl tracking-tight text-foreground">
                  Social Space
                </span>
              </Link>
              <ThemeToggle />
            </header>
          )}

          <main
            key={pathname}
            className={cn(
              chrome && "lg:pl-60 pt-16 lg:pt-0",
              chrome && pathname.startsWith("/messages")
                ? "h-dvh overflow-hidden flex flex-col"
                : "min-h-dvh",
              "[animation:veil-reveal_860ms_cubic-bezier(0.22,1,0.36,1)_both]",
            )}
          >
            <Outlet />
          </main>
        </div>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
