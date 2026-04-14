import { ProductDetail } from "@/components/shop/product-detail";

interface Props {
  params: Promise<{ handle: string }>;
}

export default async function ProductPage({ params }: Props) {
  const { handle } = await params;
  return <ProductDetail handle={handle} />;
}
