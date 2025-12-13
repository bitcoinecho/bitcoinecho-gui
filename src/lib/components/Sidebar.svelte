<script lang="ts">
  import { page } from '$app/stores';

  interface NavItem {
    href: string;
    label: string;
  }

  const navItems: NavItem[] = [
    { href: '/', label: 'Dashboard' },
    { href: '/blocks', label: 'Blocks' },
    { href: '/broadcast', label: 'Broadcast' },
    { href: '/console', label: 'Console' }
  ];

  function isActive(href: string, pathname: string): boolean {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
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
  <div class="absolute bottom-0 left-0 w-52 border-t border-echo-border px-6 py-5">
    <p class="font-mono text-xs text-echo-dim">v0.1.0</p>
  </div>
</aside>
