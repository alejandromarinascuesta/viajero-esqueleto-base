export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      descartes: {
        Row: {
          creado_en: string | null;
          destino_id: string | null;
          id: number;
          motivo_agente: string | null;
          recomendacion_id: number | null;
        };
        Insert: {
          creado_en?: string | null;
          destino_id?: string | null;
          id?: number;
          motivo_agente?: string | null;
          recomendacion_id?: number | null;
        };
        Update: {
          creado_en?: string | null;
          destino_id?: string | null;
          id?: number;
          motivo_agente?: string | null;
          recomendacion_id?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "descartes_destino_id_fkey";
            columns: ["destino_id"];
            isOneToOne: false;
            referencedRelation: "experiencias";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "descartes_recomendacion_id_fkey";
            columns: ["recomendacion_id"];
            isOneToOne: false;
            referencedRelation: "recomendaciones";
            referencedColumns: ["id"];
          },
        ];
      };
      experiencias: {
        Row: {
          apto_ninos: string;
          creado_en: string | null;
          cupo: number;
          destino: string;
          horas_vuelo: number;
          id: string;
          intensidad: number;
          lat: number;
          lon: number;
          margen_pct: number;
          motivo_1: string | null;
          motivo_2: string | null;
          motivo_3: string | null;
          no_recomendado_si: string | null;
          noches: number;
          nombre: string;
          pais: string;
          precio_desde_pp: number;
          temporada_agencia: string;
          tipo: string;
          visado: string;
        };
        Insert: {
          apto_ninos: string;
          creado_en?: string | null;
          cupo: number;
          destino: string;
          horas_vuelo: number;
          id: string;
          intensidad: number;
          lat: number;
          lon: number;
          margen_pct: number;
          motivo_1?: string | null;
          motivo_2?: string | null;
          motivo_3?: string | null;
          no_recomendado_si?: string | null;
          noches: number;
          nombre: string;
          pais: string;
          precio_desde_pp: number;
          temporada_agencia: string;
          tipo: string;
          visado: string;
        };
        Update: {
          apto_ninos?: string;
          creado_en?: string | null;
          cupo?: number;
          destino?: string;
          horas_vuelo?: number;
          id?: string;
          intensidad?: number;
          lat?: number;
          lon?: number;
          margen_pct?: number;
          motivo_1?: string | null;
          motivo_2?: string | null;
          motivo_3?: string | null;
          no_recomendado_si?: string | null;
          noches?: number;
          nombre?: string;
          pais?: string;
          precio_desde_pp?: number;
          temporada_agencia?: string;
          tipo?: string;
          visado?: string;
        };
        Relationships: [];
      };
      pesos: {
        Row: {
          clave: string;
          editado_en: string | null;
          valor: number;
        };
        Insert: {
          clave: string;
          editado_en?: string | null;
          valor: number;
        };
        Update: {
          clave?: string;
          editado_en?: string | null;
          valor?: number;
        };
        Relationships: [];
      };
      recomendaciones: {
        Row: {
          candidatas: number;
          creado_en: string | null;
          id: number;
          perfil: Json;
          propuestas: Json;
          supervivientes: number;
          traza: Json | null;
        };
        Insert: {
          candidatas: number;
          creado_en?: string | null;
          id?: number;
          perfil: Json;
          propuestas: Json;
          supervivientes: number;
          traza?: Json | null;
        };
        Update: {
          candidatas?: number;
          creado_en?: string | null;
          id?: number;
          perfil?: Json;
          propuestas?: Json;
          supervivientes?: number;
          traza?: Json | null;
        };
        Relationships: [];
      };
      senales: {
        Row: {
          destino_id: string;
          estado: string;
          fuente: string;
          id: number;
          metrica: string;
          obtenido_en: string;
          periodo: string;
          valor: number | null;
          valor_bruto: Json | null;
        };
        Insert: {
          destino_id: string;
          estado?: string;
          fuente: string;
          id?: number;
          metrica: string;
          obtenido_en?: string;
          periodo: string;
          valor?: number | null;
          valor_bruto?: Json | null;
        };
        Update: {
          destino_id?: string;
          estado?: string;
          fuente?: string;
          id?: number;
          metrica?: string;
          obtenido_en?: string;
          periodo?: string;
          valor?: number | null;
          valor_bruto?: Json | null;
        };
        Relationships: [
          {
            foreignKeyName: "senales_destino_id_fkey";
            columns: ["destino_id"];
            isOneToOne: false;
            referencedRelation: "experiencias";
            referencedColumns: ["id"];
          },
        ];
      };
      vetos: {
        Row: {
          activo: boolean | null;
          destino_id: string | null;
          id: number;
          mes: number | null;
          motivo: string | null;
        };
        Insert: {
          activo?: boolean | null;
          destino_id?: string | null;
          id?: number;
          mes?: number | null;
          motivo?: string | null;
        };
        Update: {
          activo?: boolean | null;
          destino_id?: string | null;
          id?: number;
          mes?: number | null;
          motivo?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "vetos_destino_id_fkey";
            columns: ["destino_id"];
            isOneToOne: false;
            referencedRelation: "experiencias";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
