import { pgTable, uuid, varchar, text, timestamp, boolean } from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const categories = pgTable('categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull(),
  parentId: uuid('parent_id'),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
})

export const tasks = pgTable('tasks', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  categoryId: uuid('category_id').references(() => categories.id, { onDelete: 'set null' }),
  title: varchar('title', { length: 255 }).notNull(),
  tag: varchar('tag', { length: 20 }).notNull().default('neutral'),
  notes: text('notes'),
  startedAt: timestamp('started_at').defaultNow().notNull(),
  endedAt: timestamp('ended_at'),
})
