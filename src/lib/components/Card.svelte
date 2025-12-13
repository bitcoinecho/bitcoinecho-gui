<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    title?: string;
    children: Snippet;
    class?: string;
  }

  let { title, children, class: className = '' }: Props = $props();
</script>

<div class="bg-echo-elevated/50 {className}">
  {#if title}
    <div class="mb-4">
      <h3 class="font-mono text-xs uppercase tracking-wider text-echo-dim">{title}</h3>
    </div>
  {/if}
  <div>
    {@render children()}
  </div>
</div>
