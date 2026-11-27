/** Sign-in / join page frame: the hero fills the page from 1024px with the form on its calm right side;
 *  on a phone it is a 240px top band with the form on paper below. Text over the hero is ink only. */
export function AuthFrame({ children }: { children: React.ReactNode }) {
  const alt = "An open notebook with a fountain pen on a kitchen table, beside a cup of tea and a sprig of jasmine";
  return (
    <div className="relative min-h-dvh bg-paper lg:bg-desk">
      <picture>
        <source srcSet="/hero.webp" type="image/webp" />
        <img
          src="/hero.png"
          alt={alt}
          className="h-[240px] w-full object-cover lg:fixed lg:inset-0 lg:h-full"
          style={{ objectPosition: "28% 62%" }}
        />
      </picture>
      <div className="relative lg:ml-[55%] lg:flex lg:min-h-dvh lg:items-center lg:pr-[4vw]">
        <div className="mx-auto w-full max-w-[460px] px-4 pb-12 pt-6 lg:px-0 lg:py-10">
          <div className="mb-5 flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-mark.png" alt="" width={40} height={40} className="h-10 w-10 object-cover" />
            <span lang="en" className="text-[26px] font-semibold text-ink">Helper Diary</span>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
