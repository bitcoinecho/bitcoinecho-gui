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
    'inline-flex items-center justify-center font-mono text-xs uppercase tracking-wide transition-all duration-300 focus:outline-none disabled:opacity-50 disabled:pointer-events-none';

  const variants = {
    primary: 'border border-echo-border bg-transparent text-echo-text hover:border-echo-accent hover:text-echo-accent',
    secondary: 'border border-echo-border text-echo-muted hover:border-echo-dim hover:text-echo-text',
    ghost: 'text-echo-muted hover:text-echo-text'
  };

  const sizes = {
    sm: 'px-4 py-2',
    md: 'px-5 py-2.5',
    lg: 'px-6 py-3'
  };
</script>

<button class="{baseStyles} {variants[variant]} {sizes[size]} {className}" {...rest}>
  {@render children()}
</button>
