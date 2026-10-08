import { useState } from 'react'
import { useGetCollections } from '~/api/collections'
import { useUploadDocument } from '~/api/documents'
import { useGetGroups } from '~/api/groups'
import { Button } from '~/components/arc/button/button'
import {
	Dialog,
	DialogClose,
	DialogContent,
} from '~/components/arc/dialog/dialog'
import { FileDropzone } from '~/components/arc/file-dropzone/file-dropzone'
import { Select } from '~/components/arc/select/select'
import { useSession } from '~/providers/session-provider'

const MAX_FILE_SIZE = 50 * 1024 * 1024
const INHERIT = 'inherit'

interface Props {
	open: boolean
	onOpenChange: (open: boolean) => void
}

function simulateTransfer(
	onProgress: (percent: number) => void,
	signal: AbortSignal,
) {
	return new Promise<void>((resolve, reject) => {
		let percent = 0
		const timer = setInterval(() => {
			percent = Math.min(100, percent + 12)
			onProgress(percent)
			if (percent === 100) {
				clearInterval(timer)
				resolve()
			}
		}, 120)
		signal.addEventListener('abort', () => {
			clearInterval(timer)
			reject(new Error('Upload cancelled'))
		})
	})
}

export function UploadDialog({ open, onOpenChange }: Props) {
	const { user } = useSession()
	const { data: collections } = useGetCollections()
	const { data: groups } = useGetGroups()
	const uploadDocument = useUploadDocument(user.name)

	const [collectionId, setCollectionId] = useState<string>()
	const [access, setAccess] = useState(INHERIT)
	const selectedCollection = collectionId ?? collections?.[0]?.id

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				title="Upload documents"
				description="PDF, DOCX and scanned files up to 50 MB each."
			>
				<div className="flex flex-col gap-[18px]">
					<FileDropzone
						accept=".pdf,.docx,image/*"
						maxSize={MAX_FILE_SIZE}
						maxFiles={10}
						label="Drop files here or choose files"
						description="Dossier detects the language and splits each file into clauses."
						onUpload={async (item, { onProgress, signal }) => {
							await simulateTransfer(onProgress, signal)
							await uploadDocument.mutateAsync({
								file_name: item.name,
								size: item.size,
								collection_id: selectedCollection ?? '',
								group_ids: access === INHERIT ? null : [access],
							})
						}}
					/>
					<div className="grid grid-cols-2 gap-3">
						<Select
							label="Collection"
							value={selectedCollection}
							onValueChange={setCollectionId}
							options={
								collections?.map((collection) => ({
									value: collection.id,
									label: collection.name,
								})) ?? []
							}
						/>
						<Select
							label="Access"
							value={access}
							onValueChange={setAccess}
							options={[
								{ value: INHERIT, label: 'Same as collection' },
								...(groups?.map((group) => ({
									value: group.id,
									label: group.name,
								})) ?? []),
							]}
						/>
					</div>
					<div className="flex justify-end">
						<DialogClose asChild>
							<Button>Done</Button>
						</DialogClose>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	)
}
