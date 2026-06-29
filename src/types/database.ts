export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRole = "client" | "admin";

export interface Database {
  public: {
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          contact_number: string | null;
          role: UserRole;
          disabled: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          contact_number?: string | null;
          role?: UserRole;
          disabled?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          contact_number?: string | null;
          role?: UserRole;
          disabled?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      projects: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          description: string | null;
          location_lat: number | null;
          location_lng: number | null;
          location_address: string | null;
          status: "draft" | "reviewing" | "quoted" | "accepted" | "in_progress" | "completed";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          description?: string | null;
          location_lat?: number | null;
          location_lng?: number | null;
          location_address?: string | null;
          status?: "draft" | "reviewing" | "quoted" | "accepted" | "in_progress" | "completed";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          title?: string;
          description?: string | null;
          location_lat?: number | null;
          location_lng?: number | null;
          location_address?: string | null;
          status?: "draft" | "reviewing" | "quoted" | "accepted" | "in_progress" | "completed";
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "projects_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      uploads: {
        Row: {
          id: string;
          project_id: string;
          user_id: string;
          file_name: string;
          file_type: string;
          file_size: number;
          storage_path: string;
          public_url: string;
          category: "image" | "document" | "drawing" | "permit";
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          user_id: string;
          file_name: string;
          file_type: string;
          file_size: number;
          storage_path: string;
          public_url: string;
          category: "image" | "document" | "drawing" | "permit";
          created_at?: string;
        };
        Update: {
          file_name?: string;
          category?: "image" | "document" | "drawing" | "permit";
        };
        Relationships: [
          {
            foreignKeyName: "uploads_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "uploads_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      quotations: {
        Row: {
          id: string;
          project_id: string;
          user_id: string;
          materials: Json;
          total_cost: number;
          ai_analysis: string | null;
          status: "pending" | "generated" | "approved" | "rejected";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          user_id: string;
          materials?: Json;
          total_cost?: number;
          ai_analysis?: string | null;
          status?: "pending" | "generated" | "approved" | "rejected";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          materials?: Json;
          total_cost?: number;
          ai_analysis?: string | null;
          status?: "pending" | "generated" | "approved" | "rejected";
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "quotations_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "quotations_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          message: string;
          read: boolean;
          link: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          message: string;
          read?: boolean;
          link?: string | null;
          created_at?: string;
        };
        Update: {
          read?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      chat_messages: {
        Row: {
          id: string;
          user_id: string;
          session_id: string;
          role: "user" | "assistant";
          content: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          session_id: string;
          role: "user" | "assistant";
          content: string;
          created_at?: string;
        };
        Update: {};
        Relationships: [
          {
            foreignKeyName: "chat_messages_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      time_slots: {
        Row: {
          id: string;
          start_time: string;
          end_time: string;
          capacity: number;
          booked_count: number;
          description: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          start_time: string;
          end_time: string;
          capacity?: number;
          booked_count?: number;
          description?: string | null;
          created_at?: string;
        };
        Update: {
          start_time?: string;
          end_time?: string;
          capacity?: number;
          booked_count?: number;
          description?: string | null;
        };
        Relationships: [];
      };
      bookings: {
        Row: {
          id: string;
          user_id: string;
          time_slot_id: string;
          status: "confirmed" | "cancelled";
          reminder_sent: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          time_slot_id: string;
          status?: "confirmed" | "cancelled";
          reminder_sent?: boolean;
          created_at?: string;
        };
        Update: {
          status?: "confirmed" | "cancelled";
          reminder_sent?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "bookings_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bookings_time_slot_id_fkey";
            columns: ["time_slot_id"];
            isOneToOne: false;
            referencedRelation: "time_slots";
            referencedColumns: ["id"];
          }
        ];
      };
      audit_log: {
        Row: {
          id: string;
          admin_id: string;
          action: string;
          target_id: string | null;
          details: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          admin_id: string;
          action: string;
          target_id?: string | null;
          details?: Json | null;
          created_at?: string;
        };
        Update: {};
        Relationships: [
          {
            foreignKeyName: "audit_log_admin_id_fkey";
            columns: ["admin_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
    };
  };
}
