/**
 * Database Type Helpers
 *
 * Convenience types derived from the Supabase Database interface.
 * Use these instead of reaching into Database['public']['Tables'] directly.
 *
 * Typed access helpers for the Supabase database schema.
 */

import type { Database } from './supabase';

// ---------------------------------------------------------------------------
// Table helpers
// ---------------------------------------------------------------------------

/** Row type for a given table name */
export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];

/** Insert type for a given table name */
export type TablesInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert'];

/** Update type for a given table name */
export type TablesUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update'];

// ---------------------------------------------------------------------------
// Enum helpers
// ---------------------------------------------------------------------------

/** Enum type for a given enum name */
export type Enums<T extends keyof Database['public']['Enums']> =
  Database['public']['Enums'][T];
