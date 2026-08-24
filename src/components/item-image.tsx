import Image from "next/image";
import { PhotoPlaceholder } from "./ui";
import { cn } from "@/lib/utils";

export function ItemImage({ src, alt, className, sizes = "120px" }: { src?: string; alt: string; className?: string; sizes?: string }) {
  if (!src) return <PhotoPlaceholder className={className} />;
  return <div className={cn("relative overflow-hidden bg-slate-100", className)}><Image src={src} alt={alt} fill sizes={sizes} className="object-cover" /></div>;
}
