export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      addresses: {
        Row: {
          city: string
          complement: string | null
          created_at: string
          id: string
          is_default: boolean
          label: string
          neighborhood: string
          number: string
          state: string
          street: string
          updated_at: string
          user_id: string
          zip_code: string
        }
        Insert: {
          city: string
          complement?: string | null
          created_at?: string
          id?: string
          is_default?: boolean
          label?: string
          neighborhood: string
          number: string
          state: string
          street: string
          updated_at?: string
          user_id: string
          zip_code: string
        }
        Update: {
          city?: string
          complement?: string | null
          created_at?: string
          id?: string
          is_default?: boolean
          label?: string
          neighborhood?: string
          number?: string
          state?: string
          street?: string
          updated_at?: string
          user_id?: string
          zip_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "addresses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_role_capabilities: {
        Row: {
          can_confirm_payments: boolean
          can_manage_quotes: boolean
          role: Database["public"]["Enums"]["admin_role"]
          updated_at: string
        }
        Insert: {
          can_confirm_payments?: boolean
          can_manage_quotes?: boolean
          role: Database["public"]["Enums"]["admin_role"]
          updated_at?: string
        }
        Update: {
          can_confirm_payments?: boolean
          can_manage_quotes?: boolean
          role?: Database["public"]["Enums"]["admin_role"]
          updated_at?: string
        }
        Relationships: []
      }
      admin_users: {
        Row: {
          created_at: string
          created_by: string | null
          full_name: string
          id: string
          is_active: boolean
          role: Database["public"]["Enums"]["admin_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          full_name: string
          id: string
          is_active?: boolean
          role: Database["public"]["Enums"]["admin_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["admin_role"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_users_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
      attribute_groups: {
        Row: {
          id: string
          is_active: boolean
          name: string
          sort_order: number
        }
        Insert: {
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
        }
        Update: {
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      attributes: {
        Row: {
          group_id: string
          id: string
          is_active: boolean
          name: string
          sort_order: number
        }
        Insert: {
          group_id: string
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
        }
        Update: {
          group_id?: string
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "attributes_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "attribute_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          admin_user_id: string | null
          created_at: string
          entity: string
          entity_id: string | null
          id: string
          ip_address: unknown
          new_value: Json | null
          old_value: Json | null
        }
        Insert: {
          action: string
          admin_user_id?: string | null
          created_at?: string
          entity: string
          entity_id?: string | null
          id?: string
          ip_address?: unknown
          new_value?: Json | null
          old_value?: Json | null
        }
        Update: {
          action?: string
          admin_user_id?: string | null
          created_at?: string
          entity?: string
          entity_id?: string | null
          id?: string
          ip_address?: unknown
          new_value?: Json | null
          old_value?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_admin_user_id_fkey"
            columns: ["admin_user_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
      cart_items: {
        Row: {
          created_at: string
          file_ids: string[] | null
          id: string
          is_double_sided: boolean
          item_type: Database["public"]["Enums"]["cart_item_type"]
          notes: string | null
          quantity: number
          reference_id: string
          selected_options: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          file_ids?: string[] | null
          id?: string
          is_double_sided?: boolean
          item_type: Database["public"]["Enums"]["cart_item_type"]
          notes?: string | null
          quantity?: number
          reference_id: string
          selected_options?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          file_ids?: string[] | null
          id?: string
          is_double_sided?: boolean
          item_type?: Database["public"]["Enums"]["cart_item_type"]
          notes?: string | null
          quantity?: number
          reference_id?: string
          selected_options?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cart_items_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          catalog_scope: string
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          parent_id: string | null
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          catalog_scope?: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          parent_id?: string | null
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          catalog_scope?: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          parent_id?: string | null
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      gallery_items: {
        Row: {
          created_at: string
          description: string | null
          id: string
          image_url: string
          is_active: boolean
          service_id: string | null
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          image_url: string
          is_active?: boolean
          service_id?: string | null
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string
          is_active?: boolean
          service_id?: string | null
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gallery_items_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      favorite_orders: {
        Row: {
          created_at: string
          id: string
          name: string | null
          order_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name?: string | null
          order_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string | null
          order_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorite_orders_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorite_orders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      file_access_audit: {
        Row: {
          actor_admin_id: string | null
          actor_user_id: string | null
          created_at: string
          expires_in_seconds: number | null
          file_id: string | null
          id: string
          outcome: string
          purpose: string
          request_id: string | null
        }
        Insert: {
          actor_admin_id?: string | null
          actor_user_id?: string | null
          created_at?: string
          expires_in_seconds?: number | null
          file_id?: string | null
          id?: string
          outcome: string
          purpose: string
          request_id?: string | null
        }
        Update: {
          actor_admin_id?: string | null
          actor_user_id?: string | null
          created_at?: string
          expires_in_seconds?: number | null
          file_id?: string | null
          id?: string
          outcome?: string
          purpose?: string
          request_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "file_access_audit_actor_admin_id_fkey"
            columns: ["actor_admin_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "file_access_audit_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "file_access_audit_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "order_files"
            referencedColumns: ["id"]
          },
        ]
      }
      file_retention_runs: {
        Row: {
          completed_at: string
          deleted_count: number
          details: Json
          eligible_count: number
          expired_intent_count: number
          failed_count: number
          id: string
          mode: string
          missing_count: number
          processed_count: number
          run_key: string
          started_at: string
          status: string
        }
        Insert: {
          completed_at?: string
          deleted_count?: number
          details?: Json
          eligible_count?: number
          expired_intent_count?: number
          failed_count?: number
          id?: string
          mode?: string
          missing_count?: number
          processed_count?: number
          run_key: string
          started_at?: string
          status: string
        }
        Update: {
          completed_at?: string
          deleted_count?: number
          details?: Json
          eligible_count?: number
          expired_intent_count?: number
          failed_count?: number
          id?: string
          mode?: string
          missing_count?: number
          processed_count?: number
          run_key?: string
          started_at?: string
          status?: string
        }
        Relationships: []
      }
      privacy_requests: {
        Row: {
          assigned_admin_id: string | null
          created_at: string
          details: string | null
          id: string
          identity_verified_at: string | null
          protocol: string
          request_type: string
          requester_email: string | null
          requester_name: string
          requester_phone: string | null
          resolution_summary: string | null
          resolved_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          assigned_admin_id?: string | null
          created_at?: string
          details?: string | null
          id?: string
          identity_verified_at?: string | null
          protocol: string
          request_type: string
          requester_email?: string | null
          requester_name: string
          requester_phone?: string | null
          resolution_summary?: string | null
          resolved_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          assigned_admin_id?: string | null
          created_at?: string
          details?: string | null
          id?: string
          identity_verified_at?: string | null
          protocol?: string
          request_type?: string
          requester_email?: string | null
          requester_name?: string
          requester_phone?: string | null
          resolution_summary?: string | null
          resolved_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "privacy_requests_assigned_admin_id_fkey"
            columns: ["assigned_admin_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
      guest_access_attempts: {
        Row: {
          created_at: string
          id: number
          order_code_hash: string
          request_hash: string
          succeeded: boolean
        }
        Insert: {
          created_at?: string
          id?: never
          order_code_hash: string
          request_hash: string
          succeeded?: boolean
        }
        Update: {
          created_at?: string
          id?: never
          order_code_hash?: string
          request_hash?: string
          succeeded?: boolean
        }
        Relationships: []
      }
      order_artwork_approvals: {
        Row: {
          approved_by_user_id: string | null
          approved_file_sha256: string
          created_at: string
          decision: string
          guest_email: string | null
          id: string
          note: string | null
          order_file_id: string
          order_id: string
          report_id: string
        }
        Insert: {
          approved_by_user_id?: string | null
          approved_file_sha256: string
          created_at?: string
          decision: string
          guest_email?: string | null
          id?: string
          note?: string | null
          order_file_id: string
          order_id: string
          report_id: string
        }
        Update: {
          approved_by_user_id?: string | null
          approved_file_sha256?: string
          created_at?: string
          decision?: string
          guest_email?: string | null
          id?: string
          note?: string | null
          order_file_id?: string
          order_id?: string
          report_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_artwork_approvals_order_file_id_fkey"
            columns: ["order_file_id"]
            isOneToOne: false
            referencedRelation: "order_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_artwork_approvals_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_artwork_approvals_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "order_file_preflight_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      order_contact_outbox: {
        Row: {
          created_at: string
          effect_type: string
          id: string
          idempotency_key: string
          last_error: string | null
          opened_at: string | null
          order_id: string
          payload: Json
          status: string
        }
        Insert: {
          created_at?: string
          effect_type: string
          id?: string
          idempotency_key: string
          last_error?: string | null
          opened_at?: string | null
          order_id: string
          payload: Json
          status?: string
        }
        Update: {
          created_at?: string
          effect_type?: string
          id?: string
          idempotency_key?: string
          last_error?: string | null
          opened_at?: string | null
          order_id?: string
          payload?: Json
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_contact_outbox_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_events: {
        Row: {
          admin_user_id: string | null
          created_at: string
          from_status: Database["public"]["Enums"]["order_status"] | null
          id: string
          idempotency_key: string | null
          note: string | null
          order_id: string
          to_status: Database["public"]["Enums"]["order_status"]
        }
        Insert: {
          admin_user_id?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["order_status"] | null
          id?: string
          idempotency_key?: string | null
          note?: string | null
          order_id: string
          to_status: Database["public"]["Enums"]["order_status"]
        }
        Update: {
          admin_user_id?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["order_status"] | null
          id?: string
          idempotency_key?: string | null
          note?: string | null
          order_id?: string
          to_status?: Database["public"]["Enums"]["order_status"]
        }
        Relationships: [
          {
            foreignKeyName: "order_events_admin_user_id_fkey"
            columns: ["admin_user_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_file_preflight_reports: {
        Row: {
          automation_summary: Json
          created_at: string
          customer_approval_required: boolean
          file_content_sha256: string
          findings: Json
          graphics_summary: Json
          id: string
          order_file_id: string
          order_id: string
          order_item_id: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          staff_note: string | null
          status: string
          structure_summary: Json
          updated_at: string
        }
        Insert: {
          automation_summary?: Json
          created_at?: string
          customer_approval_required?: boolean
          file_content_sha256: string
          findings?: Json
          graphics_summary?: Json
          id?: string
          order_file_id: string
          order_id: string
          order_item_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          staff_note?: string | null
          status?: string
          structure_summary?: Json
          updated_at?: string
        }
        Update: {
          automation_summary?: Json
          created_at?: string
          customer_approval_required?: boolean
          file_content_sha256?: string
          findings?: Json
          graphics_summary?: Json
          id?: string
          order_file_id?: string
          order_id?: string
          order_item_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          staff_note?: string | null
          status?: string
          structure_summary?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_file_preflight_reports_order_file_id_fkey"
            columns: ["order_file_id"]
            isOneToOne: true
            referencedRelation: "order_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_file_preflight_reports_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_file_preflight_reports_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_file_preflight_reports_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
      order_files: {
        Row: {
          access_count: number
          cleanup_required: boolean
          cleanup_attempts: number
          cleanup_last_attempt_at: string | null
          cleanup_last_error: string | null
          content_sha256: string | null
          created_at: string
          declared_mime_type: string | null
          deleted_at: string | null
          detected_mime_type: string | null
          expires_at: string | null
          file_type: Database["public"]["Enums"]["file_type"]
          guest_owner_hash: string | null
          id: string
          intent_expires_at: string | null
          is_suspicious: boolean
          last_accessed_at: string | null
          mime_type: string
          order_id: string | null
          order_item_id: string | null
          original_name: string
          ownership_version: number
          page_count: number
          page_count_method: Database["public"]["Enums"]["page_count_method"]
          processing_metadata: Json
          processing_started_at: string | null
          ready_at: string | null
          rejected_at: string | null
          rejection_code: string | null
          retention_due_at: string | null
          retention_reason: string | null
          safe_name: string | null
          size_bytes: number
          status: Database["public"]["Enums"]["file_status"]
          storage_deleted_at: string | null
          storage_path: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          access_count?: number
          cleanup_required?: boolean
          cleanup_attempts?: number
          cleanup_last_attempt_at?: string | null
          cleanup_last_error?: string | null
          content_sha256?: string | null
          created_at?: string
          declared_mime_type?: string | null
          deleted_at?: string | null
          detected_mime_type?: string | null
          expires_at?: string | null
          file_type: Database["public"]["Enums"]["file_type"]
          guest_owner_hash?: string | null
          id?: string
          intent_expires_at?: string | null
          is_suspicious?: boolean
          last_accessed_at?: string | null
          mime_type: string
          order_id?: string | null
          order_item_id?: string | null
          original_name: string
          ownership_version?: number
          page_count?: number
          page_count_method?: Database["public"]["Enums"]["page_count_method"]
          processing_metadata?: Json
          processing_started_at?: string | null
          ready_at?: string | null
          rejected_at?: string | null
          rejection_code?: string | null
          retention_due_at?: string | null
          retention_reason?: string | null
          safe_name?: string | null
          size_bytes?: number
          status?: Database["public"]["Enums"]["file_status"]
          storage_deleted_at?: string | null
          storage_path?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          access_count?: number
          cleanup_required?: boolean
          cleanup_attempts?: number
          cleanup_last_attempt_at?: string | null
          cleanup_last_error?: string | null
          content_sha256?: string | null
          created_at?: string
          declared_mime_type?: string | null
          deleted_at?: string | null
          detected_mime_type?: string | null
          expires_at?: string | null
          file_type?: Database["public"]["Enums"]["file_type"]
          guest_owner_hash?: string | null
          id?: string
          intent_expires_at?: string | null
          is_suspicious?: boolean
          last_accessed_at?: string | null
          mime_type?: string
          order_id?: string | null
          order_item_id?: string | null
          original_name?: string
          ownership_version?: number
          page_count?: number
          page_count_method?: Database["public"]["Enums"]["page_count_method"]
          processing_metadata?: Json
          processing_started_at?: string | null
          ready_at?: string | null
          rejected_at?: string | null
          rejection_code?: string | null
          retention_due_at?: string | null
          retention_reason?: string | null
          safe_name?: string | null
          size_bytes?: number
          status?: Database["public"]["Enums"]["file_status"]
          storage_deleted_at?: string | null
          storage_path?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_files_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_files_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_files_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          discount_applied: number | null
          discount_cents: number
          fields_snapshot: Json
          id: string
          is_double_sided: boolean
          order_id: string
          original_total_price_cents: number
          pages_count: number
          pages_method: Database["public"]["Enums"]["page_count_method"]
          pricing_rule_id: string | null
          pricing_rule_snapshot: Json | null
          product_id: string | null
          product_name_snapshot: string | null
          quantity: number
          service_description_snapshot: string | null
          service_id: string | null
          service_name_snapshot: string | null
          total_price: number
          total_price_cents: number
          unit_price: number
          unit_price_cents: number
        }
        Insert: {
          created_at?: string
          discount_applied?: number | null
          discount_cents: number
          fields_snapshot?: Json
          id?: string
          is_double_sided?: boolean
          order_id: string
          original_total_price_cents: number
          pages_count?: number
          pages_method?: Database["public"]["Enums"]["page_count_method"]
          pricing_rule_id?: string | null
          pricing_rule_snapshot?: Json | null
          product_id?: string | null
          product_name_snapshot?: string | null
          quantity?: number
          service_description_snapshot?: string | null
          service_id?: string | null
          service_name_snapshot?: string | null
          total_price?: number
          total_price_cents: number
          unit_price?: number
          unit_price_cents: number
        }
        Update: {
          created_at?: string
          discount_applied?: number | null
          discount_cents?: number
          fields_snapshot?: Json
          id?: string
          is_double_sided?: boolean
          order_id?: string
          original_total_price_cents?: number
          pages_count?: number
          pages_method?: Database["public"]["Enums"]["page_count_method"]
          pricing_rule_id?: string | null
          pricing_rule_snapshot?: Json | null
          product_id?: string | null
          product_name_snapshot?: string | null
          quantity?: number
          service_description_snapshot?: string | null
          service_id?: string | null
          service_name_snapshot?: string | null
          total_price?: number
          total_price_cents?: number
          unit_price?: number
          unit_price_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_pricing_rule_id_fkey"
            columns: ["pricing_rule_id"]
            isOneToOne: false
            referencedRelation: "pricing_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      order_payment_events: {
        Row: {
          admin_user_id: string
          created_at: string
          external_reference: string | null
          from_status: Database["public"]["Enums"]["payment_status"]
          id: string
          idempotency_key: string
          note: string
          order_id: string
          to_status: Database["public"]["Enums"]["payment_status"]
        }
        Insert: {
          admin_user_id: string
          created_at?: string
          external_reference?: string | null
          from_status: Database["public"]["Enums"]["payment_status"]
          id?: string
          idempotency_key: string
          note: string
          order_id: string
          to_status: Database["public"]["Enums"]["payment_status"]
        }
        Update: {
          admin_user_id?: string
          created_at?: string
          external_reference?: string | null
          from_status?: Database["public"]["Enums"]["payment_status"]
          id?: string
          idempotency_key?: string
          note?: string
          order_id?: string
          to_status?: Database["public"]["Enums"]["payment_status"]
        }
        Relationships: [
          {
            foreignKeyName: "order_payment_events_admin_user_id_fkey"
            columns: ["admin_user_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_payment_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_price_adjustments: {
        Row: {
          admin_user_id: string | null
          catalog_version: number | null
          created_at: string
          id: string
          idempotency_key: string
          new_item_total_cents: number
          new_order_subtotal_cents: number
          new_order_total_cents: number
          order_id: string
          order_item_id: string
          order_version_after: number
          order_version_before: number
          previous_item_total_cents: number
          previous_order_subtotal_cents: number
          previous_order_total_cents: number
          reason: string
        }
        Insert: {
          admin_user_id?: string | null
          catalog_version?: number | null
          created_at?: string
          id?: string
          idempotency_key: string
          new_item_total_cents: number
          new_order_subtotal_cents: number
          new_order_total_cents: number
          order_id: string
          order_item_id: string
          order_version_after: number
          order_version_before: number
          previous_item_total_cents: number
          previous_order_subtotal_cents: number
          previous_order_total_cents: number
          reason: string
        }
        Update: {
          admin_user_id?: string | null
          catalog_version?: number | null
          created_at?: string
          id?: string
          idempotency_key?: string
          new_item_total_cents?: number
          new_order_subtotal_cents?: number
          new_order_total_cents?: number
          order_id?: string
          order_item_id?: string
          order_version_after?: number
          order_version_before?: number
          previous_item_total_cents?: number
          previous_order_subtotal_cents?: number
          previous_order_total_cents?: number
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_price_adjustments_admin_user_id_fkey"
            columns: ["admin_user_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_price_adjustments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_price_adjustments_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      order_quote_events: {
        Row: {
          actor_type: Database["public"]["Enums"]["order_quote_actor_type"]
          actor_user_id: string | null
          admin_user_id: string | null
          created_at: string
          event_type: Database["public"]["Enums"]["order_quote_event_type"]
          id: string
          idempotency_key: string
          note: string | null
          order_id: string
          quote_id: string | null
          request_hash: string
        }
        Insert: {
          actor_type: Database["public"]["Enums"]["order_quote_actor_type"]
          actor_user_id?: string | null
          admin_user_id?: string | null
          created_at?: string
          event_type: Database["public"]["Enums"]["order_quote_event_type"]
          id?: string
          idempotency_key: string
          note?: string | null
          order_id: string
          quote_id?: string | null
          request_hash: string
        }
        Update: {
          actor_type?: Database["public"]["Enums"]["order_quote_actor_type"]
          actor_user_id?: string | null
          admin_user_id?: string | null
          created_at?: string
          event_type?: Database["public"]["Enums"]["order_quote_event_type"]
          id?: string
          idempotency_key?: string
          note?: string | null
          order_id?: string
          quote_id?: string | null
          request_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_quote_events_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_quote_events_admin_user_id_fkey"
            columns: ["admin_user_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_quote_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_quote_events_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "order_quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      order_quote_items: {
        Row: {
          created_at: string
          id: string
          label_snapshot: string
          line_position: number
          order_item_id: string
          quantity: number
          quote_id: string
          scope_snapshot: Json
          total_price_cents: number
          unit_price_cents: number
        }
        Insert: {
          created_at?: string
          id?: string
          label_snapshot: string
          line_position: number
          order_item_id: string
          quantity: number
          quote_id: string
          scope_snapshot?: Json
          total_price_cents: number
          unit_price_cents: number
        }
        Update: {
          created_at?: string
          id?: string
          label_snapshot?: string
          line_position?: number
          order_item_id?: string
          quantity?: number
          quote_id?: string
          scope_snapshot?: Json
          total_price_cents?: number
          unit_price_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_quote_items_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_quote_items_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "order_quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      order_quotes: {
        Row: {
          change_reason: string | null
          commercial_observation: string
          created_at: string
          created_by: string | null
          delivery_fee_cents: number
          expires_at: string
          id: string
          idempotency_key: string
          order_id: string
          request_hash: string
          subtotal_cents: number
          total_cents: number
          version: number
        }
        Insert: {
          change_reason?: string | null
          commercial_observation: string
          created_at?: string
          created_by?: string | null
          delivery_fee_cents?: number
          expires_at: string
          id?: string
          idempotency_key: string
          order_id: string
          request_hash: string
          subtotal_cents: number
          total_cents: number
          version: number
        }
        Update: {
          change_reason?: string | null
          commercial_observation?: string
          created_at?: string
          created_by?: string | null
          delivery_fee_cents?: number
          expires_at?: string
          id?: string
          idempotency_key?: string
          order_id?: string
          request_hash?: string
          subtotal_cents?: number
          total_cents?: number
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_quotes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_quotes_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_status_communications: {
        Row: {
          admin_user_id: string | null
          channel: string
          created_at: string
          id: string
          idempotency_key: string
          opened_at: string
          order_id: string
          status_to: Database["public"]["Enums"]["order_status"]
          template_key: string
        }
        Insert: {
          admin_user_id?: string | null
          channel: string
          created_at?: string
          id?: string
          idempotency_key: string
          opened_at?: string
          order_id: string
          status_to: Database["public"]["Enums"]["order_status"]
          template_key: string
        }
        Update: {
          admin_user_id?: string | null
          channel?: string
          created_at?: string
          id?: string
          idempotency_key?: string
          opened_at?: string
          order_id?: string
          status_to?: Database["public"]["Enums"]["order_status"]
          template_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_status_communications_admin_user_id_fkey"
            columns: ["admin_user_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_status_communications_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          accepted_at: string | null
          accepted_quote_id: string | null
          anonymized_at: string | null
          artwork_status: string
          artwork_updated_at: string | null
          checkout_actor_hash: string
          checkout_request_hash: string
          created_at: string
          delivery_address_snapshot: Json | null
          delivery_fee: number
          delivery_fee_cents: number
          delivery_type: Database["public"]["Enums"]["delivery_type"]
          guest_access_expires_at: string | null
          guest_email: string | null
          guest_name: string | null
          guest_phone: string | null
          id: string
          idempotency_key: string
          latest_quote_version: number
          notes: string | null
          order_kind: Database["public"]["Enums"]["order_kind"]
          order_number: string
          order_token: string
          original_subtotal_cents: number
          original_total_cents: number
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          pix_key_used: string | null
          price_version: number
          quote_expires_at: string | null
          quote_status: Database["public"]["Enums"]["order_quote_status"]
          quoted_at: string | null
          status: Database["public"]["Enums"]["order_status"]
          subtotal: number
          subtotal_cents: number
          terminal_at: string | null
          total: number
          total_cents: number
          updated_at: string
          user_id: string | null
          whatsapp_message_url: string | null
          whatsapp_sent_at: string | null
        }
        Insert: {
          accepted_at?: string | null
          accepted_quote_id?: string | null
          anonymized_at?: string | null
          artwork_status?: string
          artwork_updated_at?: string | null
          checkout_actor_hash: string
          checkout_request_hash: string
          created_at?: string
          delivery_address_snapshot?: Json | null
          delivery_fee?: number
          delivery_fee_cents: number
          delivery_type?: Database["public"]["Enums"]["delivery_type"]
          guest_access_expires_at?: string | null
          guest_email?: string | null
          guest_name?: string | null
          guest_phone?: string | null
          id?: string
          idempotency_key: string
          latest_quote_version?: number
          notes?: string | null
          order_kind?: Database["public"]["Enums"]["order_kind"]
          order_number: string
          order_token?: string
          original_subtotal_cents: number
          original_total_cents: number
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          pix_key_used?: string | null
          price_version?: number
          quote_expires_at?: string | null
          quote_status?: Database["public"]["Enums"]["order_quote_status"]
          quoted_at?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          subtotal_cents: number
          terminal_at?: string | null
          total?: number
          total_cents: number
          updated_at?: string
          user_id?: string | null
          whatsapp_message_url?: string | null
          whatsapp_sent_at?: string | null
        }
        Update: {
          accepted_at?: string | null
          accepted_quote_id?: string | null
          anonymized_at?: string | null
          artwork_status?: string
          artwork_updated_at?: string | null
          checkout_actor_hash?: string
          checkout_request_hash?: string
          created_at?: string
          delivery_address_snapshot?: Json | null
          delivery_fee?: number
          delivery_fee_cents?: number
          delivery_type?: Database["public"]["Enums"]["delivery_type"]
          guest_access_expires_at?: string | null
          guest_email?: string | null
          guest_name?: string | null
          guest_phone?: string | null
          id?: string
          idempotency_key?: string
          latest_quote_version?: number
          notes?: string | null
          order_kind?: Database["public"]["Enums"]["order_kind"]
          order_number?: string
          order_token?: string
          original_subtotal_cents?: number
          original_total_cents?: number
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          pix_key_used?: string | null
          price_version?: number
          quote_expires_at?: string | null
          quote_status?: Database["public"]["Enums"]["order_quote_status"]
          quoted_at?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          subtotal_cents?: number
          terminal_at?: string | null
          total?: number
          total_cents?: number
          updated_at?: string
          user_id?: string | null
          whatsapp_message_url?: string | null
          whatsapp_sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_accepted_quote_id_fkey"
            columns: ["accepted_quote_id"]
            isOneToOne: false
            referencedRelation: "order_quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_discounts: {
        Row: {
          created_at: string
          discount_percent: number
          id: string
          is_active: boolean
          max_quantity: number | null
          min_quantity: number
          service_id: string
        }
        Insert: {
          created_at?: string
          discount_percent: number
          id?: string
          is_active?: boolean
          max_quantity?: number | null
          min_quantity: number
          service_id: string
        }
        Update: {
          created_at?: string
          discount_percent?: number
          id?: string
          is_active?: boolean
          max_quantity?: number | null
          min_quantity?: number
          service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pricing_discounts_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_rule_attributes: {
        Row: {
          attribute_group_id: string
          attribute_id: string | null
          id: string
          pricing_rule_id: string
        }
        Insert: {
          attribute_group_id: string
          attribute_id?: string | null
          id?: string
          pricing_rule_id: string
        }
        Update: {
          attribute_group_id?: string
          attribute_id?: string | null
          id?: string
          pricing_rule_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pricing_rule_attributes_attribute_group_id_fkey"
            columns: ["attribute_group_id"]
            isOneToOne: false
            referencedRelation: "attribute_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pricing_rule_attributes_attribute_id_fkey"
            columns: ["attribute_id"]
            isOneToOne: false
            referencedRelation: "attributes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pricing_rule_attributes_pricing_rule_id_fkey"
            columns: ["pricing_rule_id"]
            isOneToOne: false
            referencedRelation: "pricing_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_rule_field_conditions: {
        Row: {
          created_at: string
          expected_value: Json | null
          id: string
          pricing_rule_id: string
          service_field_id: string
        }
        Insert: {
          created_at?: string
          expected_value?: Json | null
          id?: string
          pricing_rule_id: string
          service_field_id: string
        }
        Update: {
          created_at?: string
          expected_value?: Json | null
          id?: string
          pricing_rule_id?: string
          service_field_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pricing_rule_field_conditions_pricing_rule_id_fkey"
            columns: ["pricing_rule_id"]
            isOneToOne: false
            referencedRelation: "pricing_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pricing_rule_field_conditions_service_field_id_fkey"
            columns: ["service_field_id"]
            isOneToOne: false
            referencedRelation: "service_fields"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_rules: {
        Row: {
          created_at: string
          fallback_behavior: string
          id: string
          is_active: boolean
          name: string
          price_per_page: number
          price_per_page_cents: number
          rule_version: number
          service_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          fallback_behavior?: string
          id?: string
          is_active?: boolean
          name: string
          price_per_page: number
          price_per_page_cents: number
          rule_version?: number
          service_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          fallback_behavior?: string
          id?: string
          is_active?: boolean
          name?: string
          price_per_page?: number
          price_per_page_cents?: number
          rule_version?: number
          service_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pricing_rules_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      product_categories: {
        Row: {
          category_id: string
          created_at: string
          product_id: string
        }
        Insert: {
          category_id: string
          created_at?: string
          product_id: string
        }
        Update: {
          category_id?: string
          created_at?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_categories_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_inventory_reservations: {
        Row: {
          created_at: string
          finalized_at: string | null
          id: string
          order_id: string
          product_id: string
          quantity: number
          reason: string | null
          status: string
        }
        Insert: {
          created_at?: string
          finalized_at?: string | null
          id?: string
          order_id: string
          product_id: string
          quantity: number
          reason?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          finalized_at?: string | null
          id?: string
          order_id?: string
          product_id?: string
          quantity?: number
          reason?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_inventory_reservations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_inventory_reservations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category_id: string | null
          created_at: string
          deleted_at: string | null
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          package_quantity: number
          price: number
          price_cents: number
          reserved_quantity: number
          sku: string | null
          slug: string
          sort_order: number
          stock_control_enabled: boolean
          stock_quantity: number | null
          unit_label: string | null
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          package_quantity?: number
          price?: number
          price_cents: number
          reserved_quantity?: number
          sku?: string | null
          slug: string
          sort_order?: number
          stock_control_enabled?: boolean
          stock_quantity?: number | null
          unit_label?: string | null
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          package_quantity?: number
          price?: number
          price_cents?: number
          reserved_quantity?: number
          sku?: string | null
          slug?: string
          sort_order?: number
          stock_control_enabled?: boolean
          stock_quantity?: number | null
          unit_label?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      service_binding_price_tiers: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          max_pages: number | null
          min_pages: number
          price_cents: number
          service_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          max_pages?: number | null
          min_pages: number
          price_cents: number
          service_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          max_pages?: number | null
          min_pages?: number
          price_cents?: number
          service_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_binding_price_tiers_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      service_catalog_versions: {
        Row: {
          catalog_state: Database["public"]["Enums"]["catalog_state"]
          catalog_version: number
          changed_by: string | null
          created_at: string
          id: string
          service_id: string
          snapshot: Json
        }
        Insert: {
          catalog_state: Database["public"]["Enums"]["catalog_state"]
          catalog_version: number
          changed_by?: string | null
          created_at?: string
          id?: string
          service_id: string
          snapshot: Json
        }
        Update: {
          catalog_state?: Database["public"]["Enums"]["catalog_state"]
          catalog_version?: number
          changed_by?: string | null
          created_at?: string
          id?: string
          service_id?: string
          snapshot?: Json
        }
        Relationships: [
          {
            foreignKeyName: "service_catalog_versions_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_catalog_versions_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      service_field_option_dependencies: {
        Row: {
          created_at: string
          id: string
          service_id: string
          source_conditions: Json
          source_field_id: string
          source_option_value: string
          target_field_id: string
          target_option_value: string
        }
        Insert: {
          created_at?: string
          id?: string
          service_id: string
          source_conditions?: Json
          source_field_id: string
          source_option_value: string
          target_field_id: string
          target_option_value: string
        }
        Update: {
          created_at?: string
          id?: string
          service_id?: string
          source_conditions?: Json
          source_field_id?: string
          source_option_value?: string
          target_field_id?: string
          target_option_value?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_field_option_dependencies_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_field_option_dependencies_source_field_id_fkey"
            columns: ["source_field_id"]
            isOneToOne: false
            referencedRelation: "service_fields"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_field_option_dependencies_target_field_id_fkey"
            columns: ["target_field_id"]
            isOneToOne: false
            referencedRelation: "service_fields"
            referencedColumns: ["id"]
          },
        ]
      }
      service_fields: {
        Row: {
          created_at: string
          field_type: Database["public"]["Enums"]["field_type"]
          id: string
          is_active: boolean
          is_required: boolean
          key: string
          label: string
          options: Json | null
          service_id: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          field_type: Database["public"]["Enums"]["field_type"]
          id?: string
          is_active?: boolean
          is_required?: boolean
          key: string
          label: string
          options?: Json | null
          service_id: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          field_type?: Database["public"]["Enums"]["field_type"]
          id?: string
          is_active?: boolean
          is_required?: boolean
          key?: string
          label?: string
          options?: Json | null
          service_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "service_fields_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          base_price: number
          base_price_cents: number
          catalog_state: Database["public"]["Enums"]["catalog_state"]
          catalog_updated_by: string | null
          catalog_version: number
          category_id: string | null
          commercial_mode: Database["public"]["Enums"]["service_commercial_mode"]
          created_at: string
          deleted_at: string | null
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          pricing_fallback_behavior: string
          pricing_profile: string
          pricing_profile_config: Json
          pricing_version: number
          published_at: string | null
          reviewed_at: string | null
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          base_price?: number
          base_price_cents: number
          catalog_state?: Database["public"]["Enums"]["catalog_state"]
          catalog_updated_by?: string | null
          catalog_version?: number
          category_id?: string | null
          commercial_mode?: Database["public"]["Enums"]["service_commercial_mode"]
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          pricing_fallback_behavior?: string
          pricing_profile?: string
          pricing_profile_config?: Json
          pricing_version?: number
          published_at?: string | null
          reviewed_at?: string | null
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          base_price?: number
          base_price_cents?: number
          catalog_state?: Database["public"]["Enums"]["catalog_state"]
          catalog_updated_by?: string | null
          catalog_version?: number
          category_id?: string | null
          commercial_mode?: Database["public"]["Enums"]["service_commercial_mode"]
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          pricing_fallback_behavior?: string
          pricing_profile?: string
          pricing_profile_config?: Json
          pricing_version?: number
          published_at?: string | null
          reviewed_at?: string | null
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_catalog_updated_by_fkey"
            columns: ["catalog_updated_by"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "services_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      store_settings: {
        Row: {
          allowed_roles: Database["public"]["Enums"]["admin_role"][]
          description: string | null
          is_sensitive: boolean
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
          value_schema: Json
          value_type: string
        }
        Insert: {
          allowed_roles: Database["public"]["Enums"]["admin_role"][]
          description?: string | null
          is_sensitive?: boolean
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
          value_schema?: Json
          value_type: string
        }
        Update: {
          allowed_roles?: Database["public"]["Enums"]["admin_role"][]
          description?: string | null
          is_sensitive?: boolean
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
          value_schema?: Json
          value_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
      system_config: {
        Row: {
          description: string | null
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          description?: string | null
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          description?: string | null
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "system_config_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_order_quote: {
        Args: {
          p_actor_user_id: string | null
          p_expected_quote_version: number
          p_guest_order_token: string | null
          p_idempotency_key: string
          p_order_id: string
          p_quote_id: string
          p_request_hash: string
        }
        Returns: {
          order_id: string
          quote_id: string
          quote_status: Database["public"]["Enums"]["order_quote_status"]
          quote_version: number
          replayed: boolean
          total_cents: number
        }[]
      }
      accept_order_quote_with_fulfillment: {
        Args: {
          p_actor_user_id: string | null
          p_delivery_address: Json | null
          p_delivery_type: Database["public"]["Enums"]["delivery_type"]
          p_expected_quote_version: number
          p_guest_order_token: string | null
          p_idempotency_key: string
          p_order_id: string
          p_payment_method: Database["public"]["Enums"]["payment_method"]
          p_quote_id: string
          p_request_hash: string
        }
        Returns: {
          order_id: string
          quote_id: string
          quote_status: Database["public"]["Enums"]["order_quote_status"]
          quote_version: number
          replayed: boolean
          total_cents: number
        }[]
      }
      adjust_order_item_price: {
        Args: {
          p_admin_user_id: string
          p_expected_order_version: number
          p_idempotency_key: string
          p_new_total_cents: number
          p_order_id: string
          p_order_item_id: string
          p_reason: string
        }
        Returns: {
          order_id: string
          replayed: boolean
          subtotal_cents: number
          total_cents: number
        }[]
      }
      increment_file_cleanup_failure: {
        Args: {
          p_attempted_at: string
          p_error_code: string
          p_file_id: string
        }
        Returns: undefined
      }
      cancel_graphic_quote: {
        Args: {
          p_actor_user_id: string | null
          p_admin_user_id: string | null
          p_guest_order_token: string | null
          p_idempotency_key: string
          p_note: string
          p_order_id: string
          p_request_hash: string
        }
        Returns: {
          order_id: string
          quote_id: string
          quote_status: Database["public"]["Enums"]["order_quote_status"]
          quote_version: number
          replayed: boolean
        }[]
      }
      commit_checkout: {
        Args: {
          p_file_ids: string[]
          p_guest_email: string | null
          p_guest_upload_session_hash: string | null
          p_idempotency_key: string
          p_items: Json
          p_order: Json
          p_request_hash: string
          p_user_id: string | null
        }
        Returns: {
          order_code: string
          order_id: string
          order_number: string
          payment_method: Database["public"]["Enums"]["payment_method"]
          replayed: boolean
          total_cents: number
        }[]
      }
      commit_graphic_quote_request: {
        Args: {
          p_customer: Json
          p_file_ids: string[]
          p_guest_email: string | null
          p_guest_upload_session_hash: string | null
          p_idempotency_key: string
          p_items: Json
          p_request_hash: string
          p_user_id: string | null
        }
        Returns: {
          protocol: string
          quote_status: Database["public"]["Enums"]["order_quote_status"]
          replayed: boolean
          request_code: string
          request_id: string
        }[]
      }
      commit_stationery_checkout: {
        Args: {
          p_guest_email: string | null
          p_guest_upload_session_hash: string | null
          p_idempotency_key: string
          p_items: Json
          p_order: Json
          p_request_hash: string
          p_user_id: string | null
        }
        Returns: {
          order_code: string
          order_id: string
          order_number: string
          payment_method: Database["public"]["Enums"]["payment_method"]
          replayed: boolean
          total_cents: number
        }[]
      }
      decline_order_quote: {
        Args: {
          p_actor_user_id: string | null
          p_expected_quote_version: number
          p_guest_order_token: string | null
          p_idempotency_key: string
          p_note: string
          p_order_id: string
          p_quote_id: string
          p_request_hash: string
        }
        Returns: {
          order_id: string
          quote_id: string
          quote_status: Database["public"]["Enums"]["order_quote_status"]
          quote_version: number
          replayed: boolean
        }[]
      }
      expire_order_quote: {
        Args: {
          p_expected_quote_version: number
          p_idempotency_key: string
          p_order_id: string
          p_quote_id: string
          p_request_hash: string
        }
        Returns: {
          order_id: string
          quote_id: string
          quote_status: Database["public"]["Enums"]["order_quote_status"]
          quote_version: number
          replayed: boolean
        }[]
      }
      issue_order_quote: {
        Args: {
          p_admin_user_id: string
          p_commercial_observation: string
          p_delivery_fee_cents: number
          p_expected_quote_version: number
          p_expires_at: string
          p_idempotency_key: string
          p_items: Json
          p_order_id: string
          p_request_hash: string
        }
        Returns: {
          order_id: string
          quote_id: string
          quote_status: Database["public"]["Enums"]["order_quote_status"]
          quote_version: number
          replayed: boolean
          total_cents: number
        }[]
      }
      process_manual_payment: {
        Args: {
          p_action: string
          p_admin_user_id: string
          p_external_reference: string | null
          p_idempotency_key: string
          p_note: string
          p_order_id: string
        }
        Returns: {
          order_id: string
          order_status: Database["public"]["Enums"]["order_status"]
          payment_status: Database["public"]["Enums"]["payment_status"]
          replayed: boolean
        }[]
      }
      replace_product_categories: {
        Args: { p_category_ids: string[]; p_product_id: string }
        Returns: undefined
      }
      replace_service_field_option_dependencies: {
        Args: {
          p_dependencies: Json
          p_root_field_id: string
          p_root_option_value: string
          p_service_id: string
        }
        Returns: number
      }
      revise_order_quote: {
        Args: {
          p_admin_user_id: string
          p_change_reason: string
          p_commercial_observation: string
          p_delivery_fee_cents: number
          p_expected_quote_version: number
          p_expires_at: string
          p_idempotency_key: string
          p_items: Json
          p_order_id: string
          p_request_hash: string
        }
        Returns: {
          order_id: string
          quote_id: string
          quote_status: Database["public"]["Enums"]["order_quote_status"]
          quote_version: number
          replayed: boolean
          total_cents: number
        }[]
      }
      transition_order_status: {
        Args: {
          p_admin_user_id: string
          p_allow_unpaid_confirmation?: boolean
          p_idempotency_key: string
          p_note: string
          p_order_id: string
          p_to_status: Database["public"]["Enums"]["order_status"]
        }
        Returns: {
          order_id: string
          order_status: Database["public"]["Enums"]["order_status"]
          replayed: boolean
        }[]
      }
    }
    Enums: {
      admin_role: "super_admin" | "admin" | "producao" | "catalogo"
      cart_item_type: "service" | "product"
      catalog_state: "draft" | "review" | "published" | "inactive"
      delivery_type: "pickup" | "delivery"
      field_type:
        | "select"
        | "radio"
        | "number"
        | "text"
        | "textarea"
        | "checkbox"
      file_status:
        | "intended"
        | "uploading"
        | "processing"
        | "ready"
        | "rejected"
        | "expired"
        | "confirmed"
        | "error"
        | "deleted"
      file_type: "pdf" | "docx" | "image" | "zip" | "rar" | "pptx"
      order_kind: "legacy_checkout" | "stationery_sale" | "graphic_quote"
      order_quote_actor_type:
        | "admin"
        | "customer_authenticated"
        | "customer_guest"
        | "system"
      order_quote_event_type:
        | "issued"
        | "revised"
        | "accepted"
        | "declined"
        | "expired"
        | "cancelled"
      order_quote_status:
        | "not_applicable"
        | "pending"
        | "negotiating"
        | "quoted"
        | "accepted"
        | "declined"
        | "expired"
        | "cancelled"
      order_status:
        | "created"
        | "awaiting_payment"
        | "confirmed"
        | "in_production"
        | "ready"
        | "completed"
        | "cancelled"
      page_count_method: "exact" | "estimated" | "pending_confirmation"
      payment_method: "pix" | "card" | "cash"
      payment_status: "pending_contact" | "paid" | "rejected" | "cancelled"
      service_commercial_mode: "automatic_pricing" | "manual_quote"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      admin_role: ["super_admin", "admin", "producao", "catalogo"],
      cart_item_type: ["service", "product"],
      catalog_state: ["draft", "review", "published", "inactive"],
      delivery_type: ["pickup", "delivery"],
      field_type: ["select", "radio", "number", "text", "textarea", "checkbox"],
      file_status: [
        "intended",
        "uploading",
        "processing",
        "ready",
        "rejected",
        "expired",
        "confirmed",
        "error",
        "deleted",
      ],
      file_type: ["pdf", "docx", "image", "zip", "rar", "pptx"],
      order_kind: ["legacy_checkout", "stationery_sale", "graphic_quote"],
      order_quote_actor_type: [
        "admin",
        "customer_authenticated",
        "customer_guest",
        "system",
      ],
      order_quote_event_type: [
        "issued",
        "revised",
        "accepted",
        "declined",
        "expired",
        "cancelled",
      ],
      order_quote_status: [
        "not_applicable",
        "pending",
        "negotiating",
        "quoted",
        "accepted",
        "declined",
        "expired",
        "cancelled",
      ],
      order_status: [
        "created",
        "awaiting_payment",
        "confirmed",
        "in_production",
        "ready",
        "completed",
        "cancelled",
      ],
      page_count_method: ["exact", "estimated", "pending_confirmation"],
      payment_method: ["pix", "card", "cash"],
      payment_status: ["pending_contact", "paid", "rejected", "cancelled"],
      service_commercial_mode: ["automatic_pricing", "manual_quote"],
    },
  },
} as const
