import { apiRequest } from './client'
import type { Category } from '@timelense/shared'

export function getCategories(): Promise<Category[]> {
  return apiRequest('/categories')
}

export function createCategory(body: { name: string; parentId?: string; color?: string }): Promise<Category> {
  return apiRequest('/categories', 'POST', body)
}

export function updateCategory(id: string, body: Partial<{ name: string; parentId: string | null; color: string }>): Promise<Category> {
  return apiRequest(`/categories/${id}`, 'PATCH', body)
}

export function deleteCategory(id: string): Promise<void> {
  return apiRequest(`/categories/${id}`, 'DELETE')
}
