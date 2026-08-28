/**
 * Supabase Database Types
 *
 * This file should be generated via:
 * npx supabase gen types typescript --project-id <project-id> > src/types/supabase.ts
 *
 * DO NOT edit manually.
 * Run the command above after any schema change.
 *
 * Until the Supabase project is connected, this placeholder
 * defines the Database interface matching migration_001_initial.sql.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      categories: {
        Row: {
          id: string;
          name: string;
          slug: string;
          description: string | null;
          image_url: string | null;
          parent_id: string | null;
          catalog_scope: string;
          is_active: boolean;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          description?: string | null;
          image_url?: string | null;
          parent_id?: string | null;
          catalog_scope?: string;
          is_active?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          description?: string | null;
          image_url?: string | null;
          parent_id?: string | null;
          catalog_scope?: string;
          is_active?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'categories_parent_id_fkey';
            columns: ['parent_id'];
            isOneToOne: false;
            referencedRelation: 'categories';
            referencedColumns: ['id'];
          }
        ];
      };
      products: {
        Row: {
          id: string;
          category_id: string | null;
          name: string;
          slug: string;
          description: string | null;
          image_url: string | null;
          sku: string | null;
          unit_label: string | null;
          package_quantity: number;
          price: number;
          price_cents: number;
          stock_quantity: number | null;
          stock_control_enabled: boolean;
          reserved_quantity: number;
          is_active: boolean;
          sort_order: number;
          deleted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          category_id?: string | null;
          name: string;
          slug: string;
          description?: string | null;
          image_url?: string | null;
          sku?: string | null;
          unit_label?: string | null;
          package_quantity?: number;
          price?: number;
          price_cents: number;
          stock_quantity?: number | null;
          stock_control_enabled?: boolean;
          reserved_quantity?: number;
          is_active?: boolean;
          sort_order?: number;
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          category_id?: string | null;
          name?: string;
          slug?: string;
          description?: string | null;
          image_url?: string | null;
          sku?: string | null;
          unit_label?: string | null;
          package_quantity?: number;
          price?: number;
          price_cents?: number;
          stock_quantity?: number | null;
          stock_control_enabled?: boolean;
          reserved_quantity?: number;
          is_active?: boolean;
          sort_order?: number;
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'products_category_id_fkey';
            columns: ['category_id'];
            isOneToOne: false;
            referencedRelation: 'categories';
            referencedColumns: ['id'];
          }
        ];
      };
      product_categories: {
        Row: {
          product_id: string;
          category_id: string;
          created_at: string;
        };
        Insert: {
          product_id: string;
          category_id: string;
          created_at?: string;
        };
        Update: {
          product_id?: string;
          category_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'product_categories_product_id_fkey';
            columns: ['product_id'];
            isOneToOne: false;
            referencedRelation: 'products';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'product_categories_category_id_fkey';
            columns: ['category_id'];
            isOneToOne: false;
            referencedRelation: 'categories';
            referencedColumns: ['id'];
          }
        ];
      };
      product_inventory_reservations: {
        Row: {
          id: string;
          order_id: string;
          product_id: string;
          quantity: number;
          status: string;
          reason: string | null;
          created_at: string;
          finalized_at: string | null;
        };
        Insert: {
          id?: string;
          order_id: string;
          product_id: string;
          quantity: number;
          status?: string;
          reason?: string | null;
          created_at?: string;
          finalized_at?: string | null;
        };
        Update: {
          id?: string;
          order_id?: string;
          product_id?: string;
          quantity?: number;
          status?: string;
          reason?: string | null;
          created_at?: string;
          finalized_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'product_inventory_reservations_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'orders';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'product_inventory_reservations_product_id_fkey';
            columns: ['product_id'];
            isOneToOne: false;
            referencedRelation: 'products';
            referencedColumns: ['id'];
          }
        ];
      };
      services: {
        Row: {
          id: string;
          category_id: string | null;
          name: string;
          slug: string;
          description: string | null;
          image_url: string | null;
          base_price: number;
          base_price_cents: number;
          pricing_fallback_behavior: string;
          pricing_version: number;
          pricing_profile: string;
          pricing_profile_config: Json;
          catalog_state: Database['public']['Enums']['catalog_state'];
          catalog_version: number;
          catalog_updated_by: string | null;
          reviewed_at: string | null;
          published_at: string | null;
          is_active: boolean;
          sort_order: number;
          deleted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          category_id?: string | null;
          name: string;
          slug: string;
          description?: string | null;
          image_url?: string | null;
          base_price?: number;
          base_price_cents: number;
          pricing_fallback_behavior?: string;
          pricing_version?: number;
          pricing_profile?: string;
          pricing_profile_config?: Json;
          catalog_state?: Database['public']['Enums']['catalog_state'];
          catalog_version?: number;
          catalog_updated_by?: string | null;
          reviewed_at?: string | null;
          published_at?: string | null;
          is_active?: boolean;
          sort_order?: number;
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          category_id?: string | null;
          name?: string;
          slug?: string;
          description?: string | null;
          image_url?: string | null;
          base_price?: number;
          base_price_cents?: number;
          pricing_fallback_behavior?: string;
          pricing_version?: number;
          pricing_profile?: string;
          pricing_profile_config?: Json;
          catalog_state?: Database['public']['Enums']['catalog_state'];
          catalog_version?: number;
          catalog_updated_by?: string | null;
          reviewed_at?: string | null;
          published_at?: string | null;
          is_active?: boolean;
          sort_order?: number;
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'services_category_id_fkey';
            columns: ['category_id'];
            isOneToOne: false;
            referencedRelation: 'categories';
            referencedColumns: ['id'];
          }
        ];
      };
      service_fields: {
        Row: {
          id: string;
          service_id: string;
          key: string;
          label: string;
          field_type: Database['public']['Enums']['field_type'];
          options: Json;
          is_required: boolean;
          sort_order: number;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          service_id: string;
          key: string;
          label: string;
          field_type: Database['public']['Enums']['field_type'];
          options?: Json;
          is_required?: boolean;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          service_id?: string;
          key?: string;
          label?: string;
          field_type?: Database['public']['Enums']['field_type'];
          options?: Json;
          is_required?: boolean;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'service_fields_service_id_fkey';
            columns: ['service_id'];
            isOneToOne: false;
            referencedRelation: 'services';
            referencedColumns: ['id'];
          }
        ];
      };
      service_field_option_dependencies: {
        Row: {
          id: string;
          service_id: string;
          source_field_id: string;
          source_option_value: string;
          source_conditions: Json;
          target_field_id: string;
          target_option_value: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          service_id: string;
          source_field_id: string;
          source_option_value: string;
          source_conditions?: Json;
          target_field_id: string;
          target_option_value: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          service_id?: string;
          source_field_id?: string;
          source_option_value?: string;
          source_conditions?: Json;
          target_field_id?: string;
          target_option_value?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'service_field_option_dependencies_service_id_fkey';
            columns: ['service_id'];
            isOneToOne: false;
            referencedRelation: 'services';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'service_field_option_dependencies_source_field_id_fkey';
            columns: ['source_field_id'];
            isOneToOne: false;
            referencedRelation: 'service_fields';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'service_field_option_dependencies_target_field_id_fkey';
            columns: ['target_field_id'];
            isOneToOne: false;
            referencedRelation: 'service_fields';
            referencedColumns: ['id'];
          }
        ];
      };
      attribute_groups: {
        Row: {
          id: string;
          name: string;
          is_active: boolean;
          sort_order: number;
        };
        Insert: {
          id?: string;
          name: string;
          is_active?: boolean;
          sort_order?: number;
        };
        Update: {
          id?: string;
          name?: string;
          is_active?: boolean;
          sort_order?: number;
        };
        Relationships: [];
      };
      attributes: {
        Row: {
          id: string;
          group_id: string;
          name: string;
          is_active: boolean;
          sort_order: number;
        };
        Insert: {
          id?: string;
          group_id: string;
          name: string;
          is_active?: boolean;
          sort_order?: number;
        };
        Update: {
          id?: string;
          group_id?: string;
          name?: string;
          is_active?: boolean;
          sort_order?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'attributes_group_id_fkey';
            columns: ['group_id'];
            isOneToOne: false;
            referencedRelation: 'attribute_groups';
            referencedColumns: ['id'];
          }
        ];
      };
      pricing_rules: {
        Row: {
          id: string;
          service_id: string;
          name: string;
          price_per_page: number;
          price_per_page_cents: number;
          rule_version: number;
          fallback_behavior: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          service_id: string;
          name: string;
          price_per_page?: number;
          price_per_page_cents: number;
          rule_version?: number;
          fallback_behavior?: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          service_id?: string;
          name?: string;
          price_per_page?: number;
          price_per_page_cents?: number;
          rule_version?: number;
          fallback_behavior?: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'pricing_rules_service_id_fkey';
            columns: ['service_id'];
            isOneToOne: false;
            referencedRelation: 'services';
            referencedColumns: ['id'];
          }
        ];
      };
      pricing_rule_attributes: {
        Row: {
          id: string;
          pricing_rule_id: string;
          attribute_id: string | null;
          attribute_group_id: string;
        };
        Insert: {
          id?: string;
          pricing_rule_id: string;
          attribute_id?: string | null;
          attribute_group_id: string;
        };
        Update: {
          id?: string;
          pricing_rule_id?: string;
          attribute_id?: string | null;
          attribute_group_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'pricing_rule_attributes_pricing_rule_id_fkey';
            columns: ['pricing_rule_id'];
            isOneToOne: false;
            referencedRelation: 'pricing_rules';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'pricing_rule_attributes_attribute_id_fkey';
            columns: ['attribute_id'];
            isOneToOne: false;
            referencedRelation: 'attributes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'pricing_rule_attributes_attribute_group_id_fkey';
            columns: ['attribute_group_id'];
            isOneToOne: false;
            referencedRelation: 'attribute_groups';
            referencedColumns: ['id'];
          }
        ];
      };
      pricing_rule_field_conditions: {
        Row: {
          id: string;
          pricing_rule_id: string;
          service_field_id: string;
          expected_value: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          pricing_rule_id: string;
          service_field_id: string;
          expected_value?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          pricing_rule_id?: string;
          service_field_id?: string;
          expected_value?: Json | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'pricing_rule_field_conditions_pricing_rule_id_fkey';
            columns: ['pricing_rule_id'];
            isOneToOne: false;
            referencedRelation: 'pricing_rules';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'pricing_rule_field_conditions_service_field_id_fkey';
            columns: ['service_field_id'];
            isOneToOne: false;
            referencedRelation: 'service_fields';
            referencedColumns: ['id'];
          }
        ];
      };
      pricing_discounts: {
        Row: {
          id: string;
          service_id: string;
          min_quantity: number;
          max_quantity: number | null;
          discount_percent: number;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          service_id: string;
          min_quantity: number;
          max_quantity?: number | null;
          discount_percent: number;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          service_id?: string;
          min_quantity?: number;
          max_quantity?: number | null;
          discount_percent?: number;
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'pricing_discounts_service_id_fkey';
            columns: ['service_id'];
            isOneToOne: false;
            referencedRelation: 'services';
            referencedColumns: ['id'];
          }
        ];
      };
      service_binding_price_tiers: {
        Row: {
          id: string;
          service_id: string;
          min_pages: number;
          max_pages: number | null;
          price_cents: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          service_id: string;
          min_pages: number;
          max_pages?: number | null;
          price_cents: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          service_id?: string;
          min_pages?: number;
          max_pages?: number | null;
          price_cents?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'service_binding_price_tiers_service_id_fkey';
            columns: ['service_id'];
            isOneToOne: false;
            referencedRelation: 'services';
            referencedColumns: ['id'];
          }
        ];
      };
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          phone: string | null;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          phone?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string | null;
          phone?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      addresses: {
        Row: {
          id: string;
          user_id: string;
          label: string;
          street: string;
          number: string;
          complement: string | null;
          neighborhood: string;
          city: string;
          state: string;
          zip_code: string;
          is_default: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          label?: string;
          street: string;
          number: string;
          complement?: string | null;
          neighborhood: string;
          city: string;
          state: string;
          zip_code: string;
          is_default?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          label?: string;
          street?: string;
          number?: string;
          complement?: string | null;
          neighborhood?: string;
          city?: string;
          state?: string;
          zip_code?: string;
          is_default?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'addresses_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          }
        ];
      };
      admin_users: {
        Row: {
          id: string;
          full_name: string;
          role: Database['public']['Enums']['admin_role'];
          is_active: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name: string;
          role: Database['public']['Enums']['admin_role'];
          is_active?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string;
          role?: Database['public']['Enums']['admin_role'];
          is_active?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      guest_access_attempts: {
        Row: {
          id: number;
          order_code_hash: string;
          request_hash: string;
          succeeded: boolean;
          created_at: string;
        };
        Insert: {
          id?: never;
          order_code_hash: string;
          request_hash: string;
          succeeded?: boolean;
          created_at?: string;
        };
        Update: {
          id?: never;
          order_code_hash?: string;
          request_hash?: string;
          succeeded?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      orders: {
        Row: {
          id: string;
          order_number: string;
          user_id: string | null;
          guest_email: string | null;
          guest_name: string | null;
          guest_phone: string | null;
          guest_access_expires_at: string | null;
          order_token: string;
          idempotency_key: string;
          checkout_request_hash: string;
          checkout_actor_hash: string;
          status: Database['public']['Enums']['order_status'];
          delivery_type: Database['public']['Enums']['delivery_type'];
          delivery_address_snapshot: Json | null;
          delivery_fee: number;
          subtotal: number;
          total: number;
          delivery_fee_cents: number;
          subtotal_cents: number;
          total_cents: number;
          original_subtotal_cents: number;
          original_total_cents: number;
          price_version: number;
          payment_method: Database['public']['Enums']['payment_method'];
          payment_status: Database['public']['Enums']['payment_status'];
          pix_key_used: string | null;
          whatsapp_message_url: string | null;
          whatsapp_sent_at: string | null;
          notes: string | null;
          anonymized_at: string | null;
          artwork_status: 'not_required' | 'received' | 'in_review' | 'correction_requested' | 'awaiting_customer_approval' | 'approved_for_production';
          artwork_updated_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          order_number?: string;
          user_id?: string | null;
          guest_email?: string | null;
          guest_name?: string | null;
          guest_phone?: string | null;
          guest_access_expires_at?: string | null;
          order_token?: string;
          idempotency_key: string;
          checkout_request_hash: string;
          checkout_actor_hash: string;
          status?: Database['public']['Enums']['order_status'];
          delivery_type?: Database['public']['Enums']['delivery_type'];
          delivery_address_snapshot?: Json | null;
          delivery_fee?: number;
          subtotal?: number;
          total?: number;
          delivery_fee_cents: number;
          subtotal_cents: number;
          total_cents: number;
          original_subtotal_cents?: number;
          original_total_cents?: number;
          price_version?: number;
          payment_method: Database['public']['Enums']['payment_method'];
          payment_status?: Database['public']['Enums']['payment_status'];
          pix_key_used?: string | null;
          whatsapp_message_url?: string | null;
          whatsapp_sent_at?: string | null;
          notes?: string | null;
          anonymized_at?: string | null;
          artwork_status?: 'not_required' | 'received' | 'in_review' | 'correction_requested' | 'awaiting_customer_approval' | 'approved_for_production';
          artwork_updated_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          order_number?: string;
          user_id?: string | null;
          guest_email?: string | null;
          guest_name?: string | null;
          guest_phone?: string | null;
          guest_access_expires_at?: string | null;
          order_token?: string;
          idempotency_key?: string;
          checkout_request_hash?: string;
          checkout_actor_hash?: string;
          status?: Database['public']['Enums']['order_status'];
          delivery_type?: Database['public']['Enums']['delivery_type'];
          delivery_address_snapshot?: Json | null;
          delivery_fee?: number;
          subtotal?: number;
          total?: number;
          delivery_fee_cents?: number;
          subtotal_cents?: number;
          total_cents?: number;
          original_subtotal_cents?: number;
          original_total_cents?: number;
          price_version?: number;
          payment_method?: Database['public']['Enums']['payment_method'];
          payment_status?: Database['public']['Enums']['payment_status'];
          pix_key_used?: string | null;
          whatsapp_message_url?: string | null;
          whatsapp_sent_at?: string | null;
          notes?: string | null;
          anonymized_at?: string | null;
          artwork_status?: 'not_required' | 'received' | 'in_review' | 'correction_requested' | 'awaiting_customer_approval' | 'approved_for_production';
          artwork_updated_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'orders_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          }
        ];
      };
      order_items: {
        Row: {
          id: string;
          order_id: string;
          service_id: string | null;
          product_id: string | null;
          service_name_snapshot: string | null;
          service_description_snapshot: string | null;
          product_name_snapshot: string | null;
          fields_snapshot: Json;
          quantity: number;
          pages_count: number;
          pages_method: Database['public']['Enums']['page_count_method'];
          is_double_sided: boolean;
          unit_price: number;
          total_price: number;
          unit_price_cents: number;
          total_price_cents: number;
          original_total_price_cents: number;
          discount_cents: number;
          pricing_rule_id: string | null;
          pricing_rule_snapshot: Json | null;
          discount_applied: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          service_id?: string | null;
          product_id?: string | null;
          service_name_snapshot?: string | null;
          service_description_snapshot?: string | null;
          product_name_snapshot?: string | null;
          fields_snapshot?: Json;
          quantity?: number;
          pages_count?: number;
          pages_method?: Database['public']['Enums']['page_count_method'];
          is_double_sided?: boolean;
          unit_price?: number;
          total_price?: number;
          unit_price_cents: number;
          total_price_cents: number;
          original_total_price_cents?: number;
          discount_cents: number;
          pricing_rule_id?: string | null;
          pricing_rule_snapshot?: Json | null;
          discount_applied?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          order_id?: string;
          service_id?: string | null;
          product_id?: string | null;
          service_name_snapshot?: string | null;
          service_description_snapshot?: string | null;
          product_name_snapshot?: string | null;
          fields_snapshot?: Json;
          quantity?: number;
          pages_count?: number;
          pages_method?: Database['public']['Enums']['page_count_method'];
          is_double_sided?: boolean;
          unit_price?: number;
          total_price?: number;
          unit_price_cents?: number;
          total_price_cents?: number;
          original_total_price_cents?: number;
          discount_cents?: number;
          pricing_rule_id?: string | null;
          pricing_rule_snapshot?: Json | null;
          discount_applied?: number | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'order_items_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'orders';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'order_items_service_id_fkey';
            columns: ['service_id'];
            isOneToOne: false;
            referencedRelation: 'services';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'order_items_product_id_fkey';
            columns: ['product_id'];
            isOneToOne: false;
            referencedRelation: 'products';
            referencedColumns: ['id'];
          }
        ];
      };
      order_price_adjustments: {
        Row: {
          id: string;
          order_id: string;
          order_item_id: string;
          admin_user_id: string | null;
          idempotency_key: string;
          previous_item_total_cents: number;
          new_item_total_cents: number;
          previous_order_subtotal_cents: number;
          new_order_subtotal_cents: number;
          previous_order_total_cents: number;
          new_order_total_cents: number;
          reason: string;
          order_version_before: number;
          order_version_after: number;
          catalog_version: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          order_item_id: string;
          admin_user_id?: string | null;
          idempotency_key: string;
          previous_item_total_cents: number;
          new_item_total_cents: number;
          previous_order_subtotal_cents: number;
          new_order_subtotal_cents: number;
          previous_order_total_cents: number;
          new_order_total_cents: number;
          reason: string;
          order_version_before: number;
          order_version_after: number;
          catalog_version?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          order_id?: string;
          order_item_id?: string;
          admin_user_id?: string | null;
          idempotency_key?: string;
          previous_item_total_cents?: number;
          new_item_total_cents?: number;
          previous_order_subtotal_cents?: number;
          new_order_subtotal_cents?: number;
          previous_order_total_cents?: number;
          new_order_total_cents?: number;
          reason?: string;
          order_version_before?: number;
          order_version_after?: number;
          catalog_version?: number | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'order_price_adjustments_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'orders';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'order_price_adjustments_order_item_id_fkey';
            columns: ['order_item_id'];
            isOneToOne: false;
            referencedRelation: 'order_items';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'order_price_adjustments_admin_user_id_fkey';
            columns: ['admin_user_id'];
            isOneToOne: false;
            referencedRelation: 'admin_users';
            referencedColumns: ['id'];
          }
        ];
      };
      order_file_preflight_reports: {
        Row: {
          id: string;
          order_id: string;
          order_file_id: string;
          order_item_id: string | null;
          file_content_sha256: string;
          status: 'pending_review' | 'correction_requested' | 'awaiting_customer_approval' | 'approved_for_production' | 'superseded';
          automation_summary: Json;
          structure_summary: Json;
          graphics_summary: Json;
          findings: Json;
          customer_approval_required: boolean;
          staff_note: string | null;
          reviewed_by: string | null;
          reviewed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          order_file_id: string;
          order_item_id?: string | null;
          file_content_sha256: string;
          status?: 'pending_review' | 'correction_requested' | 'awaiting_customer_approval' | 'approved_for_production' | 'superseded';
          automation_summary?: Json;
          structure_summary?: Json;
          graphics_summary?: Json;
          findings?: Json;
          customer_approval_required?: boolean;
          staff_note?: string | null;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          order_id?: string;
          order_file_id?: string;
          order_item_id?: string | null;
          file_content_sha256?: string;
          status?: 'pending_review' | 'correction_requested' | 'awaiting_customer_approval' | 'approved_for_production' | 'superseded';
          automation_summary?: Json;
          structure_summary?: Json;
          graphics_summary?: Json;
          findings?: Json;
          customer_approval_required?: boolean;
          staff_note?: string | null;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          { foreignKeyName: 'order_file_preflight_reports_order_id_fkey'; columns: ['order_id']; isOneToOne: false; referencedRelation: 'orders'; referencedColumns: ['id']; },
          { foreignKeyName: 'order_file_preflight_reports_order_file_id_fkey'; columns: ['order_file_id']; isOneToOne: false; referencedRelation: 'order_files'; referencedColumns: ['id']; },
          { foreignKeyName: 'order_file_preflight_reports_order_item_id_fkey'; columns: ['order_item_id']; isOneToOne: false; referencedRelation: 'order_items'; referencedColumns: ['id']; },
          { foreignKeyName: 'order_file_preflight_reports_reviewed_by_fkey'; columns: ['reviewed_by']; isOneToOne: false; referencedRelation: 'admin_users'; referencedColumns: ['id']; }
        ];
      };
      order_artwork_approvals: {
        Row: {
          id: string;
          order_id: string;
          report_id: string;
          order_file_id: string;
          approved_file_sha256: string;
          decision: 'approved' | 'correction_requested';
          approved_by_user_id: string | null;
          guest_email: string | null;
          note: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          report_id: string;
          order_file_id: string;
          approved_file_sha256: string;
          decision: 'approved' | 'correction_requested';
          approved_by_user_id?: string | null;
          guest_email?: string | null;
          note?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          order_id?: string;
          report_id?: string;
          order_file_id?: string;
          approved_file_sha256?: string;
          decision?: 'approved' | 'correction_requested';
          approved_by_user_id?: string | null;
          guest_email?: string | null;
          note?: string | null;
          created_at?: string;
        };
        Relationships: [
          { foreignKeyName: 'order_artwork_approvals_order_id_fkey'; columns: ['order_id']; isOneToOne: false; referencedRelation: 'orders'; referencedColumns: ['id']; },
          { foreignKeyName: 'order_artwork_approvals_report_id_fkey'; columns: ['report_id']; isOneToOne: false; referencedRelation: 'order_file_preflight_reports'; referencedColumns: ['id']; },
          { foreignKeyName: 'order_artwork_approvals_order_file_id_fkey'; columns: ['order_file_id']; isOneToOne: false; referencedRelation: 'order_files'; referencedColumns: ['id']; }
        ];
      };
      order_files: {
        Row: {
          id: string;
          order_id: string | null;
          order_item_id: string | null;
          user_id: string | null;
          original_name: string;
          storage_path: string | null;
          mime_type: string;
          file_type: Database['public']['Enums']['file_type'];
          size_bytes: number;
          page_count: number;
          page_count_method: Database['public']['Enums']['page_count_method'];
          is_suspicious: boolean;
          status: Database['public']['Enums']['file_status'];
          expires_at: string | null;
          deleted_at: string | null;
          created_at: string;
          updated_at: string;
          ownership_version: number;
          guest_owner_hash: string | null;
          safe_name: string | null;
          declared_mime_type: string | null;
          detected_mime_type: string | null;
          content_sha256: string | null;
          intent_expires_at: string | null;
          processing_started_at: string | null;
          ready_at: string | null;
          rejected_at: string | null;
          rejection_code: string | null;
          processing_metadata: Json;
          cleanup_required: boolean;
          storage_deleted_at: string | null;
          last_accessed_at: string | null;
          access_count: number;
        };
        Insert: {
          id?: string;
          order_id?: string | null;
          order_item_id?: string | null;
          user_id?: string | null;
          original_name: string;
          storage_path?: string | null;
          mime_type: string;
          file_type: Database['public']['Enums']['file_type'];
          size_bytes?: number;
          page_count?: number;
          page_count_method?: Database['public']['Enums']['page_count_method'];
          is_suspicious?: boolean;
          status?: Database['public']['Enums']['file_status'];
          expires_at?: string | null;
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
          ownership_version?: number;
          guest_owner_hash?: string | null;
          safe_name?: string | null;
          declared_mime_type?: string | null;
          detected_mime_type?: string | null;
          content_sha256?: string | null;
          intent_expires_at?: string | null;
          processing_started_at?: string | null;
          ready_at?: string | null;
          rejected_at?: string | null;
          rejection_code?: string | null;
          processing_metadata?: Json;
          cleanup_required?: boolean;
          storage_deleted_at?: string | null;
          last_accessed_at?: string | null;
          access_count?: number;
        };
        Update: {
          id?: string;
          order_id?: string | null;
          order_item_id?: string | null;
          user_id?: string | null;
          original_name?: string;
          storage_path?: string | null;
          mime_type?: string;
          file_type?: Database['public']['Enums']['file_type'];
          size_bytes?: number;
          page_count?: number;
          page_count_method?: Database['public']['Enums']['page_count_method'];
          is_suspicious?: boolean;
          status?: Database['public']['Enums']['file_status'];
          expires_at?: string | null;
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
          ownership_version?: number;
          guest_owner_hash?: string | null;
          safe_name?: string | null;
          declared_mime_type?: string | null;
          detected_mime_type?: string | null;
          content_sha256?: string | null;
          intent_expires_at?: string | null;
          processing_started_at?: string | null;
          ready_at?: string | null;
          rejected_at?: string | null;
          rejection_code?: string | null;
          processing_metadata?: Json;
          cleanup_required?: boolean;
          storage_deleted_at?: string | null;
          last_accessed_at?: string | null;
          access_count?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'order_files_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'orders';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'order_files_order_item_id_fkey';
            columns: ['order_item_id'];
            isOneToOne: false;
            referencedRelation: 'order_items';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'order_files_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          }
        ];
      };
      file_access_audit: {
        Row: {
          id: string;
          file_id: string | null;
          actor_user_id: string | null;
          actor_admin_id: string | null;
          purpose: string;
          outcome: string;
          request_id: string | null;
          expires_in_seconds: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          file_id?: string | null;
          actor_user_id?: string | null;
          actor_admin_id?: string | null;
          purpose: string;
          outcome: string;
          request_id?: string | null;
          expires_in_seconds?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          file_id?: string | null;
          actor_user_id?: string | null;
          actor_admin_id?: string | null;
          purpose?: string;
          outcome?: string;
          request_id?: string | null;
          expires_in_seconds?: number | null;
          created_at?: string;
        };
        Relationships: [];
      };
      file_retention_runs: {
        Row: {
          id: string;
          run_key: string;
          mode: string;
          status: string;
          eligible_count: number;
          expired_intent_count: number;
          details: Json;
          started_at: string;
          completed_at: string;
        };
        Insert: {
          id?: string;
          run_key: string;
          mode?: string;
          status: string;
          eligible_count?: number;
          expired_intent_count?: number;
          details?: Json;
          started_at?: string;
          completed_at?: string;
        };
        Update: {
          id?: string;
          run_key?: string;
          mode?: string;
          status?: string;
          eligible_count?: number;
          expired_intent_count?: number;
          details?: Json;
          started_at?: string;
          completed_at?: string;
        };
        Relationships: [];
      };
      order_status_communications: {
        Row: {
          id: string;
          order_id: string;
          admin_user_id: string | null;
          idempotency_key: string;
          channel: 'whatsapp';
          status_to: Database['public']['Enums']['order_status'];
          template_key: string;
          opened_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          admin_user_id?: string | null;
          idempotency_key: string;
          channel: 'whatsapp';
          status_to: Database['public']['Enums']['order_status'];
          template_key: string;
          opened_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          order_id?: string;
          admin_user_id?: string | null;
          idempotency_key?: string;
          channel?: 'whatsapp';
          status_to?: Database['public']['Enums']['order_status'];
          template_key?: string;
          opened_at?: string;
          created_at?: string;
        };
        Relationships: [
          { foreignKeyName: 'order_status_communications_order_id_fkey'; columns: ['order_id']; isOneToOne: false; referencedRelation: 'orders'; referencedColumns: ['id']; },
          { foreignKeyName: 'order_status_communications_admin_user_id_fkey'; columns: ['admin_user_id']; isOneToOne: false; referencedRelation: 'admin_users'; referencedColumns: ['id']; }
        ];
      };
      order_contact_outbox: {
        Row: {
          id: string;
          order_id: string;
          idempotency_key: string;
          effect_type: string;
          status: string;
          payload: Json;
          created_at: string;
          opened_at: string | null;
          last_error: string | null;
        };
        Insert: {
          id?: string;
          order_id: string;
          idempotency_key: string;
          effect_type: string;
          status?: string;
          payload: Json;
          created_at?: string;
          opened_at?: string | null;
          last_error?: string | null;
        };
        Update: {
          id?: string;
          order_id?: string;
          idempotency_key?: string;
          effect_type?: string;
          status?: string;
          payload?: Json;
          created_at?: string;
          opened_at?: string | null;
          last_error?: string | null;
        };
        Relationships: [];
      };
      order_payment_events: {
        Row: {
          id: string;
          order_id: string;
          admin_user_id: string;
          idempotency_key: string;
          from_status: Database['public']['Enums']['payment_status'];
          to_status: Database['public']['Enums']['payment_status'];
          note: string;
          external_reference: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          admin_user_id: string;
          idempotency_key: string;
          from_status: Database['public']['Enums']['payment_status'];
          to_status: Database['public']['Enums']['payment_status'];
          note: string;
          external_reference?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          order_id?: string;
          admin_user_id?: string;
          idempotency_key?: string;
          from_status?: Database['public']['Enums']['payment_status'];
          to_status?: Database['public']['Enums']['payment_status'];
          note?: string;
          external_reference?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      order_events: {
        Row: {
          id: string;
          order_id: string;
          admin_user_id: string | null;
          from_status: Database['public']['Enums']['order_status'] | null;
          to_status: Database['public']['Enums']['order_status'];
          note: string | null;
          idempotency_key: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          admin_user_id?: string | null;
          from_status?: Database['public']['Enums']['order_status'] | null;
          to_status: Database['public']['Enums']['order_status'];
          note?: string | null;
          idempotency_key?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          order_id?: string;
          admin_user_id?: string | null;
          from_status?: Database['public']['Enums']['order_status'] | null;
          to_status?: Database['public']['Enums']['order_status'];
          note?: string | null;
          idempotency_key?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'order_events_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'orders';
            referencedColumns: ['id'];
          }
        ];
      };
      favorite_orders: {
        Row: {
          id: string;
          user_id: string;
          order_id: string;
          name: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          order_id: string;
          name?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          order_id?: string;
          name?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'favorite_orders_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'favorite_orders_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'orders';
            referencedColumns: ['id'];
          }
        ];
      };
      cart_items: {
        Row: {
          id: string;
          user_id: string;
          item_type: Database['public']['Enums']['cart_item_type'];
          reference_id: string;
          selected_options: Json;
          file_ids: string[];
          quantity: number;
          is_double_sided: boolean;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          item_type: Database['public']['Enums']['cart_item_type'];
          reference_id: string;
          selected_options?: Json;
          file_ids?: string[];
          quantity?: number;
          is_double_sided?: boolean;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          item_type?: Database['public']['Enums']['cart_item_type'];
          reference_id?: string;
          selected_options?: Json;
          file_ids?: string[];
          quantity?: number;
          is_double_sided?: boolean;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'cart_items_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          }
        ];
      };
      system_config: {
        Row: {
          key: string;
          value: Json;
          description: string | null;
          updated_by: string | null;
          updated_at: string;
        };
        Insert: {
          key: string;
          value: Json;
          description?: string | null;
          updated_by?: string | null;
          updated_at?: string;
        };
        Update: {
          key?: string;
          value?: Json;
          description?: string | null;
          updated_by?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      store_settings: {
        Row: {
          key: string;
          value: Json;
          value_type: string;
          value_schema: Json;
          description: string | null;
          allowed_roles: Database['public']['Enums']['admin_role'][];
          is_sensitive: boolean;
          updated_by: string | null;
          updated_at: string;
        };
        Insert: {
          key: string;
          value: Json;
          value_type: string;
          value_schema?: Json;
          description?: string | null;
          allowed_roles: Database['public']['Enums']['admin_role'][];
          is_sensitive?: boolean;
          updated_by?: string | null;
          updated_at?: string;
        };
        Update: {
          key?: string;
          value?: Json;
          value_type?: string;
          value_schema?: Json;
          description?: string | null;
          allowed_roles?: Database['public']['Enums']['admin_role'][];
          is_sensitive?: boolean;
          updated_by?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'store_settings_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'admin_users';
            referencedColumns: ['id'];
          }
        ];
      };
      audit_logs: {
        Row: {
          id: string;
          admin_user_id: string | null;
          action: string;
          entity: string;
          entity_id: string | null;
          old_value: Json | null;
          new_value: Json | null;
          ip_address: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          admin_user_id?: string | null;
          action: string;
          entity: string;
          entity_id?: string | null;
          old_value?: Json | null;
          new_value?: Json | null;
          ip_address?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          admin_user_id?: string | null;
          action?: string;
          entity?: string;
          entity_id?: string | null;
          old_value?: Json | null;
          new_value?: Json | null;
          ip_address?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      commit_checkout: {
        Args: {
          p_idempotency_key: string;
          p_request_hash: string;
          p_user_id: string | null;
          p_guest_email: string | null;
          p_guest_upload_session_hash: string | null;
          p_order: Json;
          p_items: Json;
          p_file_ids: string[];
        };
        Returns: {
          order_id: string;
          order_number: string;
          order_code: string;
          total_cents: number;
          payment_method: Database['public']['Enums']['payment_method'];
          replayed: boolean;
        }[];
      };
      process_manual_payment: {
        Args: {
          p_order_id: string;
          p_admin_user_id: string;
          p_action: string;
          p_note: string;
          p_external_reference: string | null;
          p_idempotency_key: string;
        };
        Returns: {
          order_id: string;
          order_status: Database['public']['Enums']['order_status'];
          payment_status: Database['public']['Enums']['payment_status'];
          replayed: boolean;
        }[];
      };
      adjust_order_item_price: {
        Args: {
          p_order_id: string;
          p_order_item_id: string;
          p_admin_user_id: string;
          p_new_total_cents: number;
          p_reason: string;
          p_idempotency_key: string;
          p_expected_order_version: number;
        };
        Returns: {
          order_id: string;
          subtotal_cents: number;
          total_cents: number;
          replayed: boolean;
        }[];
      };
      replace_service_field_option_dependencies: {
        Args: {
          p_service_id: string;
          p_root_field_id: string;
          p_root_option_value: string;
          p_dependencies: Json;
        };
        Returns: number;
      };
      replace_product_categories: {
        Args: {
          p_product_id: string;
          p_category_ids: string[];
        };
        Returns: undefined;
      };
      transition_order_status: {
        Args: {
          p_order_id: string;
          p_admin_user_id: string;
          p_to_status: Database['public']['Enums']['order_status'];
          p_note: string;
          p_idempotency_key: string;
          p_allow_unpaid_confirmation?: boolean;
        };
        Returns: {
          order_id: string;
          order_status: Database['public']['Enums']['order_status'];
          replayed: boolean;
        }[];
      };
    };
    Enums: {
      order_status: 'created' | 'awaiting_payment' | 'confirmed' | 'in_production' | 'ready' | 'completed' | 'cancelled';
      delivery_type: 'pickup' | 'delivery';
      admin_role: 'super_admin' | 'admin' | 'producao' | 'catalogo';
      file_status: 'intended' | 'uploading' | 'processing' | 'ready' | 'rejected' | 'expired' | 'confirmed' | 'error' | 'deleted';
      file_type: 'pdf' | 'docx' | 'pptx' | 'image' | 'zip' | 'rar';
      page_count_method: 'exact' | 'estimated' | 'pending_confirmation';
      payment_method: 'pix' | 'card' | 'cash';
      payment_status: 'pending_contact' | 'paid' | 'rejected' | 'cancelled';
      field_type: 'select' | 'radio' | 'number' | 'text' | 'textarea' | 'checkbox';
      cart_item_type: 'service' | 'product';
      catalog_state: 'draft' | 'review' | 'published' | 'inactive';
    };
    CompositeTypes: Record<string, never>;
  };
}
