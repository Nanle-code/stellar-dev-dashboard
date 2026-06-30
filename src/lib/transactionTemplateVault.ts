import { encrypt, decrypt } from './encryption.js'
import { getEncryptedValue, setEncryptedValue } from './storage.js'

export interface TransactionTemplateOperation {
  type: string
  params: Record<string, unknown>
}

export interface TransactionTemplate {
  id: string
  label: string
  description?: string
  operations: TransactionTemplateOperation[]
  memo?: string
  memoType?: string
  createdAt?: string
  updatedAt?: string
}

interface TransactionTemplatePackV1 {
  version: 1
  templates: TransactionTemplate[]
  updatedAt: string
}

export interface EncryptedTemplateExportFileV1 {
  format: 'stellar-dev-dashboard.transaction-templates'
  version: 1
  encrypted: { ciphertext: string; iv: string; salt: string }
  exportedAt: string
}

const STORAGE_KEY = 'transaction-template-pack-v1'

let cachedTemplates: TransactionTemplate[] | null = null

function normalizeTemplate(template: TransactionTemplate): TransactionTemplate {
  const now = new Date().toISOString()
  return {
    ...template,
    id: template.id || `tpl-${Date.now()}`,
    label: template.label || 'Untitled Template',
    operations: Array.isArray(template.operations) ? template.operations : [],
    createdAt: template.createdAt || now,
    updatedAt: now,
  }
}

function buildPack(templates: TransactionTemplate[]): TransactionTemplatePackV1 {
  return {
    version: 1,
    templates: templates.map(normalizeTemplate),
    updatedAt: new Date().toISOString(),
  }
}

export function getCachedUserTransactionTemplates(): TransactionTemplate[] {
  return cachedTemplates || []
}

export function clearCachedUserTransactionTemplates() {
  cachedTemplates = null
}

export async function loadUserTransactionTemplates(passphrase: string): Promise<TransactionTemplate[]> {
  const raw = await getEncryptedValue(STORAGE_KEY, passphrase)
  if (!raw) {
    cachedTemplates = []
    return []
  }

  const parsed = JSON.parse(raw) as Partial<TransactionTemplatePackV1>
  const templates = Array.isArray(parsed.templates) ? (parsed.templates as TransactionTemplate[]) : []
  cachedTemplates = templates
  return templates
}

export async function saveUserTransactionTemplates(
  passphrase: string,
  templates: TransactionTemplate[]
): Promise<void> {
  const pack = buildPack(templates)
  await setEncryptedValue(STORAGE_KEY, JSON.stringify(pack), passphrase)
  cachedTemplates = pack.templates
}

export async function upsertUserTransactionTemplate(
  passphrase: string,
  template: TransactionTemplate
): Promise<void> {
  const existing = await loadUserTransactionTemplates(passphrase)
  const next = [...existing]
  const normalized = normalizeTemplate(template)
  const idx = next.findIndex((t) => t.id === normalized.id)
  if (idx >= 0) next[idx] = normalized
  else next.unshift(normalized)
  await saveUserTransactionTemplates(passphrase, next)
}

export async function deleteUserTransactionTemplate(passphrase: string, id: string): Promise<void> {
  const existing = await loadUserTransactionTemplates(passphrase)
  const next = existing.filter((t) => t.id !== id)
  await saveUserTransactionTemplates(passphrase, next)
}

export async function exportUserTemplatesEncryptedFile(
  passphrase: string
): Promise<{ file: EncryptedTemplateExportFileV1; filename: string }> {
  const templates = await loadUserTransactionTemplates(passphrase)
  const plaintext = JSON.stringify(buildPack(templates))
  const encrypted = await encrypt(plaintext, passphrase)

  const file: EncryptedTemplateExportFileV1 = {
    format: 'stellar-dev-dashboard.transaction-templates',
    version: 1,
    encrypted,
    exportedAt: new Date().toISOString(),
  }

  const date = new Date().toISOString().slice(0, 10)
  return { file, filename: `transaction-templates.${date}.enc.json` }
}

export async function importUserTemplatesEncryptedFile(
  passphrase: string,
  fileText: string,
  opts: { mode?: 'replace' | 'merge' } = {}
): Promise<{ imported: number }> {
  const mode = opts.mode || 'replace'
  const parsed = JSON.parse(fileText) as Partial<EncryptedTemplateExportFileV1>

  if (parsed.format !== 'stellar-dev-dashboard.transaction-templates' || parsed.version !== 1) {
    throw new Error('Invalid template export file format')
  }
  if (!parsed.encrypted?.ciphertext || !parsed.encrypted?.iv || !parsed.encrypted?.salt) {
    throw new Error('Invalid template export file payload')
  }

  const plaintext = await decrypt(
    parsed.encrypted.ciphertext,
    passphrase,
    parsed.encrypted.iv,
    parsed.encrypted.salt
  )
  const pack = JSON.parse(plaintext) as Partial<TransactionTemplatePackV1>
  const importedTemplates = Array.isArray(pack.templates) ? (pack.templates as TransactionTemplate[]) : []

  if (mode === 'replace') {
    await saveUserTransactionTemplates(passphrase, importedTemplates)
    return { imported: importedTemplates.length }
  }

  const existing = await loadUserTransactionTemplates(passphrase)
  const byId = new Map<string, TransactionTemplate>()
  existing.forEach((t) => byId.set(t.id, t))
  importedTemplates.forEach((t) => byId.set(t.id, normalizeTemplate(t)))
  const merged = Array.from(byId.values())
  await saveUserTransactionTemplates(passphrase, merged)
  return { imported: importedTemplates.length }
}

