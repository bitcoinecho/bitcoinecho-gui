<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    title?: string;
    children: Snippet;
    class?: string;
  }

  let { title, children, class: className = '' }: Props = $props();
</script>

<div class="rounded-lg border border-echo-border bg-echo-surface {className}">
  {#if title}
    <div class="border-b border-echo-border px-4 py-3">
      <h3 class="text-sm font-medium text-echo-text">{title}</h3>
    </div>
  {/if}
  <div class="p-4">
    {@render children()}
  </div>
</div>
