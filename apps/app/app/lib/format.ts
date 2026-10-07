import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime.js'

dayjs.extend(relativeTime)

export function initials(name: string) {
	return name
		.split(/\s+/)
		.map((word) => word[0])
		.join('')
		.slice(0, 2)
		.toUpperCase()
}

export function fromNow(date: string) {
	const value = dayjs(date)
	return Math.abs(value.diff(dayjs(), 'minute')) < 2
		? 'Just now'
		: value.fromNow()
}

export function formatDate(date: string) {
	return dayjs(date).format('D MMMM YYYY')
}

export function formatMonth(date: string) {
	return dayjs(date).format('MMM YYYY')
}

export const LANGUAGE_NAMES: Record<DocumentLanguage, string> = {
	EN: 'English',
	FR: 'Français',
	PT: 'Português',
}

export function plural(count: number, one: string, many = `${one}s`) {
	return `${count} ${count === 1 ? one : many}`
}
