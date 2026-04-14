"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";
import { useKim } from "@/components/kim";
import KimFullChatPage from "../page";

export default function KimChatById() {
  const { id } = useParams<{ id: string }>();
  const { loadConversation } = useKim();

  useEffect(() => {
    if (id) loadConversation(id);
  }, [id, loadConversation]);

  return <KimFullChatPage />;
}
