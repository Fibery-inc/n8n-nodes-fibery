import moment from 'moment-timezone';
import { ControlType, ControlTypes } from '../constants';

export const operators = {
	is: 'is',
	is_not: 'is_not',
	contains: 'contains',
	does_not_contain: 'does_not_contain',
	starts_with: 'starts_with',
	ends_with: 'ends_with',
	is_empty: 'is_empty',
	is_not_empty: 'is_not_empty',
	greater_than: 'greater_than',
	less_than: 'less_than',
	greater_than_or_equal: 'greater_than_or_equal',
	less_than_or_equal: 'less_than_or_equal',
	is_before: 'is_before',
	is_after: 'is_after',
	is_on_or_before: 'is_on_or_before',
	is_on_or_after: 'is_on_or_after',
	today: 'today',
	yesterday: 'yesterday',
	tomorrow: 'tomorrow',
	this_week: 'this_week',
	last_week: 'last_week',
	this_month: 'this_month',
	last_month: 'last_month',
} as const;
export type Operator = (typeof operators)[keyof typeof operators];

export const operatorsPerControl = {
	[ControlTypes.text]: [
		operators.contains,
		operators.does_not_contain,
		operators.is,
		operators.is_not,
		operators.starts_with,
		operators.ends_with,
		operators.is_empty,
		operators.is_not_empty,
	],
	[ControlTypes.number]: [
		operators.is,
		operators.is_not,
		operators.greater_than,
		operators.less_than,
		operators.greater_than_or_equal,
		operators.less_than_or_equal,
		operators.is_empty,
		operators.is_not_empty,
	],
	[ControlTypes.boolean]: [operators.is],
	[ControlTypes.date]: [
		operators.is,
		operators.is_before,
		operators.is_after,
		operators.is_on_or_before,
		operators.is_on_or_after,
		// operators.today,
		// operators.yesterday,
		// operators.tomorrow,
		// operators.this_week,
		// operators.last_week,
		// operators.this_month,
		// operators.last_month,
		operators.is_empty,
		operators.is_not_empty,
	],
	[ControlTypes.select]: [
		operators.is,
		operators.is_not,
		operators.is_empty,
		operators.is_not_empty,
	],
	[ControlTypes.multiSelect]: [
		operators.contains,
		operators.does_not_contain,
		operators.is_empty,
		operators.is_not_empty,
	],
	[ControlTypes.file]: [operators.is_empty, operators.is_not_empty],
};

const wrapDateRange = (field: string, datePart?: 'q/start' | 'q/end') =>
	datePart ? [datePart, [field]] : [field];

export const operatorToCommand: {
	[key in ControlType]?: {
		[key in Operator]?: (
			field: string,
			param: string,
			opts: { timezone: string; datePart?: 'q/start' | 'q/end'; value: unknown },
		) => [condition: Array<unknown>, constant?: unknown];
	};
} = {
	text: {
		contains: (field, param) => [[`q/contains`, [field], param]],
		does_not_contain: (field, param) => [[`q/does_not_contain`, [field], param]],
		is: (field, param) => [[`q/equals-ignoring-case?`, [field], param]],
		is_not: (field, param) => [[`q/not-equals-ignoring-case?`, [field], param]],
		starts_with: (field, param) => [[`q/starts-with-ignoring-case?`, [field], param]],
		ends_with: (field, param) => [[`q/ends-with-ignoring-case?`, [field], param]],
		is_empty: (field, param) => [['=', [`q/null-or-empty?`, [field]], param], true],
		is_not_empty: (field, param) => [['=', [`q/null-or-empty?`, [field]], param], false],
	},
	number: {
		is: (field, param) => [['=', [field], param]],
		is_not: (field, param) => [['!=', [field], param]],
		greater_than: (field, param) => [['>', [field], param]],
		less_than: (field, param) => [['<', [field], param]],
		greater_than_or_equal: (field, param) => [['>=', [field], param]],
		less_than_or_equal: (field, param) => [['<=', [field], param]],
		is_empty: (field, param) => [['=', [`q/null-or-empty?`, [field]], param], true],
		is_not_empty: (field, param) => [['=', [`q/null-or-empty?`, [field]], param], false],
	},
	boolean: {
		is: (field, param) => [['=', [field], param]],
	},
	date: {
		is: (field, param, { datePart, value }) => [
			['=', wrapDateRange(field, datePart), param],
			moment.tz(value as string).toISOString(),
		],
		is_before: (field, param, { datePart, value }) => [
			['<', wrapDateRange(field, datePart), param],
			moment.tz(value as string).toISOString(),
		],
		is_after: (field, param, { datePart, value }) => [
			['>', wrapDateRange(field, datePart), param],
			moment.tz(value as string).toISOString(),
		],
		is_on_or_before: (field, param, { datePart, value }) => [
			['<=', wrapDateRange(field, datePart), param],
			moment.tz(value as string).toISOString(),
		],
		is_on_or_after: (field, param, { datePart, value }) => [
			['>=', wrapDateRange(field, datePart), param],
			moment.tz(value as string).toISOString(),
		],
		// today: (field, param, {timezone}) => [['=', field, param], moment.tz(timezone).format('YYYY-MM-DD')],
		// yesterday: (field, param, {timezone}) => [['=', field, param], moment.tz(timezone).format('YYYY-MM-DD')],
		// tomorrow: (field, param, {timezone}) => [['=', field, param], moment.tz(timezone).format('YYYY-MM-DD')],
		// this_week: (field, param, {timezone}) => [['=', field, param], moment.tz(timezone).format('YYYY-MM-DD')],
		// last_week: (field, param, {timezone}) => [['=', field, param], moment.tz(timezone).format('YYYY-MM-DD')],
		// this_month: (field, param, {timezone}) => [['=', field, param], moment.tz(timezone).format('YYYY-MM-DD')],
		// last_month: (field, param, {timezone}) => [['=', field, param], moment.tz(timezone).format('YYYY-MM-DD')],
		is_empty: (field, param, { datePart }) => [
			['=', [`q/null?`, wrapDateRange(field, datePart)], param],
			true,
		],
		is_not_empty: (field, param, { datePart }) => [
			['=', [`q/null?`, wrapDateRange(field, datePart)], param],
			false,
		],
	},
	select: {
		is: (field, param) => [['=', [field, 'fibery/id'], param]],
		is_not: (field, param) => [['=', [field, 'fibery/id'], param]],
		is_empty: (field, param) => [['=', [field, 'fibery/id'], param], null],
		is_not_empty: (field, param) => [['!=', [field, 'fibery/id'], param], null],
	},
	'multi-select': {
		contains: (field, param) => [[`q/in`, [field, 'fibery/id'], param]],
		does_not_contain: (field, param) => [[`q/not-in`, [field, 'fibery/id'], param]],
		is_empty: (field, param) => [['=', [`q/null-or-empty?`, field], param], true],
		is_not_empty: (field, param) => [['=', [`q/null-or-empty?`, field], param], false],
	},
};
