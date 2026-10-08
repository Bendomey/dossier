import 'dotenv/config'
import { createHash, randomUUID } from 'node:crypto'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient, type Prisma } from '../app/generated/prisma/client'
import { pickReply } from '../app/lib/mock/responses'
import {
	COLLECTIONS,
	DOCUMENTS,
	GROUPS,
	MEMBERS,
	ORGANIZATION,
	RECENT_CHAT_TITLES,
} from '../app/lib/mock/seed'

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL
const host = connectionString ? new URL(connectionString).hostname : ''
const isLocal = ['localhost', '127.0.0.1', '::1'].includes(host)

// Seeding deletes every organization and profile first, so it only runs
// against a local database unless explicitly allowed for a disposable one.
if (
	process.env.NODE_ENV === 'production' ||
	(!isLocal && process.env.ALLOW_REMOTE_SEED !== 'true')
) {
	throw new Error(
		`Refusing to seed ${host || 'an unknown database'}: seeding deletes all data. ` +
			'Point DATABASE_URL at a local database, or set ALLOW_REMOTE_SEED=true for a disposable one.',
	)
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) })

const SYSTEM_ROLE_NAMES = {
	OWNER: 'Owner',
	ADMIN: 'Admin',
	MEMBER: 'Member',
} as const

/** Sample documents use these types; the mock data does not carry one. */
const DOCUMENT_TYPES: Record<
	string,
	Prisma.DocumentCreateInput['documentType']
> = {
	'Employee Handbook 2026': 'HANDBOOK',
	'Standard Employment Contract': 'TEMPLATE',
	'Vendor Agreement Template': 'TEMPLATE',
	'Acme Supply Agreement': 'AGREEMENT',
	'Company Constitution': 'CONSTITUTION',
	'Board Resolution 2025': 'REPORT',
	'Finance Policy': 'POLICY',
	'Contrat fournisseur, Abidjan Logistique': 'CONTRACT',
	'Partnership Agreement v3': 'AGREEMENT',
	'Leave and Benefits Policy': 'POLICY',
	'Board Resolution Template': 'TEMPLATE',
}

const AUDIT_ENTRIES = [
	{
		actor: 'Esi Boateng',
		action: 'ai.contract_reviewed',
		resourceType: 'document',
		target: 'Acme Supply Agreement',
	},
	{
		actor: 'Esi Boateng',
		action: 'document.uploaded',
		resourceType: 'document',
		target: 'Acme Supply Agreement',
	},
	{
		actor: 'Kofi Mensah',
		action: 'document.permission_changed',
		resourceType: 'document',
		target: 'Finance Policy',
	},
	{
		actor: 'Yaw Darko',
		action: 'ai.document_generated',
		resourceType: 'generated_document',
		target: 'Employment Agreement, Kwame Mensah',
	},
	{
		actor: 'Ama Owusu',
		action: 'member.invited',
		resourceType: 'invitation',
		target: 'abena@asante.co',
	},
	{
		actor: 'Ama Owusu',
		action: 'document.uploaded',
		resourceType: 'document',
		target: 'Partnership Agreement v3',
	},
	{
		actor: 'Kofi Mensah',
		action: 'role.assigned',
		resourceType: 'membership',
		target: 'Esi Boateng',
	},
] as const

const mimeType = (fileType: string) =>
	fileType === 'DOCX'
		? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
		: 'application/pdf'

async function reset(tx: Prisma.TransactionClient) {
	await tx.organization.deleteMany()
	await tx.profile.deleteMany()
}

async function seed(tx: Prisma.TransactionClient) {
	const systemRoles = await tx.role.findMany({
		where: { organizationId: null },
	})
	const roleId = (name: string) =>
		systemRoles.find((role) => role.name === name)!.id

	const organization = await tx.organization.create({
		data: {
			name: ORGANIZATION.name,
			slug: 'asante-co',
			country: ORGANIZATION.country,
			responseLanguage: ORGANIZATION.response_language,
			requireCitations: ORGANIZATION.require_citations,
			membersCanUpload: ORGANIZATION.members_can_upload,
			detectDocumentLanguage: ORGANIZATION.detect_document_language,
		},
	})
	const organizationId = organization.id

	const profileIds = new Map<string, string>()
	const membershipIds = new Map<string, string>()
	for (const member of MEMBERS.filter((item) => !item.invited)) {
		const [firstName, ...rest] = member.name.split(' ')
		const profile = await tx.profile.create({
			data: {
				id: randomUUID(),
				email: member.email,
				displayName: member.name,
				firstName,
				lastName: rest.join(' '),
			},
		})
		const membership = await tx.organizationMember.create({
			data: {
				organizationId,
				userId: profile.id,
				roles: {
					create: { roleId: roleId(SYSTEM_ROLE_NAMES[member.role]) },
				},
			},
		})
		profileIds.set(member.name, profile.id)
		membershipIds.set(member.name, membership.id)
	}

	const ownerId = profileIds.get(
		MEMBERS.find((member) => member.role === 'OWNER')!.name,
	)!

	for (const member of MEMBERS.filter((item) => item.invited)) {
		await tx.organizationInvitation.create({
			data: {
				organizationId,
				email: member.email,
				invitedById: ownerId,
				roleId: roleId(SYSTEM_ROLE_NAMES[member.role]),
				tokenHash: createHash('sha256').update(randomUUID()).digest('hex'),
				expiresAt: new Date(Date.now() + 7 * 86_400_000),
			},
		})
	}

	const groupIds = new Map<string, string>()
	for (const group of GROUPS) {
		const members = group.is_builtin
			? [...membershipIds.values()]
			: MEMBERS.filter(
					(member) =>
						member.group_ids.includes(group.id) &&
						membershipIds.has(member.name),
				).map((member) => membershipIds.get(member.name)!)
		const created = await tx.group.create({
			data: {
				organizationId,
				name: group.name,
				isSystem: group.is_builtin,
				createdById: ownerId,
				members: { create: members.map((membershipId) => ({ membershipId })) },
			},
		})
		groupIds.set(group.id, created.id)
	}

	const collectionIds = new Map<string, string>()
	for (const collection of COLLECTIONS) {
		const created = await tx.collection.create({
			data: {
				organizationId,
				name: collection.name,
				createdById: ownerId,
				groups: {
					create: collection.group_ids.map((groupId) => ({
						groupId: groupIds.get(groupId)!,
					})),
				},
			},
		})
		collectionIds.set(collection.id, created.id)
	}

	const documentIds = new Map<string, string>()
	for (const sample of DOCUMENTS) {
		const uploaderId = profileIds.get(sample.uploaded_by)
		const extension = sample.file_type.toLowerCase()
		const document = await tx.document.create({
			data: {
				organizationId,
				collectionId: collectionIds.get(sample.collection_id)!,
				name: sample.name,
				documentType: DOCUMENT_TYPES[sample.name] ?? 'OTHER',
				createdById: uploaderId,
				createdAt: new Date(sample.updated_at),
			},
		})
		const version = await tx.documentVersion.create({
			data: {
				organizationId,
				documentId: document.id,
				versionNumber: 1,
				fileKey: `${organizationId}/documents/${document.id}/v1.${extension}`,
				fileName: `${sample.name}.${extension}`,
				mimeType: mimeType(sample.file_type),
				fileSize: BigInt(sample.pages * 60_000),
				language: sample.language.toLowerCase(),
				createdById: uploaderId,
				createdAt: new Date(sample.updated_at),
			},
		})
		await tx.document.update({
			where: { id: document.id },
			data: { currentVersionId: version.id },
		})
		await tx.indexingJob.create({
			data: {
				organizationId,
				documentVersionId: version.id,
				status: sample.status === 'READY' ? 'COMPLETED' : 'PROCESSING',
				progress: sample.progress,
				attempts: 1,
				startedAt: new Date(sample.updated_at),
				completedAt:
					sample.status === 'READY' ? new Date(sample.updated_at) : null,
			},
		})
		if (sample.is_template) {
			await tx.documentTemplate.create({
				data: {
					organizationId,
					documentId: document.id,
					name: sample.name,
					status: 'ACTIVE',
					isApproved: true,
					createdById: uploaderId,
					approvedById: ownerId,
					approvedAt: new Date(sample.updated_at),
				},
			})
		}
		documentIds.set(sample.name, document.id)
	}

	for (const [index, title] of RECENT_CHAT_TITLES.entries()) {
		const reply = pickReply(title, null)
		const createdAt = new Date(Date.now() - (index + 1) * 3_600_000)
		const chat = await tx.chat.create({
			data: {
				organizationId,
				createdById: ownerId,
				title,
				createdAt,
				members: {
					create: {
						membershipId: membershipIds.get('Ama Owusu')!,
						role: 'OWNER',
					},
				},
			},
		})
		await tx.chatMessage.create({
			data: {
				organizationId,
				chatId: chat.id,
				role: 'USER',
				content: title,
				sequence: 0,
				createdById: ownerId,
				createdAt,
			},
		})
		const answer = await tx.chatMessage.create({
			data: {
				organizationId,
				chatId: chat.id,
				role: 'ASSISTANT',
				content: reply.text,
				sequence: 1,
				createdAt,
			},
		})
		await tx.aiRun.create({
			data: {
				organizationId,
				chatId: chat.id,
				messageId: answer.id,
				userId: ownerId,
				provider: 'seed',
				model: 'seed',
				operation: 'ANSWER',
				status: 'SUCCEEDED',
				inputTokens: 1200,
				outputTokens: Math.ceil(reply.text.length / 4),
				latencyMs: 2400,
				createdAt,
				completedAt: createdAt,
			},
		})
	}

	await tx.auditLog.createMany({
		data: AUDIT_ENTRIES.map((entry, index) => ({
			organizationId,
			actorUserId: profileIds.get(entry.actor),
			action: entry.action,
			resourceType: entry.resourceType,
			resourceId: documentIds.get(entry.target) ?? null,
			metadata: { target: entry.target },
			createdAt: new Date(Date.now() - index * 2_700_000),
		})),
	})

	return organization
}

const organization = await prisma.$transaction(
	async (tx) => {
		await reset(tx)
		return seed(tx)
	},
	{ timeout: 30_000 },
)

console.log(`Seeded ${organization.name} (${organization.slug}).`)
await prisma.$disconnect()
