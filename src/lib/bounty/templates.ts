export interface BountyTemplate {
	id: string;
	name: string;
	description: string;
	title: string;
	body: string;
	tags: string[];
}

export const bountyTemplates: BountyTemplate[] = [
	{
		id: 'bug-fix',
		name: 'Fix a bug',
		description: 'Describe a reproducible issue and what a good fix must prove.',
		title: 'Fix: [short bug summary]',
		body: `## Problem
[Describe what is broken in one or two paragraphs. Include who is affected and why it matters.]

## Steps to reproduce
1. [First step]
2. [Second step]
3. [What happens]

## Expected behavior
[Describe what should happen instead.]

## Actual behavior
[Describe the current result, error message, screenshot, log, or failing test.]

## Acceptance criteria
- [ ] The bug can be reproduced before the fix
- [ ] The reported behavior is fixed
- [ ] Relevant tests, screenshots, or verification notes are included
- [ ] No obvious regressions are introduced

## Useful context
- Affected page/component/file: [add path or link]
- Environment/browser/device: [add details]
- Related issue or discussion: [add link]`,
		tags: ['bug', 'fix']
	},
	{
		id: 'feature',
		name: 'Build a feature',
		description: 'Specify a small, shippable capability with clear acceptance criteria.',
		title: 'Build: [feature name]',
		body: `## Goal
[Describe the outcome users should have after this feature ships.]

## User story
As a [type of user], I want to [do something], so that [benefit].

## Scope
### In scope
- [Required behavior]
- [Required UI/API/workflow]

### Out of scope
- [Explicit non-goal]
- [Anything that should not be changed]

## Acceptance criteria
- [ ] User can complete the main flow: [describe flow]
- [ ] Edge case handled: [describe edge case]
- [ ] Existing behavior remains compatible
- [ ] Implementation follows project conventions

## References
- Mockup/example: [link]
- Related issue/spec: [link]
- Notes for implementer: [constraints, files, libraries, or preferences]`,
		tags: ['feature', 'build']
	},
	{
		id: 'docs',
		name: 'Write docs',
		description: 'Request a focused guide, README section, tutorial, or explanation.',
		title: 'Document: [topic]',
		body: `## Audience
[Who is this for? Example: first-time users, contributors, operators, developers.]

## Documentation goal
[What should the reader understand or be able to do after reading?]

## What to cover
- [Concept or workflow]
- [Setup/prerequisites]
- [Step-by-step instructions]
- [Examples or screenshots]
- [Troubleshooting notes]

## Source material
- Existing docs/code: [links or file paths]
- External references: [links]
- Product constraints: [anything the writer must preserve]

## Acceptance criteria
- [ ] Clear title and scannable sections
- [ ] Steps are accurate and easy to follow
- [ ] Examples are included where useful
- [ ] Any assumptions or limitations are stated`,
		tags: ['docs', 'writing']
	},
	{
		id: 'design',
		name: 'Design something',
		description: 'Ask for a visual, UX, brand, or interface deliverable.',
		title: 'Design: [asset or flow]',
		body: `## Design goal
[Describe what the design should communicate or help users do.]

## Target user/context
[Who will see this? Where will it appear? What are they trying to accomplish?]

## Deliverables
- [Mockup, asset, flow, icon, landing section, etc.]
- Format needed: [Figma, PNG, SVG, HTML/CSS, screenshots, etc.]
- Size/platform constraints: [desktop, mobile, social card, app screen, etc.]

## Style direction
- Tone: [minimal, playful, premium, technical, etc.]
- Must include: [brand elements, copy, UI states]
- Avoid: [colors, styles, layouts, or patterns not wanted]

## Acceptance criteria
- [ ] Design solves the stated goal
- [ ] Deliverables are provided in the requested format
- [ ] Important states or variants are covered
- [ ] Rationale or implementation notes are included`,
		tags: ['design', 'ux']
	},
	{
		id: 'research',
		name: 'Research question',
		description: 'Get a concise answer backed by sources and practical recommendations.',
		title: 'Research: [question]',
		body: `## Decision to support
[What decision will this research help make?]

## Core question
[State the main question clearly.]

## What to investigate
- [Primary source, spec, docs, market, or technical area]
- [Comparison or trade-off]
- [Risks, constraints, or edge cases]
- [Examples or prior art]

## Desired output
- Summary: [short answer, table, memo, recommendation, etc.]
- Sources: [minimum number/type of citations]
- Recommendation: [what kind of decision guidance is needed]

## Acceptance criteria
- [ ] Findings cite credible sources
- [ ] Recommendation is clear and actionable
- [ ] Unknowns, risks, and confidence level are called out
- [ ] The answer is concise enough to use directly`,
		tags: ['research', 'analysis']
	}
];

export function getBountyTemplate(id: string): BountyTemplate | undefined {
	return bountyTemplates.find((template) => template.id === id);
}
