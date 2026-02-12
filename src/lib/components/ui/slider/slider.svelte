<script lang="ts">
	import { Slider as SliderPrimitive } from "bits-ui";
	import { cn } from "$lib/utils.js";

	// bits-ui Slider uses a discriminated union (single vs multiple) that
	// conflicts with Svelte 5 bindable destructuring. Use simplified props.
	let {
		ref = $bindable(null),
		value = $bindable(0),
		orientation = "horizontal",
		max = 100,
		min = 0,
		step = 1,
		disabled = false,
		class: className,
		...restProps
	}: {
		ref?: HTMLElement | null;
		value?: number;
		orientation?: "horizontal" | "vertical";
		max?: number;
		min?: number;
		step?: number;
		disabled?: boolean;
		class?: string;
		'aria-label'?: string;
		[key: string]: unknown;
	} = $props();
</script>

<SliderPrimitive.Root
	bind:ref
	bind:value={value as never}
	type="single"
	data-slot="slider"
	{orientation}
	{max}
	{min}
	{step}
	{disabled}
	class={cn(
		"relative flex w-full touch-none items-center select-none data-[disabled]:opacity-50 data-[orientation=vertical]:h-full data-[orientation=vertical]:min-h-44 data-[orientation=vertical]:w-auto data-[orientation=vertical]:flex-col",
		className
	)}
	{...restProps}
>
	{#snippet children({ thumbs })}
		<span
			data-orientation={orientation}
			data-slot="slider-track"
			class={cn(
				"bg-muted relative grow overflow-hidden rounded-full data-[orientation=horizontal]:h-1.5 data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-1.5"
			)}
		>
			<SliderPrimitive.Range
				data-slot="slider-range"
				class={cn(
					"bg-primary absolute data-[orientation=horizontal]:h-full data-[orientation=vertical]:w-full"
				)}
			/>
		</span>
		{#each thumbs as thumb (thumb)}
			<SliderPrimitive.Thumb
				data-slot="slider-thumb"
				index={thumb}
				class="border-primary ring-ring/50 block size-4 shrink-0 rounded-full border bg-white shadow-sm transition-[color,box-shadow] hover:ring-4 focus-visible:ring-4 focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50"
			/>
		{/each}
	{/snippet}
</SliderPrimitive.Root>
