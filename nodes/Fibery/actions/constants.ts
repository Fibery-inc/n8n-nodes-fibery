export const ControlTypes = {
	text: 'text',
	textArea: 'text-area',
	number: 'number',
	boolean: 'boolean',
	date: 'date',
	dateRange: 'date-range',
	select: 'select',
	multiSelect: 'multi-select',
	hidden: 'hidden',
} as const;

export type ControlType = (typeof ControlTypes)[keyof typeof ControlTypes];
