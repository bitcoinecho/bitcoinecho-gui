<script lang="ts">
  import { page } from '$app/stores';

  interface NavItem {
    href: string;
    label: string;
    icon: string;
  }

  const navItems: NavItem[] = [
    { href: '/', label: 'Dashboard', icon: 'dashboard' },
    { href: '/blocks', label: 'Blocks', icon: 'blocks' },
    { href: '/broadcast', label: 'Broadcast', icon: 'broadcast' },
    { href: '/console', label: 'Console', icon: 'console' }
  ];

  function isActive(href: string, pathname: string): boolean {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  }
</script>

<aside class="w-56 border-r border-echo-border bg-echo-bg">
  <nav class="flex flex-col gap-1 p-3">
    {#each navItems as item}
      {@const active = isActive(item.href, $page.url.pathname)}
      <a
        href={item.href}
        class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors
          {active
          ? 'bg-echo-surface text-btc-orange'
          : 'text-echo-muted hover:bg-echo-surface hover:text-echo-text'}"
      >
        <!-- Icons -->
        {#if item.icon === 'dashboard'}
          <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.5"
              d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z"
            ></path>
          </svg>
        {:else if item.icon === 'blocks'}
          <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.5"
              d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
            ></path>
          </svg>
        {:else if item.icon === 'broadcast'}
          <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.5"
              d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0"
            ></path>
          </svg>
        {:else if item.icon === 'console'}
          <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.5"
              d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            ></path>
          </svg>
        {/if}
        {item.label}
      </a>
    {/each}
  </nav>

  <!-- Footer -->
  <div class="absolute bottom-0 left-0 w-56 border-t border-echo-border p-3">
    <div class="text-xs text-echo-dim">
      <p>Bitcoin Echo GUI</p>
      <p class="mt-1">v0.1.0-dev</p>
    </div>
  </div>
</aside>
