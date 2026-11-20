import Image from "next/image";

// The club logo is the mark only, no text: the header, footer and
// drawer already print "Vector Flow" next to it, and the text under
// the mark is unreadable at 44px. Transparent PNG, so no circular
// clip or white backing is needed anywhere it is used.
export default function BrandLogo({ className = "", priority = false }) {
  return (
    <Image
      className={`brand-logo ${className}`.trim()}
      src="/vector-flow-logo.png"
      alt="Vector Flow"
      width={480}
      height={672}
      priority={priority}
    />
  );
}
