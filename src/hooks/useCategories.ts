import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Category {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
}

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("categories")
        .select("id, name, icon, color")
        .order("name");
      setCategories(data ?? []);
      setLoading(false);
    };
    fetch();
  }, []);

  return { categories, loading };
}
