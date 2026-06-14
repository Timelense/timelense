import { apiRequest } from './client'
import {
  getLocalCategories,
  insertLocalCategory,
  updateLocalCategory,
  deleteLocalCategory,
} from '../db/categoryRepo'
import type { Category } from '@timelense/shared'

let _cachedUserId = 'current-user'
export function setLocalUserId(id: string): void {
  _cachedUserId = id
}

/**
 * Returns categories from the local cache.
 * The cache is populated during sync pulls.
 */
export function getCategories(): Category[] {
  return getLocalCategories()
}

// Category CRUD requires network connectivity, but updates the local cache on success
export async function createCategory(body: { name: string; parentId?: string; color?: string }): Promise<Category> {
  const cat = await apiRequest<Category>('/categories', 'POST', body)
  insertLocalCategory(_cachedUserId, cat)
  return cat
}

export async function updateCategory(id: string, body: Partial<{ name: string; parentId: string | null; color: string }>): Promise<Category> {
  const cat = await apiRequest<Category>(`/categories/${id}`, 'PATCH', body)
  updateLocalCategory(cat)
  return cat
}

export async function deleteCategory(id: string): Promise<void> {
  await apiRequest(`/categories/${id}`, 'DELETE')
  deleteLocalCategory(id)
}

