import { useRef, useState } from 'react'
import type { UploadProgress } from './upload-file'
import { useUploadGuard } from './use-upload-guard'
import { MAX_UPLOAD_BYTES } from '~/api/uploads/validation'
import { Button } from '~/components/arc/button/button'
import { Dialog, DialogContent } from '~/components/arc/dialog/dialog'
import { FileDropzone } from '~/components/arc/file-dropzone/file-dropzone'
import { Select } from '~/components/arc/select/select'

interface Props {
	open: boolean
	onOpenChange: (open: boolean) => void
	collections: Array<{ id: string; name: string }>
	upload: (
		file: File,
		collectionId: string,
		options: UploadProgress,
	) => Promise<void>
	/** Uploading a new version: the document and its collection are fixed. */
	fixedDocument?: { id: string; name: string; collectionId: string }
	onUploaded?: () => void
}

export function UploadDialog({
	open,
	onOpenChange,
	collections,
	upload,
	fixedDocument,
	onUploaded,
}: Props) {
	const [collectionId, setCollectionId] = useState<string>()
	const [uploading, setUploading] = useState(0)
	const controllers = useRef(new Set<AbortController>())
	const selectedCollection =
		fixedDocument?.collectionId ?? collectionId ?? collections[0]?.id

	const { confirmLeave, requestClose } = useUploadGuard(uploading, () => {
		for (const controller of controllers.current) controller.abort()
	})

	return (
		<>
			<Dialog
				open={open}
				onOpenChange={(next) =>
					next ? onOpenChange(true) : requestClose(() => onOpenChange(false))
				}
			>
				<DialogContent
					title={
						fixedDocument
							? `New version of ${fixedDocument.name}`
							: 'Upload documents'
					}
					description="PDF, DOCX, TXT and Markdown up to 25 MB each."
				>
					<div className="flex flex-col gap-[18px]">
						<FileDropzone
							accept=".pdf,.docx,.txt,.md"
							maxSize={MAX_UPLOAD_BYTES}
							maxFiles={fixedDocument ? 1 : 10}
							multiple={!fixedDocument}
							label="Drop files here or choose files"
							description="Dossier reads each file and splits it into clauses it can cite."
							onUpload={async (item, { onProgress, signal }) => {
								if (!item.file || !selectedCollection) {
									throw new Error('Choose a collection first.')
								}
								const controller = new AbortController()
								if (signal.aborted) controller.abort()
								signal.addEventListener('abort', () => controller.abort(), {
									once: true,
								})
								controllers.current.add(controller)
								setUploading((count) => count + 1)
								try {
									await upload(item.file, selectedCollection, {
										onProgress,
										signal: controller.signal,
									})
									onUploaded?.()
								} finally {
									controllers.current.delete(controller)
									setUploading((count) => count - 1)
								}
							}}
						/>
						{fixedDocument ? null : (
							<Select
								label="Collection"
								value={selectedCollection}
								onValueChange={setCollectionId}
								options={collections.map((collection) => ({
									value: collection.id,
									label: collection.name,
								}))}
							/>
						)}
						<div className="flex justify-end">
							<Button onClick={() => requestClose(() => onOpenChange(false))}>
								Done
							</Button>
						</div>
					</div>
				</DialogContent>
			</Dialog>
			{confirmLeave}
		</>
	)
}
