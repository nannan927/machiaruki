export type Memo = {
  id: string;
  title: string | null;
  body: string;
  lat: number;
  lng: number;
  tags: string[];
  created_at: string;
  updated_at: string;
};

export type CreateMemoInput = {
  title?: string;
  body: string;
  lat: number;
  lng: number;
  tags?: string[];
};
