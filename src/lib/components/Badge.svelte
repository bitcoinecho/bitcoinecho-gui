<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
    children: Snippet;
    class?: string;
  }

  let { variant = 'default', children, class: className = '' }: Props = $props();

  const variants = {
    default: 'bg-echo-elevated text-echo-muted border-echo-border',
    success: 'bg-green-900/30 text-green-400 border-green-800',
    warning: 'bg-yellow-900/30 text-yellow-400 border-yellow-800',
    error: 'bg-red-900/30 text-red-400 border-red-800',
    info: 'bg-blue-900/30 text-blue-400 border-blue-800'
  };
</script>

<span
  class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium {variants[
    variant
  ]} {className}"
>
  {@render children()}
</span>
