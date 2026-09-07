import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getMyWorkspaces } from "@/lib/supabase/workspaces";
import { LandingPage } from "@/components/landing/LandingPage";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://aqli.app";

// Note: no page-level `openGraph` here — Next replaces (not deep-merges) the
// layout's openGraph object per page, which would drop og:image and
// og:site_name. The root layout's OG block already covers this page.
export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

// Structured data for search engines and AI answer engines: who we are
// (Organization) and what the product is (SoftwareApplication, with the
// real pricing model — free self-hosted / free-in-beta cloud).
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${APP_URL}/#organization`,
      name: "Aqli",
      url: APP_URL,
      logo: `${APP_URL}/icon.svg`,
      sameAs: ["https://github.com/AAALI/aqli"],
    },
    {
      "@type": "SoftwareApplication",
      name: "Aqli",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      url: APP_URL,
      description:
        "The open source shared knowledge base for human–agent teams. Humans write and review docs; AI agents read approved context and draft docs through a REST API, with every agent doc going through a human review queue.",
      license: "https://github.com/AAALI/aqli/blob/main/LICENSE",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
        description: "Self-hosted is free under the MIT license; Aqli Cloud is free while in beta.",
      },
      publisher: { "@id": `${APP_URL}/#organization` },
    },
  ],
};

export default async function RootPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const workspaces = await getMyWorkspaces();
    if (workspaces.length === 0) redirect("/signup?step=workspace");
    redirect(`/w/${workspaces[0].slug}`);
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <LandingPage />
    </>
  );
}
