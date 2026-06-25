import { pgTable, pgEnum, uuid, varchar, text, timestamp, index, uniqueIndex, jsonb } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import type { Macro } from '@timelense/shared'

export const productivityTagEnum = pgEnum('productivity_tag', ['productive', 'non-productive', 'neutral'])

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  resetPasswordToken: varchar('reset_password_token', { length: 255 }),
  resetPasswordExpiresAt: timestamp('reset_password_expires_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const categories = pgTable('categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull(),
  parentId: uuid('parent_id').references((): any => categories.id, { onDelete: 'set null' }),
  color: varchar('color', { length: 7 }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
})

// Quick-start macros, stored as a single JSON document per user. The set is
// small and always read/written as a whole, so one jsonb column is simpler
// (and atomic) than a row per macro.
export const userMacros = pgTable('user_macros', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  macros: jsonb('macros').$type<Macro[]>().notNull().default(sql`'[]'::jsonb`),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const tasks = pgTable('tasks', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  categoryId: uuid('category_id').references(() => categories.id, { onDelete: 'set null' }),
  title: varchar('title', { length: 255 }).notNull(),
  tag: productivityTagEnum('tag').notNull().default('neutral'),
  notes: text('notes'),
  startedAt: timestamp('started_at').defaultNow().notNull(),
  endedAt: timestamp('ended_at'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  userStartedAtIdx: index('tasks_user_started_at_idx').on(table.userId, table.startedAt),
  userCategoryIdx: index('tasks_user_category_idx').on(table.userId, table.categoryId),
  oneRunningTaskPerUser: uniqueIndex('tasks_one_running_per_user_idx')
    .on(table.userId)
    .where(sql`${table.endedAt} IS NULL`),
}))
