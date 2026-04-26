import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import type { CreateMemoInput } from "@/types/memo";

function validateMemo(input: Partial<CreateMemoInput>) {
  if (!input.body || !input.body.trim()) {
    return "body is required";
  }
  if (typeof input.lat !== "number" || input.lat < -90 || input.lat > 90) {
    return "lat must be a number between -90 and 90";
  }
  if (typeof input.lng !== "number" || input.lng < -180 || input.lng > 180) {
    return "lng must be a number between -180 and 180";
  }
  return null;
}

export async function GET() {
  const { data, error } = await supabase
    .from("memos")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}

export async function POST(request: Request) {
  const payload = (await request.json()) as Partial<CreateMemoInput>;
  const validationError = validateMemo(payload);

  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const tags = (payload.tags ?? []).map((tag) => tag.trim()).filter(Boolean);

  const { data, error } = await supabase
    .from("memos")
    .insert({
      title: payload.title?.trim() || null,
      body: payload.body,
      lat: payload.lat,
      lng: payload.lng,
      tags,
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
