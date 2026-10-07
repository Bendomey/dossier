export function typedBoolean<T>(
	value: T,
): value is Exclude<T, '' | 0 | false | null | undefined> {
	return Boolean(value)
}

/** Only same-origin paths are allowed as post-login redirects. */
export function safeRedirect(
	target: FormDataEntryValue | string | null,
	fallback = '/',
) {
	if (
		typeof target !== 'string' ||
		!target.startsWith('/') ||
		target.startsWith('//')
	) {
		return fallback
	}
	return target
}
