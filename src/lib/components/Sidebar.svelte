<script lang="ts">
  import { page } from '$app/stores';
  import { onboarding } from '$lib/stores/onboarding';

  interface NavItem {
    href: string;
    label: string;
  }

  const navItems: NavItem[] = [
    { href: '/observer', label: 'Observer' },
    { href: '/', label: 'Dashboard' },
    { href: '/blocks', label: 'Blocks' },
    { href: '/broadcast', label: 'Broadcast' },
    { href: '/console', label: 'Console' }
  ];

  function isActive(href: string, pathname: string): boolean {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  }

  function handleShowSetup() {
    onboarding.showAgain();
  }
</script>

<aside class="w-52 border-r border-echo-border">
  <nav class="flex flex-col py-8">
    {#each navItems as item}
      {@const active = isActive(item.href, $page.url.pathname)}
      <a
        href={item.href}
        class="relative px-6 py-3 font-mono text-sm uppercase tracking-wide transition-all duration-300
          {active ? 'text-echo-text' : 'text-echo-muted hover:text-echo-text hover:pl-7'}"
      >
        {#if active}
          <span class="absolute left-0 top-1/2 h-6 w-px -translate-y-1/2 bg-echo-text"></span>
        {/if}
        {item.label}
      </a>
    {/each}
  </nav>

  <!-- Footer -->
  <div class="absolute bottom-0 left-0 w-52 border-t border-echo-border px-6 py-4">
    <div class="flex items-center justify-between">
      <p class="font-mono text-xs text-echo-dim">v0.1.0</p>
      <button
        onclick={handleShowSetup}
        class="group text-echo-dim transition-colors duration-300 hover:text-echo-muted"
        title="Setup"
      >
        <svg class="h-4 w-4 transition-transform duration-300 group-hover:rotate-45" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>
    </div>
  </div>
</aside>
