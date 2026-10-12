export function warnBeforeUnload(event: BeforeUnloadEvent) {
	event.preventDefault()
	event.returnValue = ''
}
