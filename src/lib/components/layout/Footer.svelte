<script lang="ts">
	import { config } from '$lib/config';
</script>

<footer class="hidden border-t border-border bg-card sm:block">
	<div class="mx-auto max-w-6xl px-4 py-3">
		<div class="flex items-center justify-between">
			<a
				href={config.links.github}
				target="_blank"
				rel="noopener noreferrer"
				class="text-xs text-muted-foreground transition-colors hover:text-primary hover:cursor-pointer"
			>
				{config.app.name}
			</a>
		</div>
	</div>
</footer>
