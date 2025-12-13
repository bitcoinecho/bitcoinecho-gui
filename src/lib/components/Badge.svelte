<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
    children: Snippet;
    class?: string;
  }

  let { variant = 'default', children, class: className = '' }: Props = $props();

  // Muted, refined variants - no saturated colors
  const variants = {
    default: 'text-echo-muted',
    success: 'text-echo-muted',
    warning: 'text-echo-muted',
    error: 'text-echo-muted',
    info: 'text-echo-muted'
  };
</script>

<span
  class="inline-flex items-center font-mono text-xs uppercase tracking-wide {variants[variant]} {className}"
>
  {@render children()}
</span>
