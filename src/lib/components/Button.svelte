<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLButtonAttributes } from 'svelte/elements';

  interface Props extends HTMLButtonAttributes {
    variant?: 'primary' | 'secondary' | 'ghost';
    size?: 'sm' | 'md' | 'lg';
    children: Snippet;
  }

  let { variant = 'primary', size = 'md', children, class: className = '', ...rest }: Props =
    $props();

  const baseStyles =
    'inline-flex items-center justify-center font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-btc-orange focus:ring-offset-2 focus:ring-offset-echo-bg disabled:opacity-50 disabled:pointer-events-none';

  const variants = {
    primary: 'bg-btc-orange text-echo-bg hover:bg-btc-orange-light',
    secondary: 'bg-echo-surface text-echo-text border border-echo-border hover:bg-echo-elevated',
    ghost: 'text-echo-muted hover:text-echo-text hover:bg-echo-surface'
  };

  const sizes = {
    sm: 'h-8 px-3 text-sm rounded',
    md: 'h-10 px-4 text-sm rounded-md',
    lg: 'h-12 px-6 text-base rounded-lg'
  };
</script>

<button class="{baseStyles} {variants[variant]} {sizes[size]} {className}" {...rest}>
  {@render children()}
</button>
